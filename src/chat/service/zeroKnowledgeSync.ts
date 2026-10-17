import type { Chat } from "../context/types";
import {
  chatVault,
  VaultError,
  type VaultChat,
  type VaultUserKey,
} from "./chatVault";
import {
  decryptChatData,
  encryptAttachmentData,
  encryptChatData,
  generateChatKey,
  getAttachmentAdditionalData,
  LEGACY_RSA_KEY_ALGORITHM,
  unwrapChatKey,
  wrapChatKey,
} from "../utils/zeroKnowledgeCrypto";
import {
  getAttachmentStorageId,
  getOpfsFile,
} from "../utils/attachments";
import {
  ensureChatAttachmentIds,
  getChatAttachmentReferences,
} from "../utils/chatAttachments";

export type VaultSyncCache = {
  revisions: Map<string, number>;
  fingerprints: Map<string, string>;
  owners: Map<string, string>;
  chatKeys: Map<string, CryptoKey>;
  attachmentFingerprints: Map<string, string>;
  attachmentIds: Map<string, Set<string>>;
};

export function createVaultSyncCache(): VaultSyncCache {
  return {
    revisions: new Map(),
    fingerprints: new Map(),
    owners: new Map(),
    chatKeys: new Map(),
    attachmentFingerprints: new Map(),
    attachmentIds: new Map(),
  };
}

function attachmentCacheKey(chatId: string, attachmentId: string): string {
  return `${chatId}\u0000${attachmentId}`;
}

async function syncChatAttachments(
  chat: Chat,
  id: string,
  chatKey: CryptoKey,
  cache: VaultSyncCache
): Promise<void> {
  const references = getChatAttachmentReferences(chat);
  const knownOnServer = new Set(cache.attachmentIds.get(id) ?? []);
  const currentIds = new Set<string>();
  for (const reference of references) {
    const attachmentId = await getAttachmentStorageId(
      reference.attachmentId,
      reference.opfsName
    );
    currentIds.add(attachmentId);
    if (!knownOnServer.has(attachmentId)) {
      if (await chatVault.hasAttachment(id, attachmentId)) {
        knownOnServer.add(attachmentId);
      }
    }
    const cacheKey = attachmentCacheKey(id, attachmentId);
    let file: File;
    try {
      // Do not download remote files just to sync a chat. Local files are
      // uploaded when available; remote files are fetched only on demand.
      file = await getOpfsFile(reference.opfsName);
    } catch {
      continue;
    }
    const fingerprint = `${reference.opfsName}:${file.size}:${file.lastModified}`;
    if (knownOnServer.has(attachmentId)) {
      const previousFingerprint = cache.attachmentFingerprints.get(cacheKey);
      if (previousFingerprint === fingerprint) continue;
      if (previousFingerprint === undefined) {
        cache.attachmentFingerprints.set(cacheKey, fingerprint);
        continue;
      }
    }

    const encrypted = await encryptAttachmentData(
      await file.arrayBuffer(),
      chatKey,
      getAttachmentAdditionalData(id, attachmentId)
    );
    await chatVault.putAttachment(id, attachmentId, encrypted);
    knownOnServer.add(attachmentId);
    cache.attachmentFingerprints.set(cacheKey, fingerprint);
  }

  const previouslySynced = cache.attachmentIds.get(id) ?? new Set<string>();
  for (const removedId of previouslySynced) {
    if (currentIds.has(removedId)) continue;
    await chatVault.deleteAttachment(id, removedId);
    knownOnServer.delete(removedId);
    cache.attachmentFingerprints.delete(attachmentCacheKey(id, removedId));
  }
  cache.attachmentIds.set(id, knownOnServer);
}

function chatId(chat: Chat): string {
  return String(chat.id);
}

function fingerprint(chat: Chat): string {
  return JSON.stringify(chat);
}

async function uploadChat(
  chat: Chat,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  ensureChatAttachmentIds(chat);
  const id = chatId(chat);
  const chatKey = cache.chatKeys.get(id) ?? (await generateChatKey());
  cache.chatKeys.set(id, chatKey);
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
  let uploaded: VaultChat;
  try {
    uploaded = await chatVault.putChat(id, payload);
  } catch (error) {
    if (
      !(error instanceof VaultError) ||
      error.status !== 409 ||
      error.currentRev === undefined
    ) {
      throw error;
    }
    cache.revisions.set(id, error.currentRev);
    uploaded = await chatVault.putChat(id, {
      ...payload,
      baseRev: error.currentRev,
    });
  }

  cache.revisions.set(id, uploaded.rev);
  cache.fingerprints.set(id, fingerprint(chat));
  cache.owners.set(id, uploaded.ownerId || userKey.userId);
  await syncChatAttachments(chat, id, chatKey, cache);
}

