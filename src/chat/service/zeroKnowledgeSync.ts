import type { Chat } from "../context/types";
import {
  chatVault,
  VaultError,
  type VaultChat,
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

export type VaultSyncCache = {
  revisions: Map<string, number>;
  fingerprints: Map<string, string>;
  owners: Map<string, string>;
  chatKeys: Map<string, CryptoKey>;
};

export function createVaultSyncCache(): VaultSyncCache {
  return {
    revisions: new Map(),
    fingerprints: new Map(),
    owners: new Map(),
    chatKeys: new Map(),
  };
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
    remoteChats.set(id, chat);
    cache.revisions.set(id, encrypted.rev);
    cache.fingerprints.set(id, fingerprint(chat));
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
    const id = chatId(chat);
    if (cache.owners.has(id) && cache.owners.get(id) !== userKey.userId) {
      continue;
    }
    if (cache.fingerprints.get(id) !== fingerprint(chat)) {
      await uploadChat(chat, userKey, cache);
    }
  }

  for (const [id, ownerId] of cache.owners) {
    if (currentIds.has(id) || ownerId !== userKey.userId) continue;
    await chatVault.deleteChat(id);
    cache.owners.delete(id);
    cache.revisions.delete(id);
    cache.fingerprints.delete(id);
    cache.chatKeys.delete(id);
  }
}
