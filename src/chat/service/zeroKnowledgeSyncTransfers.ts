import type { Chat } from "../context/types";
import {
  chatVault,
  VaultError,
  type VaultChat,
  type VaultChatSummary,
  type VaultGroupChat,
  type VaultUserKey,
} from "./chatVault";
import {
  decryptChatData,
  encryptChatData,
  generateChatKey,
  LEGACY_RSA_KEY_ALGORITHM,
  unwrapChatKey,
  wrapChatKey,
} from "../utils/zeroKnowledgeCrypto";
import {
  applyGroupOperation,
  decryptGroupEvent,
  rememberAppliedGroupOperation,
  seedGroupChatRuntime,
  unwrapGroupEpochKeys,
  type GroupChatRuntime,
} from "./groupChatSync";
import { saveGroupChatCursor } from "./groupChatLocalStore";
import { ensureChatAttachmentIds } from "../utils/chatAttachments";
import {
  cacheTranscript,
  chatId,
  fingerprint,
  isLegacyNumericChatId,
  type VaultSyncCache,
} from "./zeroKnowledgeSyncCache";
import { syncChatAttachments } from "./zeroKnowledgeSyncAttachments";

async function prepareChatKey(
  id: string,
  cache: VaultSyncCache
): Promise<{ key: CryptoKey; previousKey?: CryptoKey; rotates: boolean }> {
  const previousKey = cache.chatKeys.get(id);
  const rotates = previousKey?.extractable !== true;
  return {
    key:
      previousKey?.extractable === true ? previousKey : await generateChatKey(),
    previousKey,
    rotates,
  };
}

async function putChatWithRevision(
  id: string,
  payload: Parameters<typeof chatVault.putChat>[1],
  cache: VaultSyncCache
): Promise<VaultChat> {
  try {
    return await chatVault.putChat(id, payload);
  } catch (error) {
    if (
      !(error instanceof VaultError) ||
      error.status !== 409 ||
      error.currentRev === undefined
    ) {
      throw error;
    }
    cache.revisions.set(id, error.currentRev);
    return chatVault.putChat(id, {
      ...payload,
      baseRev: error.currentRev,
    });
  }
}

export async function uploadChat(
  chat: Chat,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  const id = chatId(chat);
  if (isLegacyNumericChatId(id) && !cache.owners.has(id)) {
    throw new Error(
      `Refusing to create a vault chat with legacy numeric ID ${id}`
    );
  }
  ensureChatAttachmentIds(chat);
  // Keys unwrapped from the vault are deliberately non-extractable, so they
  // cannot be wrapped again. Only reuse an extractable key we generated here;
  // otherwise create a fresh one for this upload.
  const {
    key: chatKey,
    previousKey,
    rotates,
  } = await prepareChatKey(id, cache);
  const encryptedChat = await encryptChatData(chat, chatKey);
  const wrappedKey = await wrapChatKey(
    chatKey,
    userKey.publicKey,
    userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
  );
  const payload = {
    ...encryptedChat,
    selfEnvelope: {
      recipientId: userKey.userId,
      ...wrappedKey,
    },
    baseRev: cache.revisions.get(id),
  };
  const uploaded = await putChatWithRevision(id, payload, cache);
  cache.revisions.set(id, uploaded.rev);
  cache.owners.set(id, uploaded.ownerId || userKey.userId);
  await syncChatAttachments(chat, id, chatKey, cache, {
    forceReencrypt: rotates,
    previousChatKey: previousKey,
  });
  cache.chatKeys.set(id, chatKey);
  cache.fingerprints.set(id, fingerprint(chat));
}

export type DownloadedChat = {
  chat: Chat;
  rev: number;
  ownerId: string;
};

export async function getGroupStateIfAvailable(
  id: string
): Promise<VaultGroupChat | null> {
  if (typeof chatVault.getGroupChat !== "function") return null;
  try {
    return await chatVault.getGroupChat(id);
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) return null;
    throw error;
  }
}

async function decryptInitialGroupChat(
  encrypted: VaultChat,
  initialKey: CryptoKey | undefined
): Promise<Chat | null> {
  if (!initialKey) return null;
  try {
    return await decryptChatData<Chat>(encrypted, initialKey);
  } catch (error) {
    console.warn("Could not decrypt the initial group chat snapshot:", error);
    return null;
  }
}

async function createGroupChatTranscript(
  summary: VaultChatSummary,
  encrypted: VaultChat,
  initialKey: CryptoKey | undefined,
  local?: Chat
): Promise<Chat> {
  const decrypted = await decryptInitialGroupChat(encrypted, initialKey);
  // New members without history access can still receive messages from the
  // epoch they joined. The default invitation flow grants history, so this
  // fallback is for deliberately history-limited membership.
  const chat =
    decrypted ??
    (local?.messages?.length
      ? { ...local, messages: [...local.messages] }
      : {
          title: summary.id,
          app: 0,
          id: summary.id,
          ct: Date.now(),
          messages: [],
        });
  chat.id = encrypted.id;
  chat.groupChat = true;
  return chat;
}

