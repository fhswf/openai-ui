import type { Chat, ChatVaultDescriptor } from "../context/types";
import type { VaultUserKey } from "./chatVault";
import type { GroupChatRuntime } from "./groupChatSync";
import { messageToPlainText } from "../utils/chatSearch";

export type VaultSyncCache = {
  revisions: Map<string, number>;
  fingerprints: Map<string, string>;
  owners: Map<string, string>;
  chatKeys: Map<string, CryptoKey>;
  /**
   * Full transcripts fetched during this session. Lazy history keeps these in
   * memory only, so the localStorage copy stays a small placeholder list.
   */
  transcripts: Map<string, Chat>;
  attachmentFingerprints: Map<string, string>;
  attachmentIds: Map<string, Set<string>>;
  groupChats: Map<string, GroupChatRuntime>;
};

/** Upper bound for the in-memory transcript cache (oldest entries are dropped). */
const MAX_CACHED_TRANSCRIPTS = 20;
const PREVIEW_LENGTH = 500;

export function cacheTranscript(
  cache: VaultSyncCache,
  id: string,
  chat: Chat
): void {
  cache.transcripts.set(id, chat);
  while (cache.transcripts.size > MAX_CACHED_TRANSCRIPTS) {
    const oldest = cache.transcripts.keys().next().value;
    if (oldest === undefined || oldest === id) break;
    cache.transcripts.delete(oldest);
  }
}

export function createVaultSyncCache(): VaultSyncCache {
  return {
    revisions: new Map(),
    fingerprints: new Map(),
    owners: new Map(),
    chatKeys: new Map(),
    transcripts: new Map(),
    attachmentFingerprints: new Map(),
    attachmentIds: new Map(),
    groupChats: new Map(),
  };
}

export function chatId(chat: Chat): string {
  return String(chat.id);
}

export function isLegacyNumericChatId(id: string): boolean {
  return /^\d+$/.test(id);
}

export function fingerprint(chat: Chat): string {
  // The `vault` descriptor is local bookkeeping only; it must not influence
  // change detection, otherwise marking a chat as vault-backed would look like
  // a content edit and trigger an unnecessary upload.
  const content = Object.fromEntries(
    Object.entries(chat).filter(([key]) => key !== "vault")
  );
  return JSON.stringify(content);
}

function firstUserPreview(chat: Chat): string {
  const message =
    chat.messages.find((item) => item.role === "user") ?? chat.messages[0];
  if (!message) return "";
  return messageToPlainText(message).slice(0, PREVIEW_LENGTH);
}

/** Build the small descriptor that stands in for a vault chat locally. */
export function describeVaultChat(
  chat: Chat,
  ownerId: string,
  rev: number
): ChatVaultDescriptor {
  return {
    rev,
    ownerId,
    messageCount: chat.messages.length,
    preview: firstUserPreview(chat),
    updatedAt: chat.ct,
  };
}

/**
 * Add or refresh the vault descriptor of every chat that lives in the vault.
 * Keeping the marker lets the persistence layer drop transcripts that can be
 * re-downloaded. Returns null when nothing changed.
 */
export function markVaultChats(
  chats: Chat[],
  cache: VaultSyncCache,
  userKey: VaultUserKey
): Chat[] | null {
  let changed = false;
  const marked = chats.map((chat) => {
    const id = String(chat.id);
    const rev = cache.revisions.get(id);
    if (rev === undefined) {
      return chat;
    }
    const ownerId = cache.owners.get(id) ?? userKey.userId;

    if (chat.vault) {
      if (chat.vault.rev === rev && chat.vault.ownerId === ownerId) {
        return chat;
      }
      changed = true;
      // A placeholder has no messages, so keep its stored count and preview.
      return {
        ...chat,
        vault: chat.messages?.length
          ? describeVaultChat(chat, ownerId, rev)
          : { ...chat.vault, rev, ownerId },
      };
    }

    changed = true;
    return {
      ...chat,
      vault: describeVaultChat(chat, ownerId, rev),
    };
  });
  return changed ? marked : null;
}

/**
 * Reduce a full transcript to the small descriptor that is kept in
 * localStorage. The messages are dropped and fetched from the vault on demand.
 */
export function toVaultPlaceholder(
  chat: Chat,
  ownerId: string,
  rev: number
): Chat {
  return {
    title: chat.title,
    app: chat.app,
    id: chat.id,
    thread: chat.thread,
    ct: chat.ct,
    botStarts: chat.botStarts,
    groupChat: chat.groupChat,
    messages: [],
    vault: describeVaultChat(chat, ownerId, rev),
  };
}

/**
 * Reduce a hydrated vault chat back to its lightweight placeholder, keeping the
 * vault descriptor so the transcript can be fetched again on demand.
 */
export function demoteVaultChat(chat: Chat): Chat {
  const descriptor = chat.vault;
  if (!descriptor) return chat;
  return {
    ...toVaultPlaceholder(chat, descriptor.ownerId, descriptor.rev),
    vault: {
      ...descriptor,
      messageCount: chat.messages?.length ?? descriptor.messageCount,
    },
  };
}

export function withDescriptor(
  chat: Chat,
  previous: Chat,
  cache: VaultSyncCache,
  userKey: VaultUserKey
): Chat {
  const id = String(chat.id);
  return {
    ...chat,
    id: previous.id,
    vault: describeVaultChat(
      chat,
      cache.owners.get(id) ?? previous.vault?.ownerId ?? userKey.userId,
      cache.revisions.get(id) ?? previous.vault?.rev ?? 0
    ),
  };
}
