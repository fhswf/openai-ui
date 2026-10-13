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
  restoreVaultChats,
  syncVaultChats,
  type VaultSyncCache,
} from "../service/zeroKnowledgeSync";
import { loadPrivateKey } from "../utils/zeroKnowledgeKeystore";
import { isPrivateKeyForUser } from "../utils/zeroKnowledgeStorage";
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

  useEffect(() => {
    latestState.current = state;
    latestActions.current = actionList;
  }, [state]);

  useEffect(() => {
    const handleVaultKeyAvailable = () => {
      setVaultUnlockRevision((revision) => revision + 1);
    };
    window.addEventListener("zk-storage-key-available", handleVaultKeyAvailable);
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
  const vaultIdentity =
    state.user?.sub ?? state.user?.id ?? state.user?.email ?? null;

  useEffect(() => {
    let cancelled = false;
    const bootstrapKey = `${zkStorageEnabled}:${vaultIdentity ?? ""}:${vaultUnlockRevision}`;

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
          cache
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
            : Math.min(current.currentChat, Math.max(result.chats.length - 1, 0));
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
  }, [zkStorageEnabled, vaultIdentity, vaultUnlockRevision, dispatch]);

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
    <ChatContext.Provider value={{ ...state, ...actionList }}>
      <MessagesContext.Provider value={dispatch}>
        {children}
      </MessagesContext.Provider>
    </ChatContext.Provider>
  );
};

export const useGlobal = () =>
  useContext<GlobalActions & GlobalState>(ChatContext);
export const useMessages = () => useContext(MessagesContext);
