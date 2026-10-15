import React, {
  useCallback,
  useRef,
  useEffect,
  useReducer,
  useState,
  useContext,
  createContext,
  Dispatch,
} from "react";
import action from "./action";
import reducer from "./reducer";
import { initState } from "./initState";
import { fetchAndGetUser } from "../utils";
import {
  GlobalAction,
  GlobalActions,
  GlobalState,
  GlobalActionType,
} from "./types";
import {
  loadState,
  reviver,
  saveState,
  reduceState,
  SESSION_KEY,
  CHAT_HISTORY_KEY,
} from "../utils/settings";
import { consumeLoginRetry } from "../utils/loginRetry";
import { useDebounce } from "../hooks/useDebounce";
import { toaster } from "../../components/ui/toaster";
import { t } from "i18next";
import { chatVault, type VaultUserKey } from "../service/chatVault";
import {
  createVaultSyncCache,
  demoteVaultChat,
  hydrateVaultChat,
  markVaultChats,
  restoreVaultChats,
  searchVaultChats,
  syncVaultChats,
  type VaultSyncCache,
} from "../service/zeroKnowledgeSync";
import { loadPrivateKey } from "../utils/zeroKnowledgeKeystore";
import { isPrivateKeyForUser } from "../utils/zeroKnowledgeStorage";
import { matchesChatQuery } from "../utils/chatSearch";
import type { Chat } from "./types";

const DRAFT_PERSIST_DELAY_MS = 300;

export const ChatContext = createContext(null);
export const MessagesContext = createContext<Dispatch<GlobalAction>>(null);

async function getState() {
  let state = initState;

  try {
    state = await loadState();
  } catch (e) {
    console.error("error parsing state: %s", e);
  }

  return state;
}

