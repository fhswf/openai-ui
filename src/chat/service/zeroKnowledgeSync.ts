import type { Chat, ChatVaultDescriptor } from "../context/types";
import {
  chatVault,
  VaultError,
  type VaultChat,
  type VaultChatSummary,
  type VaultGroupChat,
  type VaultUserKey,
} from "./chatVault";
import {
  decryptAttachmentData,
  decryptChatData,
  encryptAttachmentData,
  encryptGroupAttachmentData,
  encryptChatData,
  generateChatKey,
  getAttachmentAdditionalData,
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
import {
  loadGroupChatCursor,
  saveGroupChatCursor,
} from "./groupChatLocalStore";
import { messageToPlainText, matchesChatQuery } from "../utils/chatSearch";
import { getAttachmentStorageId, getOpfsFile } from "../utils/attachments";
import {
  ensureChatAttachmentIds,
  getChatAttachmentReferences,
} from "../utils/chatAttachments";

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

function cacheTranscript(cache: VaultSyncCache, id: string, chat: Chat): void {
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

const PREVIEW_LENGTH = 500;

function attachmentCacheKey(chatId: string, attachmentId: string): string {
  return `${chatId}\u0000${attachmentId}`;
}

async function syncChatAttachments(
  chat: Chat,
  id: string,
  chatKey: CryptoKey,
  cache: VaultSyncCache,
  options: {
    forceReencrypt?: boolean;
    previousChatKey?: CryptoKey;
    attachmentEpoch?: number;
    skipDelete?: boolean;
  } = {}
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
    const additionalData = getAttachmentAdditionalData(id, attachmentId);
    let data: ArrayBuffer;
    let fingerprint: string;
    try {
      // Prefer local files during normal sync. A key rotation must also
      // re-encrypt remote-only attachments with the new chat key.
      const file = await getOpfsFile(reference.opfsName);
      data = await file.arrayBuffer();
      fingerprint = `${reference.opfsName}:${file.size}:${file.lastModified}`;
    } catch {
      if (
        !options.forceReencrypt ||
        !options.previousChatKey ||
        !knownOnServer.has(attachmentId)
      ) {
        continue;
      }
      try {
        const encrypted = await chatVault.getAttachment(id, attachmentId);
        data = await decryptAttachmentData(
          encrypted,
          options.previousChatKey,
          additionalData
        );
        fingerprint = `${reference.opfsName}:${
          reference.size ?? "unknown"
        }`;
      } catch {
        continue;
      }
    }
    if (!options.forceReencrypt && knownOnServer.has(attachmentId)) {
      const previousFingerprint = cache.attachmentFingerprints.get(cacheKey);
      if (previousFingerprint === fingerprint) continue;
      if (previousFingerprint === undefined) {
        cache.attachmentFingerprints.set(cacheKey, fingerprint);
        continue;
      }
    }

    const encrypted = options.attachmentEpoch
      ? await encryptGroupAttachmentData(data, chatKey, {
          chatId: id,
          attachmentId,
          epoch: options.attachmentEpoch,
        })
      : await encryptAttachmentData(data, chatKey, additionalData);
    await chatVault.putAttachment(id, attachmentId, encrypted);
    knownOnServer.add(attachmentId);
    cache.attachmentFingerprints.set(cacheKey, fingerprint);
  }

  const previouslySynced = cache.attachmentIds.get(id) ?? new Set<string>();
  if (!options.skipDelete) {
    for (const removedId of previouslySynced) {
      if (currentIds.has(removedId)) continue;
      await chatVault.deleteAttachment(id, removedId);
      knownOnServer.delete(removedId);
      cache.attachmentFingerprints.delete(attachmentCacheKey(id, removedId));
    }
  }
  cache.attachmentIds.set(id, knownOnServer);
}

/** Upload a group's attachment bytes before publishing events that reference them. */
export async function syncGroupChatAttachments(
  chat: Chat,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  const id = chatId(chat);
  const runtime = cache.groupChats.get(id);
  if (!runtime || !chat.messages?.length) return;
  if (!runtime.group.members.some((member) => member.userId === userKey.userId)) {
    throw new Error("You are no longer an active member of this group");
  }
  const epoch = runtime.group.currentEpoch;
  const epochKey = runtime.epochKeys.get(epoch);
  if (!epochKey) throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
  await syncChatAttachments(chat, id, epochKey, cache, {
    attachmentEpoch: epoch,
    skipDelete: true,
  });
}

function chatId(chat: Chat): string {
  return String(chat.id);
}

function fingerprint(chat: Chat): string {
  // The `vault` descriptor is local bookkeeping only; it must not influence
  // change detection, otherwise marking a chat as vault-backed would look like
  // a content edit and trigger an unnecessary upload.
  const { vault, ...content } = chat;
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
    const id = chatId(chat);
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

async function uploadChat(
  chat: Chat,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  ensureChatAttachmentIds(chat);
  const id = chatId(chat);
  // Keys unwrapped from the vault are deliberately non-extractable, so they
  // cannot be wrapped again. Only reuse an extractable key we generated here;
  // otherwise create a fresh one for this upload.
  const cachedKey = cache.chatKeys.get(id);
  const rotatesChatKey = cachedKey?.extractable !== true;
  const chatKey =
    cachedKey?.extractable === true ? cachedKey : await generateChatKey();
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
  cache.owners.set(id, uploaded.ownerId || userKey.userId);
  await syncChatAttachments(chat, id, chatKey, cache, {
    forceReencrypt: rotatesChatKey,
    previousChatKey: cachedKey,
  });
  cache.chatKeys.set(id, chatKey);
  cache.fingerprints.set(id, fingerprint(chat));
}

type DownloadedChat = {
  chat: Chat;
  rev: number;
  ownerId: string;
};

async function getGroupStateIfAvailable(
  chatId: string
): Promise<VaultGroupChat | null> {
  if (typeof chatVault.getGroupChat !== "function") return null;
  try {
    return await chatVault.getGroupChat(chatId);
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) return null;
    throw error;
  }
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
  let chat: Chat | null = null;

  if (initialKey) {
    try {
      chat = await decryptChatData<Chat>(encrypted, initialKey);
    } catch (error) {
      console.warn("Could not decrypt the initial group chat snapshot:", error);
    }
  }

  if (!chat && local?.messages?.length) {
    chat = { ...local, messages: [...local.messages] };
  }
  if (!chat) {
    // New members without history access can still receive messages from the
    // epoch they joined. The default invitation flow grants history, so this
    // is only the fallback for a deliberately history-limited membership.
    chat = {
      title: summary.id,
      app: 0,
      id: summary.id,
      ct: Date.now(),
      messages: [],
    };
  }

  chat.id = encrypted.id;
  chat.groupChat = true;
  const id = String(encrypted.id);
  const ownerId = encrypted.ownerId || summary.ownerId;
  const runtime = seedGroupChatRuntime(group, epochKeys, 0, chat);
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

  runtime.cursor = cursor;
  runtime.group = { ...group, cursor };
  cache.groupChats.set(id, runtime);
  cache.revisions.set(id, encrypted.rev);
  cache.fingerprints.set(id, fingerprint(chat));
  cache.owners.set(id, ownerId);
  if (initialKey) cache.chatKeys.set(id, initialKey);
  ensureChatAttachmentIds(chat);
  cacheTranscript(cache, id, chat);
  await saveGroupChatCursor(userKey.userId, id, cursor);
  return { chat, rev: encrypted.rev, ownerId };
}

/**
 * Download and decrypt one remote chat. Returns null when the current key
 * cannot open it (missing envelope or failed decryption).
 */
async function downloadChat(
  summary: VaultChatSummary,
  privateKey: CryptoKey,
  userKey: VaultUserKey,
  cache: VaultSyncCache,
  local?: Chat,
  knownGroup?: VaultGroupChat | null
): Promise<DownloadedChat | null> {
  const group = knownGroup === undefined
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
    return null;
  }
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
  const localById = new Map(localChats.map((chat) => [chatId(chat), chat]));
  const restored = new Map<string, Chat>();

  for (const summary of summaries) {
    const local = localById.get(summary.id);
    const group = await getGroupStateIfAvailable(summary.id);
    if (group) {
      const downloaded = await downloadChat(
        summary,
        privateKey,
        userKey,
        cache,
        local,
        group
      );
      if (downloaded) {
        restored.set(
          summary.id,
          lazy
            ? toVaultPlaceholder(downloaded.chat, downloaded.ownerId, downloaded.rev)
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

    const downloaded = await downloadChat(
      summary,
      privateKey,
      userKey,
      cache,
      local,
      null
    );
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

  const localIds = new Set(localChats.map(chatId));
  for (const chat of localChats) {
    if (!restored.has(chatId(chat))) {
      if (chat.groupChat) continue;
      await uploadChat(chat, userKey, cache);
    }
  }

  const merged = localChats.map((chat) => restored.get(chatId(chat)) ?? chat);
  for (const [id, chat] of restored) {
    if (!localIds.has(id)) merged.push(chat);
  }
  return merged;
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
    cache
  );
  if (!downloaded) {
    throw new Error("Could not load the encrypted chat");
  }

  cacheTranscript(cache, id, downloaded.chat);
  return withDescriptor(downloaded.chat, chat, cache, userKey);
}

function withDescriptor(
  chat: Chat,
  previous: Chat,
  cache: VaultSyncCache,
  userKey: VaultUserKey
): Chat {
  const id = chatId(chat);
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
      if (key.startsWith(`${id}\u0000`)) cache.attachmentFingerprints.delete(key);
    }
  }
}
