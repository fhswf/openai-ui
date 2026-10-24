import { v5 as uuidv5 } from "uuid";
import type { Chat } from "../context/types";
import {
  chatVault,
  type VaultChatSummary,
  type VaultGroupChat,
  type VaultUserKey,
} from "./chatVault";
import { matchesChatQuery } from "../utils/chatSearch";
import { ensureChatAttachmentIds } from "../utils/chatAttachments";
import {
  cacheTranscript,
  chatId,
  createVaultSyncCache,
  describeVaultChat,
  demoteVaultChat,
  fingerprint,
  isLegacyNumericChatId,
  markVaultChats,
  toVaultPlaceholder,
  withDescriptor,
  type VaultSyncCache,
} from "./zeroKnowledgeSyncCache";
import {
  downloadChat,
  getGroupStateIfAvailable,
  isVaultDecryptionFailure,
  uploadChat,
  type DownloadedChat,
} from "./zeroKnowledgeSyncTransfers";
import { syncChatAttachments } from "./zeroKnowledgeSyncAttachments";

export {
  createVaultSyncCache,
  describeVaultChat,
  demoteVaultChat,
  markVaultChats,
  toVaultPlaceholder,
};
export type { VaultSyncCache } from "./zeroKnowledgeSyncCache";
export { isVaultDecryptionFailure } from "./zeroKnowledgeSyncTransfers";
export { syncGroupChatAttachments } from "./zeroKnowledgeSyncAttachments";

function migrateLegacyChatId(chat: Chat, userId: string): Chat {
  const id = chatId(chat);
  if (!isLegacyNumericChatId(id)) return chat;

  // Derive this ID from the account and old ID so retries and other devices
  // converge on the same replacement while different accounts stay isolated.
  return {
    ...chat,
    id: uuidv5(`openai-ui:legacy-chat:${userId}:${id}`, uuidv5.URL),
  };
}

function createUnreadableVaultChat(
  summary: VaultChatSummary,
  userKey: VaultUserKey,
  local?: Chat,
  group?: VaultGroupChat | null
): Chat {
  const ownerId = summary.ownerId || group?.ownerId || userKey.userId;
  const updatedAt = Date.parse(summary.updatedAt);
  const chatTime = Number.isFinite(updatedAt) ? updatedAt : Date.now();
  return {
    ...(local ?? {
      title: "",
      app: 0,
      id: summary.id,
      ct: chatTime,
      messages: [],
    }),
    id: summary.id,
    groupChat: Boolean(group) || local?.groupChat,
    vault: {
      rev: summary.rev,
      ownerId,
      messageCount: local?.vault?.messageCount ?? local?.messages?.length ?? 0,
      preview: local?.vault?.preview ?? "",
      updatedAt: chatTime,
      restoreError: "decrypt_failed",
      canDelete: ownerId === userKey.userId,
    },
  };
}

/**
 * Restore remote chats, preserving local-only chats and uploading those.
 *
 * With `lazy` enabled, only a lightweight placeholder per remote chat is kept
 * in state (and therefore in localStorage). The transcript is cached in memory
 * and fetched again on demand when the chat is opened or searched. Placeholders
 * are reused across sessions while their vault revision is unchanged, so a
 * later load does not download the complete history again.
 */
export async function restoreVaultChats(
  localChats: Chat[],
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache,
  options: { lazy?: boolean } = {}
): Promise<Chat[]> {
  const lazy = options.lazy ?? false;
  const summaries = await chatVault.listChats();
  const ownedChatIds = new Set(
    summaries
      .filter((summary) => summary.ownerId === userKey.userId)
      .map((summary) => summary.id)
  );
  const normalizedLocalChats = localChats.map((chat) => {
    const id = chatId(chat);
    return isLegacyNumericChatId(id) && !ownedChatIds.has(id)
      ? migrateLegacyChatId(chat, userKey.userId)
      : chat;
  });
  const localById = new Map(
    normalizedLocalChats.map((chat) => [chatId(chat), chat])
  );
  const restored = new Map<string, Chat>();

  for (const summary of summaries) {
    const local = localById.get(summary.id);
    const group = await getGroupStateIfAvailable(summary.id);
    if (group) {
      let downloaded: DownloadedChat | null;
      try {
        downloaded = await downloadChat(
          summary,
          privateKey,
          userKey,
          cache,
          local,
          group,
          { throwOnDecryptFailure: true }
        );
      } catch (error) {
        if (!isVaultDecryptionFailure(error)) throw error;
        cache.revisions.set(summary.id, summary.rev);
        cache.owners.set(summary.id, summary.ownerId || group.ownerId);
        restored.set(
          summary.id,
          createUnreadableVaultChat(summary, userKey, local, group)
        );
        continue;
      }
      if (downloaded) {
        restored.set(
          summary.id,
          lazy
            ? toVaultPlaceholder(
                downloaded.chat,
                downloaded.ownerId,
                downloaded.rev
              )
            : downloaded.chat
        );
      } else if (local) {
        restored.set(summary.id, { ...local, groupChat: true });
      }
      continue;
    }

    if (
      lazy &&
      local?.vault &&
      local.vault.rev === summary.rev &&
      local.vault.ownerId === summary.ownerId
    ) {
      cache.revisions.set(summary.id, summary.rev);
      cache.owners.set(summary.id, summary.ownerId);
      restored.set(summary.id, local);
      continue;
    }

    // When the transcript is already available locally, derive the placeholder
    // from it instead of downloading the whole history again.
    if (lazy && local?.messages?.length) {
      cache.revisions.set(summary.id, summary.rev);
      cache.owners.set(summary.id, summary.ownerId);
      const localFingerprint = fingerprint(local);
      ensureChatAttachmentIds(local);
      cache.fingerprints.set(summary.id, localFingerprint);
      cacheTranscript(cache, summary.id, local);
      restored.set(
        summary.id,
        toVaultPlaceholder(local, summary.ownerId, summary.rev)
      );
      continue;
    }

    let downloaded: DownloadedChat | null;
    try {
      downloaded = await downloadChat(
        summary,
        privateKey,
        userKey,
        cache,
        local,
        null,
        { throwOnDecryptFailure: true }
      );
    } catch (error) {
      if (!isVaultDecryptionFailure(error)) throw error;
      cache.revisions.set(summary.id, summary.rev);
      cache.owners.set(summary.id, summary.ownerId);
      restored.set(
        summary.id,
        createUnreadableVaultChat(summary, userKey, local)
      );
      continue;
    }
    if (!downloaded) {
      if (summary.ownerId === userKey.userId && local?.messages?.length) {
        // The remote copy cannot be opened with the current key. Leave it out
        // of `restored` so the local transcript is re-encrypted and uploaded.
        cache.revisions.set(summary.id, summary.rev);
        cache.owners.set(summary.id, summary.ownerId);
        console.info(
          "Vault chat %s could not be opened with the current key; re-encrypting from its local copy.",
          summary.id
        );
      } else if (local) {
        // Shared chats that cannot be opened are shown as-is and never
        // overwritten with a possibly stale local copy.
        restored.set(summary.id, local);
      }
      continue;
    }

    cacheTranscript(cache, summary.id, downloaded.chat);
    restored.set(
      summary.id,
      lazy
        ? toVaultPlaceholder(
            downloaded.chat,
            downloaded.ownerId,
            downloaded.rev
          )
        : downloaded.chat
    );
  }

  const localIds = new Set(normalizedLocalChats.map(chatId));
  for (const chat of normalizedLocalChats) {
    if (!restored.has(chatId(chat))) {
      if (chat.groupChat) continue;
      await uploadChat(chat, userKey, cache);
    }
  }

  const merged = normalizedLocalChats.map(
    (chat) => restored.get(chatId(chat)) ?? chat
  );
  for (const [id, chat] of restored) {
    if (!localIds.has(id)) merged.push(chat);
  }
  return merged.sort((left, right) => right.ct - left.ct);
}