async function replayGroupChatEvents(
  id: string,
  chat: Chat,
  runtime: GroupChatRuntime
): Promise<{ chat: Chat; cursor: number }> {
  let cursor = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await chatVault.listGroupEvents(id, cursor, 20);
    for (const event of page.events) {
      if (event.sequence <= cursor) continue;
      try {
        const operation = await decryptGroupEvent(event, runtime);
        chat = applyGroupOperation(chat, operation);
        rememberAppliedGroupOperation(runtime, operation);
      } catch (error) {
        // A member without an old epoch key cannot read those historical
        // events. Continue at the next sequence, where their key may apply.
        if (runtime.epochKeys.has(event.epoch)) {
          console.warn("Could not decrypt a group chat event:", error);
        }
      }
      cursor = event.sequence;
    }
    hasMore = page.hasMore;
    if (page.events.length === 0) hasMore = false;
  }
  return { chat, cursor };
}

type GroupChatCacheUpdate = {
  userKey: VaultUserKey;
  id: string;
  encrypted: VaultChat;
  group: VaultGroupChat;
  initialKey: CryptoKey | undefined;
  chat: Chat;
  cursor: number;
  ownerId: string;
  cache: VaultSyncCache;
  runtime: GroupChatRuntime;
};

async function cacheDownloadedGroupChat(
  input: GroupChatCacheUpdate
): Promise<void> {
  input.runtime.cursor = input.cursor;
  input.runtime.group = { ...input.group, cursor: input.cursor };
  input.cache.groupChats.set(input.id, input.runtime);
  input.cache.revisions.set(input.id, input.encrypted.rev);
  input.cache.fingerprints.set(input.id, fingerprint(input.chat));
  input.cache.owners.set(input.id, input.ownerId);
  if (input.initialKey) input.cache.chatKeys.set(input.id, input.initialKey);
  ensureChatAttachmentIds(input.chat);
  cacheTranscript(input.cache, input.id, input.chat);
  await saveGroupChatCursor(input.userKey.userId, input.id, input.cursor);
}

async function downloadGroupChat(
  summary: VaultChatSummary,
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache,
  group: VaultGroupChat,
  local?: Chat
): Promise<DownloadedChat | null> {
  const encrypted = await chatVault.getChat(summary.id);
  const epochKeys = await unwrapGroupEpochKeys(group, privateKey);
  const initialKey = epochKeys.get(1);
  const chat = await createGroupChatTranscript(
    summary,
    encrypted,
    initialKey,
    local
  );
  const id = String(encrypted.id);
  const ownerId = encrypted.ownerId || summary.ownerId;
  const runtime = seedGroupChatRuntime(group, epochKeys, 0, chat);
  const replayed = await replayGroupChatEvents(id, chat, runtime);
  await cacheDownloadedGroupChat({
    userKey,
    id,
    encrypted,
    group,
    initialKey,
    chat: replayed.chat,
    cursor: replayed.cursor,
    ownerId,
    cache,
    runtime,
  });
  return { chat: replayed.chat, rev: encrypted.rev, ownerId };
}

/**
 * Download and decrypt one remote chat. Returns null when the current key
 * cannot open it (missing envelope or failed decryption).
 */
export async function downloadChat(
  summary: VaultChatSummary,
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache,
  local?: Chat,
  knownGroup?: VaultGroupChat | null,
  options: { throwOnDecryptFailure?: boolean } = {}
): Promise<DownloadedChat | null> {
  const group =
    knownGroup === undefined
      ? await getGroupStateIfAvailable(summary.id)
      : knownGroup;
  if (group) {
    return downloadGroupChat(summary, privateKey, userKey, cache, group, local);
  }

  const encrypted = await chatVault.getChat(summary.id);
  const envelope = encrypted.envelopes.find(
    (item) => item.recipientId === userKey.userId
  );
  if (!envelope) {
    console.warn(
      "No decryption key is available for vault chat %s",
      summary.id
    );
    return null;
  }

  try {
    const chatKey = await unwrapChatKey(envelope, privateKey);
    const chat = await decryptChatData<Chat>(encrypted, chatKey);
    chat.id = encrypted.id;
    const id = String(encrypted.id);
    const ownerId = encrypted.ownerId || summary.ownerId;
    cache.revisions.set(id, encrypted.rev);
    cache.fingerprints.set(id, fingerprint(chat));
    cache.owners.set(id, ownerId);
    cache.chatKeys.set(id, chatKey);
    // Preserve the pre-migration fingerprint above so sync writes newly
    // assigned IDs back into the encrypted chat.
    ensureChatAttachmentIds(chat);
    return { chat, rev: encrypted.rev, ownerId };
  } catch (error) {
    console.warn("Could not decrypt vault chat %s:", summary.id, error);
    if (options.throwOnDecryptFailure && isVaultDecryptionFailure(error)) {
      throw error;
    }
    return null;
  }
}

export function isVaultDecryptionFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "OperationError"
  );
}
