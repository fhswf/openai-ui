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
  VaultSharingActions,
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
import {
  chatVault,
  type VaultGroupChat,
  type VaultUserKey,
} from "../service/chatVault";
import {
  createVaultSyncCache,
  demoteVaultChat,
  hydrateVaultChat,
  markVaultChats,
  restoreVaultChats,
  searchVaultChats,
  syncGroupChatAttachments,
  syncVaultChats,
  isVaultDecryptionFailure,
  type VaultSyncCache,
} from "../service/zeroKnowledgeSync";
import {
  applyGroupOperation,
  decryptGroupEvent,
  hasPendingLocalGroupChatChanges,
  requeueGroupChatOperation,
  rememberAppliedGroupOperation,
  seedGroupChatRuntime,
  queueLocalGroupChatChanges,
  unwrapGroupEpochKeys,
  type GroupChatRuntime,
} from "../service/groupChatSync";
import {
  deleteGroupRoster as deleteSavedGroupRoster,
  lookupGroupInviteTarget as lookupSavedGroupInviteTarget,
  loadSavedGroupRosters,
  resetSavedGroupRosters,
  saveGroupRoster as saveSavedGroupRoster,
} from "../service/groupChatRosters";
import {
  createVaultGroupChat,
  inviteVaultGroupMember,
  removeVaultGroupMember,
} from "../service/groupChatMembership";
import { GroupChatRealtimeClient } from "../service/groupChatRealtime";
import {
  loadGroupChatCursor,
  removeGroupChatLocalData,
  saveGroupChatCursor,
} from "../service/groupChatLocalStore";
import type { VaultGroupEvent } from "../service/chatVault";
import { loadPrivateKey } from "../utils/zeroKnowledgeKeystore";
import { isPrivateKeyForUser } from "../utils/zeroKnowledgeStorage";
import { matchesChatQuery } from "../utils/chatSearch";
import {
  bufferToBase64Url,
  decryptAttachmentData,
  decryptGroupAttachmentData,
  getGroupAttachmentEpoch,
  LEGACY_RSA_KEY_ALGORITHM,
  getAttachmentAdditionalData,
  unwrapChatKey,
  wrapChatKey,
} from "../utils/zeroKnowledgeCrypto";
import {
  getInputFileMimeType,
  setVaultAttachmentResolver,
} from "../utils/attachments";
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
  const groupRealtime = useRef<GroupChatRealtimeClient | null>(null);
  const groupLocalSyncRunning = useRef(false);
  const groupLocalSyncRequested = useRef(false);

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
      (optionAction) => latestActions.current.setOptions(optionAction),
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

  const syncVaultBeforeSharing = useCallback(async () => {
    while (vaultSyncRunning.current) {
      vaultSyncRequested.current = true;
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    vaultSyncRunning.current = true;
    try {
      do {
        vaultSyncRequested.current = false;
        const credentials = vaultCredentials.current;
        if (!credentials || !latestState.current.options.general.zkStorage) {
          throw new Error("Unlock encrypted chat storage before sharing chats");
        }
        await syncVaultChats(
          reduceState(latestState.current).chat,
          credentials.userKey,
          vaultCache.current
        );
      } while (vaultSyncRequested.current);
    } finally {
      vaultSyncRunning.current = false;
    }
  }, []);

  const getChatKeyForSharing = useCallback(async (chatId: string) => {
    const credentials = vaultCredentials.current;
    if (
      !credentials ||
      !latestState.current.options.general.zkStorage
    ) {
      throw new Error("Unlock encrypted chat storage before sharing chats");
    }
    await syncVaultBeforeSharing();
    if (!vaultCache.current.owners.has(chatId)) {
      throw new Error("This chat is not available in the encrypted store yet");
    }
    const encrypted = await chatVault.getChat(chatId);
    const envelope = encrypted.envelopes.find(
      (item) => item.recipientId === credentials.userKey.userId
    );
    if (!envelope) {
      throw new Error("You do not have a key for this chat");
    }
    return unwrapChatKey(envelope, credentials.privateKey);
  }, [syncVaultBeforeSharing]);

  const requireVaultCredentials = useCallback(() => {
    const credentials = vaultCredentials.current;
    if (!credentials || !latestState.current.options.general.zkStorage) {
      throw new Error("Unlock encrypted chat storage before managing groups");
    }
    return credentials;
  }, []);

  const getGroupRuntime = useCallback(async (chatId: string): Promise<GroupChatRuntime> => {
    const credentials = requireVaultCredentials();
    const cached = vaultCache.current.groupChats.get(chatId);
    if (cached) return cached;

    const group = await chatVault.getGroupChat(chatId);
    const epochKeys = await unwrapGroupEpochKeys(group, credentials.privateKey);
    const chat =
      vaultCache.current.transcripts.get(chatId) ??
      latestState.current.chat.find((item) => String(item.id) === chatId);
    if (!chat) throw new Error("The group chat is not available on this device");
    const cursor = await loadGroupChatCursor(credentials.userKey.userId, chatId);
    const runtime = seedGroupChatRuntime(
      group,
      epochKeys,
      cursor,
      { ...chat, groupChat: true }
    );
    vaultCache.current.groupChats.set(chatId, runtime);
    if (epochKeys.has(1)) vaultCache.current.chatKeys.set(chatId, epochKeys.get(1)!);
    return runtime;
  }, [requireVaultCredentials]);

  const loadGroupRosters = useCallback(async () => {
    const { privateKey } = requireVaultCredentials();
    return loadSavedGroupRosters(privateKey);
  }, [requireVaultCredentials]);

  const resetGroupRosters = useCallback(async () => {
    const { userKey } = requireVaultCredentials();
    return resetSavedGroupRosters(userKey);
  }, [requireVaultCredentials]);

  const saveGroupRoster = useCallback(async (name: string, emails: string[]) => {
    const { privateKey, userKey } = requireVaultCredentials();
    return saveSavedGroupRoster(userKey, privateKey, name, emails);
  }, [requireVaultCredentials]);

  const deleteGroupRoster = useCallback(async (rosterId: string) => {
    const { privateKey, userKey } = requireVaultCredentials();
    return deleteSavedGroupRoster(userKey, privateKey, rosterId);
  }, [requireVaultCredentials]);

  const createGroupChatFromRoster = useCallback(async (
    chatId: string,
    rosterId: string
  ) => {
    const credentials = requireVaultCredentials();
    await syncVaultBeforeSharing();
    const current = latestState.current.chat.find(
      (item) => String(item.id) === chatId
    );
    if (!current) throw new Error("The selected chat is no longer available");
    if (current.groupChat || vaultCache.current.groupChats.has(chatId)) {
      throw new Error("This chat is already a group chat");
    }
    const rosters = await loadSavedGroupRosters(credentials.privateKey);
    const roster = rosters.find((item) => item.id === rosterId);
    if (!roster) throw new Error("The saved group could not be found");

    let fullChat = current;
    if (current.vault && !current.messages?.length) {
      fullChat = await hydrateVaultChat(
        current,
        credentials.privateKey,
        credentials.userKey,
        vaultCache.current
      );
    }
    const chatKey =
      vaultCache.current.chatKeys.get(chatId) ??
      (await getChatKeyForSharing(chatId));
    const group = await createVaultGroupChat(
      chatId,
      roster,
      credentials.userKey,
      credentials.privateKey,
      chatKey
    );
    const groupedChat = { ...fullChat, groupChat: true };
    vaultCache.current.owners.set(chatId, group.ownerId);
    vaultCache.current.chatKeys.set(chatId, chatKey);
    vaultCache.current.groupChats.set(
      chatId,
      seedGroupChatRuntime(group, new Map([[1, chatKey]]), 0, groupedChat)
    );
    vaultCache.current.transcripts.set(chatId, groupedChat);
    dispatch({
      type: GlobalActionType.SET_STATE,
      payload: {
        chat: latestState.current.chat.map((item) =>
          String(item.id) === chatId ? groupedChat : item
        ),
      },
    });
  }, [dispatch, getChatKeyForSharing, requireVaultCredentials, syncVaultBeforeSharing]);

  const getGroupChatInfo = useCallback(
    (chatId: string) => chatVault.getGroupChat(chatId),
    []
  );

  const lookupGroupInviteTarget = useCallback(
    (email: string) => lookupSavedGroupInviteTarget(email),
    []
  );

  const inviteGroupChatMember = useCallback(async (
    chatId: string,
    email: string,
    expectedFingerprint: string
  ) => {
    const credentials = requireVaultCredentials();
    const runtime = await getGroupRuntime(chatId);
    const updated = await inviteVaultGroupMember(
      chatId,
      runtime.group,
      runtime.epochKeys,
      email,
      credentials.userKey.userId,
      expectedFingerprint
    );
    runtime.group = updated.group;
    runtime.epochKeys = updated.epochKeys;
  }, [getGroupRuntime, requireVaultCredentials]);

  const removeGroupChatMember = useCallback(async (chatId: string, memberId: string) => {
    const credentials = requireVaultCredentials();
    const runtime = await getGroupRuntime(chatId);
    const updated = await removeVaultGroupMember(
      chatId,
      runtime.group,
      runtime.epochKeys,
      memberId,
      credentials.userKey.userId
    );
    runtime.group = updated.group;
    runtime.epochKeys = updated.epochKeys;
  }, [getGroupRuntime, requireVaultCredentials]);

  const isGroupChatOwner = useCallback((chatId: string) => {
    const credentials = vaultCredentials.current;
    return Boolean(
      credentials &&
      vaultCache.current.owners.get(chatId) === credentials.userKey.userId
    );
  }, []);

  const shareChatWithUser = useCallback(
    async (chatId: string, email: string) => {
      const chatKey = await getChatKeyForSharing(chatId);
      const recipient = await chatVault.lookupKeyByEmail(email.trim());
      const wrappedKey = await wrapChatKey(
        chatKey,
        recipient.publicKey,
        recipient.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      );
      await chatVault.shareChat(chatId, {
        recipientId: recipient.userId,
        ...wrappedKey,
      });
    },
    [getChatKeyForSharing]
  );

  const createChatShareLink = useCallback(
    async (chatId: string) => {
      const chatKey = await getChatKeyForSharing(chatId);
      const share = await chatVault.createShareLink(chatId);
      const rawKey = await crypto.subtle.exportKey("raw", chatKey);
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = new URLSearchParams({
        zkShare: share.token,
        zkKey: bufferToBase64Url(rawKey),
      }).toString();
      return {
        url: url.toString(),
        token: share.token,
        expiresAt: share.expiresAt,
      };
    },
    [getChatKeyForSharing]
  );

  const revokeChatShareLink = useCallback(
    async (chatId: string, token: string) => {
      await chatVault.revokeShareLink(chatId, token);
    },
    []
  );

  const importSharedChat = useCallback(
    (sharedChat: Chat) => {
      const current = latestState.current;
      dispatch({
        type: GlobalActionType.SET_STATE,
        payload: {
          chat: [sharedChat, ...(current.chat ?? [])],
          currentChat: 0,
        },
      });
    },
    [dispatch]
  );

  useEffect(() => {
    if (!zkStorageEnabled || !vaultReady) {
      setVaultAttachmentResolver(null);
      return;
    }

    setVaultAttachmentResolver({
      async load(chatId, attachmentId, filename) {
        const encrypted = await chatVault.getAttachment(chatId, attachmentId);
        const epoch = getGroupAttachmentEpoch(encrypted);
        let plaintext: ArrayBuffer;
        if (epoch !== null) {
          const epochKey = vaultCache.current.groupChats
            .get(chatId)
            ?.epochKeys.get(epoch);
          if (!epochKey) {
            throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
          }
          plaintext = await decryptGroupAttachmentData(encrypted, epochKey, {
            chatId,
            attachmentId,
            epoch,
          });
        } else {
          const chatKey = vaultCache.current.chatKeys.get(chatId);
          if (!chatKey) {
            throw new Error("The encryption key for this chat is unavailable");
          }
          plaintext = await decryptAttachmentData(
            encrypted,
            chatKey,
            getAttachmentAdditionalData(chatId, attachmentId)
          );
        }
        const file = new File([plaintext], filename, {
          type: getInputFileMimeType(filename),
        });

        try {
          const opfs = await navigator.storage.getDirectory();
          const handle = await opfs.getFileHandle(filename, { create: true });
          const writable = await handle.createWritable();
          await writable.write(plaintext);
          await writable.close();
        } catch (error) {
          console.warn("Could not cache downloaded attachment in OPFS:", error);
        }
        return file;
      },
      delete(chatId, attachmentId) {
        return chatVault.deleteAttachment(chatId, attachmentId);
      },
      canDelete(chatId) {
        const credentials = vaultCredentials.current;
        return Boolean(
          credentials &&
            vaultCache.current.owners.get(chatId) === credentials.userKey.userId
        );
      },
    });
    return () => setVaultAttachmentResolver(null);
  }, [zkStorageEnabled, vaultReady, vaultIdentity, vaultUnlockRevision]);

  useEffect(() => {
    if (!zkStorageEnabled || !vaultReady) {
      setVaultAttachmentResolver(null);
      return;
    }

    setVaultAttachmentResolver({
      async load(chatId, attachmentId, filename) {
        const encrypted = await chatVault.getAttachment(chatId, attachmentId);
        const epoch = getGroupAttachmentEpoch(encrypted);
        let plaintext: ArrayBuffer;
        if (epoch !== null) {
          const epochKey = vaultCache.current.groupChats
            .get(chatId)
            ?.epochKeys.get(epoch);
          if (!epochKey) {
            throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
          }
          plaintext = await decryptGroupAttachmentData(encrypted, epochKey, {
            chatId,
            attachmentId,
            epoch,
          });
        } else {
          const chatKey = vaultCache.current.chatKeys.get(chatId);
          if (!chatKey) {
            throw new Error("The encryption key for this chat is unavailable");
          }
          plaintext = await decryptAttachmentData(
            encrypted,
            chatKey,
            getAttachmentAdditionalData(chatId, attachmentId)
          );
        }
        const file = new File([plaintext], filename, {
          type: getInputFileMimeType(filename),
        });

        try {
          const opfs = await navigator.storage.getDirectory();
          const handle = await opfs.getFileHandle(filename, { create: true });
          const writable = await handle.createWritable();
          await writable.write(plaintext);
          await writable.close();
        } catch (error) {
          console.warn("Could not cache downloaded attachment in OPFS:", error);
        }
        return file;
      },
      delete(chatId, attachmentId) {
        return chatVault.deleteAttachment(chatId, attachmentId);
      },
      canDelete(chatId) {
        const credentials = vaultCredentials.current;
        return Boolean(
          credentials &&
            vaultCache.current.owners.get(chatId) === credentials.userKey.userId
        );
      },
    });
    return () => setVaultAttachmentResolver(null);
  }, [zkStorageEnabled, vaultReady, vaultIdentity, vaultUnlockRevision]);

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

  const applyIncomingGroupEvent = useCallback(async (incoming: VaultGroupEvent) => {
    const credentials = vaultCredentials.current;
    const chatId = incoming.chatId;
    const runtime = vaultCache.current.groupChats.get(chatId);
    if (!credentials || !runtime) return runtime?.cursor ?? 0;

    const applyOne = async (event: VaultGroupEvent) => {
      if (event.sequence <= runtime.cursor) return;
      const keyAvailable = runtime.epochKeys.has(event.epoch);
      try {
        const operation = await decryptGroupEvent(event, runtime);
        const currentChat =
          vaultCache.current.transcripts.get(chatId) ??
          latestState.current.chat.find((item) => String(item.id) === chatId);
        if (currentChat) {
          const updated = applyGroupOperation(currentChat, operation);
          vaultCache.current.transcripts.set(chatId, updated);
          rememberAppliedGroupOperation(runtime, operation);
          const visible = latestState.current.chat.find(
            (item) => String(item.id) === chatId
          );
          if (visible && (!visible.vault || visible.messages?.length)) {
            applyChatUpdates(new Map([[chatId, updated]]));
          }
        }
      } catch (error) {
        if (keyAvailable) {
          console.warn("Ignoring an unreadable group chat event:", error);
        }
      }
      runtime.cursor = event.sequence;
      runtime.group = { ...runtime.group, cursor: event.sequence };
      await saveGroupChatCursor(credentials.userKey.userId, chatId, event.sequence);
    };

    // If a live notification arrives out of order, fill the sequence gap from
    // the durable REST log before applying it.
    while (runtime.cursor + 1 < incoming.sequence) {
      const page = await chatVault.listGroupEvents(chatId, runtime.cursor, 20);
      if (page.events.length === 0) break;
      for (const event of page.events) {
        await applyOne(event);
        if (runtime.cursor >= incoming.sequence) break;
      }
    }
    await applyOne(incoming);
    return runtime.cursor;
  }, [applyChatUpdates]);

  const groupChatIdsKey = (state.chat ?? [])
    .filter((chat) => chat.groupChat)
    .map((chat) => String(chat.id))
    .sort()
    .join("\u0000");

  useEffect(() => {
    if (!zkStorageEnabled || !vaultReady || !groupChatIdsKey) return;
    const subscriptions = groupChatIdsKey
      .split("\u0000")
      .filter(Boolean)
      .flatMap((chatId) => {
        const runtime = vaultCache.current.groupChats.get(chatId);
        return runtime ? [{ chatId, cursor: runtime.cursor }] : [];
      });
    if (!subscriptions.length) return;

    const client = new GroupChatRealtimeClient({
      onEvent: applyIncomingGroupEvent,
      onOutboxError: async (event, code, message) => {
        if (code === "conflict" && event) {
          try {
            const credentials = vaultCredentials.current;
            const runtime = vaultCache.current.groupChats.get(event.chatId);
            if (!credentials || !runtime) throw new Error(message);
            const operation = await decryptGroupEvent(event, runtime);
            const latestGroup = await chatVault.getGroupChat(event.chatId);
            const latestKeys = await unwrapGroupEpochKeys(
              latestGroup,
              credentials.privateKey
            );
            const combinedKeys = new Map(runtime.epochKeys);
            for (const [epoch, key] of latestKeys) combinedKeys.set(epoch, key);
            runtime.group = latestGroup;
            runtime.epochKeys = combinedKeys;
            await requeueGroupChatOperation(event.chatId, runtime, operation);
            return;
          } catch (error) {
            console.warn("Could not refresh a group's key epoch:", error);
          }
        }
        toaster.create({
          title: t("zk_group_pending_event_error"),
          description: message,
          duration: 8000,
          type: "error",
        });
      },
    });
    groupRealtime.current = client;
    client.setSubscriptions(subscriptions);
    client.start();
    return () => {
      client.stop();
      if (groupRealtime.current === client) groupRealtime.current = null;
    };
  }, [
    zkStorageEnabled,
    vaultReady,
    vaultIdentity,
    vaultUnlockRevision,
    groupChatIdsKey,
    applyIncomingGroupEvent,
  ]);

  useEffect(() => {
    if (!zkStorageEnabled || !vaultReady) return;
    if (groupLocalSyncRunning.current) {
      groupLocalSyncRequested.current = true;
      return;
    }
    groupLocalSyncRunning.current = true;
    const syncLocalGroupEvents = async () => {
      try {
        do {
          groupLocalSyncRequested.current = false;
          for (const chat of latestState.current.chat ?? []) {
            if (!chat.groupChat) continue;
            const chatId = String(chat.id);
            const runtime = vaultCache.current.groupChats.get(chatId);
            if (!runtime) continue;
            const credentials = vaultCredentials.current;
            if (!credentials) continue;
            if (!hasPendingLocalGroupChatChanges(chat, runtime)) continue;
            const latestGroup = await chatVault.getGroupChat(chatId);
            const latestKeys = await unwrapGroupEpochKeys(
              latestGroup,
              credentials.privateKey
            );
            const combinedKeys = new Map(runtime.epochKeys);
            for (const [epoch, key] of latestKeys) combinedKeys.set(epoch, key);
            runtime.group = latestGroup;
            runtime.epochKeys = combinedKeys;
            await syncGroupChatAttachments(
              chat,
              credentials.userKey,
              vaultCache.current
            );
            const queued = await queueLocalGroupChatChanges(chat, runtime);
            if (queued) groupRealtime.current?.flushPendingEvents();
          }
        } while (groupLocalSyncRequested.current);
      } catch (error) {
        console.error("Could not queue group chat changes:", error);
        toaster.create({
          title: t("zk_group_pending_event_error"),
          description: error instanceof Error ? error.message : t("unknown_error"),
          duration: 8000,
          type: "error",
        });
      } finally {
        groupLocalSyncRunning.current = false;
      }
    };
    void syncLocalGroupEvents();
  }, [state.chat, zkStorageEnabled, vaultReady]);

  const replaceChat = useCallback(
    (chat: Chat) => {
      applyChatUpdates(new Map([[String(chat.id), chat]]));
    },
    [applyChatUpdates]
  );

  const deleteUnreadableVaultChat = useCallback(
    async (id: string) => {
      const credentials = requireVaultCredentials();
      const chat = latestState.current.chat?.find(
        (item) => String(item.id) === id
      );
      const descriptor = chat?.vault;
      if (!chat || descriptor?.restoreError !== "decrypt_failed") {
        throw new Error("This chat is not marked as undecryptable");
      }
      const ownerId = vaultCache.current.owners.get(id) ?? descriptor.ownerId;
      if (ownerId !== credentials.userKey.userId) {
        throw new Error("Only the owner can delete this encrypted chat");
      }

      await chatVault.deleteChat(id);
      try {
        await removeGroupChatLocalData(credentials.userKey.userId, id);
      } catch (error) {
        console.warn("Could not clear local group chat sync data:", error);
      }
      hydratedChats.current.delete(id);
      const cache = vaultCache.current;
      cache.revisions.delete(id);
      cache.fingerprints.delete(id);
      cache.owners.delete(id);
      cache.chatKeys.delete(id);
      cache.groupChats.delete(id);
      cache.transcripts.delete(id);
      cache.attachmentIds.delete(id);
      for (const key of cache.attachmentFingerprints.keys()) {
        if (key.startsWith(`${id}\u0000`)) {
          cache.attachmentFingerprints.delete(key);
        }
      }

      const current = latestState.current;
      const index = current.chat.findIndex((item) => String(item.id) === id);
      if (index < 0) return;
      const nextChat = current.chat.filter((item) => String(item.id) !== id);
      const currentChat =
        index === current.currentChat && index > 0
          ? index - 1
          : Math.min(current.currentChat, Math.max(nextChat.length - 1, 0));
      dispatch({
        type: GlobalActionType.SET_STATE,
        payload: { chat: nextChat, currentChat },
      });
    },
    [dispatch, requireVaultCredentials]
  );

  // Fetch the transcript of a placeholder chat when it is opened.
  const loadChatMessages = useCallback(
    async (id: number | string) => {
      const key = String(id);
      const chat = latestState.current.chat?.find(
        (item) => String(item.id) === key
      );
      if (!chat?.vault || chat.messages?.length) return;
      const descriptor = chat.vault;
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
        if (isVaultDecryptionFailure(error)) {
          const ownerId =
            vaultCache.current.owners.get(key) ?? descriptor.ownerId;
          vaultCache.current.revisions.set(key, descriptor.rev);
          vaultCache.current.owners.set(key, ownerId);
          replaceChat({
            ...chat,
            vault: {
              ...descriptor,
              restoreError: "decrypt_failed",
              canDelete: ownerId === credentials.userKey.userId,
            },
          });
          return;
        }
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
        shareChatWithUser,
        createChatShareLink,
        revokeChatShareLink,
        loadGroupRosters,
        resetGroupRosters,
        saveGroupRoster,
        deleteGroupRoster,
        createGroupChatFromRoster,
        getGroupChatInfo,
        lookupGroupInviteTarget,
        inviteGroupChatMember,
        removeGroupChatMember,
        isGroupChatOwner,
        importSharedChat,
        vaultReady,
        deleteUnreadableVaultChat,
      }}
    >
      <MessagesContext.Provider value={dispatch}>
        {children}
      </MessagesContext.Provider>
    </ChatContext.Provider>
  );
};

export const useGlobal = () =>
  useContext<GlobalActions & GlobalState & VaultSharingActions>(ChatContext);
export const useMessages = () => useContext(MessagesContext);