export const ChatProvider = ({ children }) => {
  let init: GlobalState = initState;

  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY), reviver);
    const chatHistory = JSON.parse(
      localStorage.getItem(CHAT_HISTORY_KEY),
      reviver
    );
    init = { ...init, ...stored };
    if (chatHistory) {
      init.chat = chatHistory;
    }
    if (!init.options.openai.mcpAuthConfigs) {
      init.options.openai.mcpAuthConfigs = new Map();
    }
  } catch (e) {
    console.error("error parsing state: %s", e);
  }

  const [state, reducerDispatch] = useReducer(reducer, init);
  const pendingTypingOnly = useRef<boolean | null>(null);
  const dispatch = useCallback<Dispatch<GlobalAction>>((nextAction) => {
    pendingTypingOnly.current =
      (pendingTypingOnly.current ?? true) &&
      nextAction.type === GlobalActionType.CHANGE_MESSAGE;
    reducerDispatch(nextAction);
  }, []);
  const actionList = action(state, dispatch);
  const debouncedSave = useDebounce(
    (stateToSave: GlobalState) => {
      saveState({ ...stateToSave });
    },
    DRAFT_PERSIST_DELAY_MS,
    true
  );
  const latestState = useRef(state);
  const latestActions = useRef(actionList);
  const [vaultReady, setVaultReady] = useState(false);
  const [vaultUnlockRevision, setVaultUnlockRevision] = useState(0);
  const vaultCache = useRef<VaultSyncCache>(createVaultSyncCache());
  const vaultCredentials = useRef<{
    privateKey: CryptoKey;
    userKey: VaultUserKey;
  } | null>(null);
  const vaultBootstrap = useRef<{
    key: string;
    promise: Promise<{
      privateKey: CryptoKey;
      userKey: VaultUserKey;
      chats: Chat[];
    } | null>;
  } | null>(null);
  const vaultSyncRunning = useRef(false);
  const vaultSyncRequested = useRef(false);
  const hydratedChats = useRef<Set<string>>(new Set());

  useEffect(() => {
    latestState.current = state;
    latestActions.current = actionList;
  }, [state]);

  useEffect(() => {
    const handleVaultKeyAvailable = () => {
      setVaultUnlockRevision((revision) => revision + 1);
    };
    window.addEventListener(
      "zk-storage-key-available",
      handleVaultKeyAvailable
    );
    return () => {
      window.removeEventListener(
        "zk-storage-key-available",
        handleVaultKeyAvailable
      );
    };
  }, []);

  useEffect(() => {
    console.log("ChatProvider: useEffect: fetching state from localStorage");
    const fetchState = async () => {
      const savedState = await getState();
      if (Array.isArray(savedState.chat)) {
        // Only merge persisted chat during async hydration. Some seeded sessions
        // only contain options, and dispatching `chat: undefined` would wipe the
        // initialized chat state and break subsequent persistence.
        dispatch({
          type: GlobalActionType.SET_STATE,
          payload: { chat: savedState.chat },
        });
      }
    };
    void fetchState();
  }, []);

  // get user
  useEffect(() => {
    console.log("fetch user");
    fetchAndGetUser(
      dispatch,
      () => latestState.current.options,
      actionList.setOptions,
      () => {
        // Resume the request that triggered the login redirect now that the
        // session is valid again. Use the latest actions so the retry sees the
        // hydrated chat state instead of the initial render's snapshot.
        if (consumeLoginRetry()) {
          console.log("resuming interrupted message after login");
          latestActions.current.retryPendingMessage();
        }
      }
    );
  }, []);

  const zkStorageEnabled = state.options.general.zkStorage ?? false;
  const lazyHistory = state.options.general.zkLazyHistory ?? false;
  const vaultIdentity =
    state.user?.sub ?? state.user?.id ?? state.user?.email ?? null;

  useEffect(() => {
    let cancelled = false;
    const bootstrapKey = `${zkStorageEnabled}:${
      vaultIdentity ?? ""
    }:${vaultUnlockRevision}:${lazyHistory}`;

    if (!zkStorageEnabled || !vaultIdentity) {
      setVaultReady(false);
      vaultCredentials.current = null;
      vaultCache.current = createVaultSyncCache();
      vaultBootstrap.current = null;
      return () => {
        cancelled = true;
      };
    }

    setVaultReady(false);
    if (vaultBootstrap.current?.key !== bootstrapKey) {
      vaultCredentials.current = null;
      vaultCache.current = createVaultSyncCache();
      hydratedChats.current = new Set();
      const cache = vaultCache.current;
      const promise = (async () => {
        const userKey = await chatVault.getMyKey();
        const privateKey = await loadPrivateKey();
        if (!privateKey || !(await isPrivateKeyForUser(privateKey, userKey))) {
          return null;
        }
        const localState = reduceState(latestState.current);
        const chats = await restoreVaultChats(
          localState.chat,
          privateKey,
          userKey,
          cache,
          { lazy: lazyHistory }
        );
        return { privateKey, userKey, chats };
      })();
      vaultBootstrap.current = { key: bootstrapKey, promise };
    }

    const bootstrap = vaultBootstrap.current.promise;
    bootstrap
      .then((result) => {
        if (cancelled || !result) return;
        vaultCredentials.current = {
          privateKey: result.privateKey,
          userKey: result.userKey,
        };
        const current = latestState.current;
        const selectedId = current.chat?.at(current.currentChat)?.id;
        const selectedIndex = result.chats.findIndex(
          (chat) => String(chat.id) === String(selectedId)
        );
        const currentChat =
          selectedIndex >= 0
            ? selectedIndex
            : Math.min(
                current.currentChat,
                Math.max(result.chats.length - 1, 0)
              );
        dispatch({
          type: GlobalActionType.SET_STATE,
          payload: { chat: result.chats, currentChat },
        });
        setVaultReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Could not restore encrypted chats:", error);
        toaster.create({
          title: t("zk_storage_sync_error"),
          description:
            error instanceof Error ? error.message : t("unknown_error"),
          duration: 8000,
          type: "error",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    zkStorageEnabled,
    vaultIdentity,
    vaultUnlockRevision,
    lazyHistory,
    dispatch,
  ]);

  useEffect(() => {
    if (!zkStorageEnabled || !vaultReady) return;

    const sync = async () => {
      if (vaultSyncRunning.current) {
        vaultSyncRequested.current = true;
        return;
      }

      vaultSyncRunning.current = true;
      try {
        do {
          vaultSyncRequested.current = false;
          const credentials = vaultCredentials.current;
          if (!credentials || !latestState.current.options.general.zkStorage) {
            break;
          }
          const localChats = reduceState(latestState.current).chat;
          await syncVaultChats(
            localChats,
            credentials.userKey,
            vaultCache.current
          );
        } while (vaultSyncRequested.current);
      } catch (error) {
        console.error("Could not sync encrypted chats:", error);
        toaster.create({
          title: t("zk_storage_sync_error"),
          description:
            error instanceof Error ? error.message : t("unknown_error"),
          duration: 8000,
          type: "error",
        });
      } finally {
        vaultSyncRunning.current = false;
      }
    };

    const timeout = window.setTimeout(() => void sync(), 800);
    return () => window.clearTimeout(timeout);
  }, [state.chat, zkStorageEnabled, vaultReady]);

  // Replace several chats at once. `latestState.current` is not updated until
  // the next render, so one dispatch per chat would apply every update to the
  // same stale snapshot and lose all but the last one.
  const applyChatUpdates = useCallback(
    (updates: Map<string, Chat>) => {
      if (!updates.size) return;
      const current = latestState.current;
      let changed = false;
      const nextChat = current.chat.map((item) => {
        const replacement = updates.get(String(item.id));
        if (!replacement) return item;
        changed = true;
        return replacement;
      });
      if (!changed) return;
      dispatch({
        type: GlobalActionType.SET_STATE,
        payload: { chat: nextChat },
      });
    },
    [dispatch]
  );

  const replaceChat = useCallback(
    (chat: Chat) => {
      applyChatUpdates(new Map([[String(chat.id), chat]]));
    },
    [applyChatUpdates]
  );

  // Fetch the transcript of a placeholder chat when it is opened.
  const loadChatMessages = useCallback(
    async (id: number | string) => {
      const key = String(id);
      const chat = latestState.current.chat?.find(
        (item) => String(item.id) === key
      );
      if (!chat?.vault || chat.messages?.length) return;
      if (hydratedChats.current.has(key)) return;
      const credentials = vaultCredentials.current;
      if (!credentials) return;

      hydratedChats.current.add(key);
      try {
        replaceChat(
          await hydrateVaultChat(
            chat,
            credentials.privateKey,
            credentials.userKey,
            vaultCache.current
          )
        );
      } catch (error) {
        hydratedChats.current.delete(key);
        throw error;
      }
    },
    [replaceChat]
  );

  // Search the complete history. Matching placeholders are loaded from the
  // vault and kept in state; non-matching ones are reduced again so the browser
  // storage stays small.
  const searchChats = useCallback(
    async (query: string): Promise<Chat[]> => {
      const credentials = vaultCredentials.current;
      const chats = latestState.current.chat ?? [];
      if (!credentials) {
        return chats.filter((chat) => matchesChatQuery(chat, query));
      }

      const matches = await searchVaultChats(
        chats,
        query,
        credentials.privateKey,
        credentials.userKey,
        vaultCache.current
      );
      const matchedIds = new Set(matches.map((chat) => String(chat.id)));
      const currentId = String(
        latestState.current.chat?.[latestState.current.currentChat]?.id
      );
      const updates = new Map<string, Chat>();
      for (const match of matches) {
        updates.set(String(match.id), match);
      }
      for (const chat of chats) {
        const id = String(chat.id);
        if (
          id === currentId ||
          !chat.vault ||
          !chat.messages?.length ||
          matchedIds.has(id)
        ) {
          continue;
        }
        hydratedChats.current.delete(id);
        updates.set(id, demoteVaultChat(chat));
      }
      applyChatUpdates(updates);
      return matches;
    },
    [applyChatUpdates]
  );

  // Record which chats live in the vault so the persistence layer may drop
  // their transcripts. Marking happens after the vault sync populated the
  // revision cache; it is idempotent and converges after one dispatch.
  useEffect(() => {
    if (!zkStorageEnabled || !vaultReady || !lazyHistory) return;
    const credentials = vaultCredentials.current;
    if (!credentials) return;
    const marked = markVaultChats(
      state.chat ?? [],
      vaultCache.current,
      credentials.userKey
    );
    if (marked) {
      dispatch({
        type: GlobalActionType.SET_STATE,
        payload: { chat: marked },
      });
    }
  }, [state.chat, zkStorageEnabled, vaultReady, lazyHistory, dispatch]);

  // With lazy history the current chat is a placeholder until it is opened.
  useEffect(() => {
    if (!lazyHistory || !vaultReady) return;
    const chat = state.chat?.[state.currentChat];
    if (!chat?.vault || chat.messages?.length) return;

    let cancelled = false;
    loadChatMessages(chat.id).catch((error) => {
      if (cancelled) return;
      console.error("Could not load the encrypted chat:", error);
      toaster.create({
        title: t("zk_storage_sync_error"),
        description:
          error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    state.chat,
    state.currentChat,
    lazyHistory,
    vaultReady,
    loadChatMessages,
  ]);

  useEffect(() => {
    const typingOnly = pendingTypingOnly.current === true;
    pendingTypingOnly.current = null;
    if (typingOnly) {
      debouncedSave.run(state);
    } else {
      // Sending, attachment changes, and other state updates must be saved now.
      debouncedSave.cancel();
      saveState({ ...state });
    }
  }, [state, debouncedSave.run, debouncedSave.cancel]);

  useEffect(() => {
    window.addEventListener("pagehide", debouncedSave.flush);
    return () => {
      window.removeEventListener("pagehide", debouncedSave.flush);
    };
  }, [debouncedSave.flush]);

  return (
    <ChatContext.Provider
      value={{
        ...state,
        ...actionList,
        loadChatMessages,
        searchChats,
        vaultReady,
      }}
    >
      <MessagesContext.Provider value={dispatch}>
        {children}
      </MessagesContext.Provider>
    </ChatContext.Provider>
  );
};

export const useGlobal = () =>
  useContext<GlobalActions & GlobalState>(ChatContext);
export const useMessages = () => useContext(MessagesContext);