/** Restore remote chats, preserving local-only chats and uploading those. */
export async function restoreVaultChats(
  localChats: Chat[],
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<Chat[]> {
  const summaries = await chatVault.listChats();
  const remoteChats = new Map<string, Chat>();
  const localById = new Map(localChats.map((chat) => [chatId(chat), chat]));

  for (const summary of summaries) {
    const encrypted = await chatVault.getChat(summary.id);
    const envelope = encrypted.envelopes.find(
      (item) => item.recipientId === userKey.userId
    );
    if (!envelope) {
      if (summary.ownerId === userKey.userId && localById.has(summary.id)) {
        cache.revisions.set(summary.id, summary.rev);
        cache.owners.set(summary.id, summary.ownerId);
        console.info(
          "Vault chat %s has no envelope for the current key; re-encrypting from its local copy.",
          summary.id
        );
      } else {
        console.warn(
          "No decryption key is available for vault chat %s",
          summary.id
        );
      }
      continue;
    }

    let chatKey: CryptoKey;
    let chat: Chat;
    try {
      chatKey = await unwrapChatKey(envelope, privateKey);
      chat = await decryptChatData<Chat>(encrypted, chatKey);
    } catch (error) {
      if (summary.ownerId === userKey.userId && localById.has(summary.id)) {
        cache.revisions.set(summary.id, summary.rev);
        cache.owners.set(summary.id, summary.ownerId);
        console.info(
          "Vault chat %s could not be opened with the current key; re-encrypting from its local copy.",
          summary.id
        );
      } else {
        console.warn("Could not decrypt vault chat %s:", summary.id, error);
      }
      continue;
    }
    chat.id = encrypted.id;
    const id = String(encrypted.id);
    const remoteFingerprint = fingerprint(chat);
    ensureChatAttachmentIds(chat);
    remoteChats.set(id, chat);
    cache.revisions.set(id, encrypted.rev);
    // Keep the pre-migration fingerprint so newly assigned legacy attachment
    // IDs are written back into the encrypted chat before files are uploaded.
    cache.fingerprints.set(id, remoteFingerprint);
    cache.owners.set(id, encrypted.ownerId || summary.ownerId);
    cache.chatKeys.set(id, chatKey);
  }

  const localIds = new Set(localChats.map(chatId));
  for (const chat of localChats) {
    if (!remoteChats.has(chatId(chat))) {
      await uploadChat(chat, userKey, cache);
    }
  }

  const merged = localChats.map(
    (chat) => remoteChats.get(chatId(chat)) ?? chat
  );
  for (const [id, chat] of remoteChats) {
    if (!localIds.has(id)) merged.push(chat);
  }
  return merged;
}

/** Upload edits and propagate deletions of chats owned by the current user. */
export async function syncVaultChats(
  chats: Chat[],
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  const currentIds = new Set(chats.map(chatId));
  for (const chat of chats) {
    ensureChatAttachmentIds(chat);
    const id = chatId(chat);
    if (cache.owners.has(id) && cache.owners.get(id) !== userKey.userId) {
      continue;
    }
    if (cache.fingerprints.get(id) !== fingerprint(chat)) {
      await uploadChat(chat, userKey, cache);
    } else {
      const chatKey = cache.chatKeys.get(id);
      if (chatKey) await syncChatAttachments(chat, id, chatKey, cache);
    }
  }

  for (const [id, ownerId] of cache.owners) {
    if (currentIds.has(id) || ownerId !== userKey.userId) continue;
    await chatVault.deleteChat(id);
    cache.owners.delete(id);
    cache.revisions.delete(id);
    cache.fingerprints.delete(id);
    cache.chatKeys.delete(id);
    cache.attachmentIds.delete(id);
    for (const key of cache.attachmentFingerprints.keys()) {
      if (key.startsWith(`${id}\u0000`)) cache.attachmentFingerprints.delete(key);
    }
  }
}