/**
 * Return the full transcript for a chat, downloading it from the vault when it
 * is only available as a placeholder or was not fetched yet this session. The
 * returned chat keeps a `vault` descriptor so the persistence layer may still
 * drop the transcript after the next save.
 */
export async function hydrateVaultChat(
  chat: Chat,
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<Chat> {
  const id = chatId(chat);
  const cached = cache.transcripts.get(id);
  if (cached) {
    return withDescriptor(cached, chat, cache, userKey);
  }

  const downloaded = await downloadChat(
    {
      id,
      ownerId: chat.vault?.ownerId ?? userKey.userId,
      updatedAt: "",
      rev: chat.vault?.rev ?? 0,
    },
    privateKey,
    userKey,
    cache,
    undefined,
    undefined,
    { throwOnDecryptFailure: true }
  );
  if (!downloaded) {
    throw new Error("Could not load the encrypted chat");
  }

  cacheTranscript(cache, id, downloaded.chat);
  return withDescriptor(downloaded.chat, chat, cache, userKey);
}

/**
 * Search the complete history, including chats that are only placeholders.
 * Placeholders are downloaded one at a time and kept hydrated only when they
 * match, so a search does not fill the browser storage with every transcript.
 */
export async function searchVaultChats(
  chats: Chat[],
  query: string,
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<Chat[]> {
  const result: Chat[] = [];
  for (const chat of chats) {
    if (!chat.vault || chat.messages?.length) {
      if (matchesChatQuery(chat, query)) {
        result.push(chat);
      }
      continue;
    }

    let candidate = chat;
    try {
      candidate = await hydrateVaultChat(chat, privateKey, userKey, cache);
    } catch (error) {
      console.warn("Could not load vault chat %s for search:", chat.id, error);
      if (matchesChatQuery(chat, query)) {
        result.push(chat);
      }
      continue;
    }

    if (matchesChatQuery(candidate, query)) {
      cacheTranscript(cache, chatId(chat), candidate);
      result.push(candidate);
    }
  }
  return result;
}

/** Upload edits and propagate deletions of chats owned by the current user. */
export async function syncVaultChats(
  chats: Chat[],
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  const currentIds = new Set(chats.map(chatId));
  for (const chat of chats) {
    if (chat.vault?.restoreError) continue;
    ensureChatAttachmentIds(chat);
    const id = chatId(chat);
    if (chat.groupChat || cache.groupChats.has(id)) {
      const runtime = cache.groupChats.get(id);
      const epoch = runtime?.group.currentEpoch;
      const epochKey = epoch ? runtime?.epochKeys.get(epoch) : undefined;
      const isActiveMember = runtime?.group.members.some(
        (member) => member.userId === userKey.userId
      );
      if (epochKey && isActiveMember && chat.messages?.length) {
        await syncChatAttachments(chat, id, epochKey, cache, {
          attachmentEpoch: epoch,
          skipDelete: true,
        });
      }
      continue;
    }
    // A placeholder holds no transcript. Uploading it would replace the remote
    // history with an empty chat, so it is skipped until it has been hydrated.
    if (chat.vault && !chat.messages?.length) {
      continue;
    }
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
    cache.groupChats.delete(id);
    cache.transcripts.delete(id);
    cache.attachmentIds.delete(id);
    for (const key of cache.attachmentFingerprints.keys()) {
      if (key.startsWith(`${id}\u0000`))
        cache.attachmentFingerprints.delete(key);
    }
  }
}
