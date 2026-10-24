import type { Chat } from "../context/types";
import { chatVault, type VaultUserKey } from "./chatVault";
import {
  decryptAttachmentData,
  encryptAttachmentData,
  encryptGroupAttachmentData,
  getAttachmentAdditionalData,
} from "../utils/zeroKnowledgeCrypto";
import { getAttachmentStorageId, getOpfsFile } from "../utils/attachments";
import { getChatAttachmentReferences } from "../utils/chatAttachments";
import type { VaultSyncCache } from "./zeroKnowledgeSyncCache";

type AttachmentReference = ReturnType<
  typeof getChatAttachmentReferences
>[number];
type SyncAttachmentOptions = {
  forceReencrypt?: boolean;
  previousChatKey?: CryptoKey;
  attachmentEpoch?: number;
};

function attachmentCacheKey(chatId: string, attachmentId: string): string {
  return `${chatId}\u0000${attachmentId}`;
}

async function loadAttachmentData(
  reference: AttachmentReference,
  id: string,
  attachmentId: string,
  options: SyncAttachmentOptions,
  knownOnServer: Set<string>
): Promise<{ data: ArrayBuffer; fingerprint: string } | undefined> {
  try {
    const file = await getOpfsFile(reference.opfsName);
    return {
      data: await file.arrayBuffer(),
      fingerprint: `${reference.opfsName}:${file.size}:${file.lastModified}`,
    };
  } catch {
    if (
      !options.forceReencrypt ||
      !options.previousChatKey ||
      !knownOnServer.has(attachmentId)
    ) {
      return undefined;
    }
    try {
      const encrypted = await chatVault.getAttachment(id, attachmentId);
      return {
        data: await decryptAttachmentData(
          encrypted,
          options.previousChatKey,
          getAttachmentAdditionalData(id, attachmentId)
        ),
        fingerprint: `${reference.opfsName}:${reference.size ?? "unknown"}`,
      };
    } catch {
      return undefined;
    }
  }
}

async function syncAttachment(
  reference: AttachmentReference,
  id: string,
  chatKey: CryptoKey,
  cache: VaultSyncCache,
  options: SyncAttachmentOptions,
  knownOnServer: Set<string>
): Promise<string> {
  const attachmentId = await getAttachmentStorageId(
    reference.attachmentId,
    reference.opfsName
  );
  if (!knownOnServer.has(attachmentId)) {
    if (await chatVault.hasAttachment(id, attachmentId)) {
      knownOnServer.add(attachmentId);
    }
  }
  const cacheKey = attachmentCacheKey(id, attachmentId);
  const additionalData = getAttachmentAdditionalData(id, attachmentId);
  const loaded = await loadAttachmentData(
    reference,
    id,
    attachmentId,
    options,
    knownOnServer
  );
  if (!loaded) return attachmentId;

  if (!options.forceReencrypt && knownOnServer.has(attachmentId)) {
    const previousFingerprint = cache.attachmentFingerprints.get(cacheKey);
    if (previousFingerprint === loaded.fingerprint) return attachmentId;
    if (previousFingerprint === undefined) {
      cache.attachmentFingerprints.set(cacheKey, loaded.fingerprint);
      return attachmentId;
    }
  }

  const encrypted = options.attachmentEpoch
    ? await encryptGroupAttachmentData(loaded.data, chatKey, {
        chatId: id,
        attachmentId,
        epoch: options.attachmentEpoch,
      })
    : await encryptAttachmentData(loaded.data, chatKey, additionalData);
  await chatVault.putAttachment(id, attachmentId, encrypted);
  knownOnServer.add(attachmentId);
  cache.attachmentFingerprints.set(cacheKey, loaded.fingerprint);
  return attachmentId;
}

async function deleteRemovedAttachments(
  id: string,
  currentIds: Set<string>,
  knownOnServer: Set<string>,
  cache: VaultSyncCache
): Promise<void> {
  const previouslySynced = cache.attachmentIds.get(id) ?? new Set<string>();
  for (const removedId of previouslySynced) {
    if (currentIds.has(removedId)) continue;
    await chatVault.deleteAttachment(id, removedId);
    knownOnServer.delete(removedId);
    cache.attachmentFingerprints.delete(attachmentCacheKey(id, removedId));
  }
}

export async function syncChatAttachments(
  chat: Chat,
  id: string,
  chatKey: CryptoKey,
  cache: VaultSyncCache,
  options: SyncAttachmentOptions & { skipDelete?: boolean } = {}
): Promise<void> {
  const knownOnServer = new Set(cache.attachmentIds.get(id) ?? []);
  const currentIds = new Set<string>();
  for (const reference of getChatAttachmentReferences(chat)) {
    currentIds.add(
      await syncAttachment(
        reference,
        id,
        chatKey,
        cache,
        options,
        knownOnServer
      )
    );
  }
  if (!options.skipDelete) {
    await deleteRemovedAttachments(id, currentIds, knownOnServer, cache);
  }
  cache.attachmentIds.set(id, knownOnServer);
}

/** Upload a group's attachment bytes before publishing events that reference them. */
export async function syncGroupChatAttachments(
  chat: Chat,
  userKey: VaultUserKey,
  cache: VaultSyncCache
): Promise<void> {
  const id = String(chat.id);
  const runtime = cache.groupChats.get(id);
  if (!runtime || !chat.messages?.length) return;
  if (
    !runtime.group.members.some((member) => member.userId === userKey.userId)
  ) {
    throw new Error("You are no longer an active member of this group");
  }
  const epoch = runtime.group.currentEpoch;
  const epochKey = runtime.epochKeys.get(epoch);
  if (!epochKey)
    throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
  await syncChatAttachments(chat, id, epochKey, cache, {
    attachmentEpoch: epoch,
    skipDelete: true,
  });
}
