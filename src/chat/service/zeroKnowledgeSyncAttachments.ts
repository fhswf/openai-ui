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

function attachmentCacheKey(chatId: string, attachmentId: string): string {
  return `${chatId}\u0000${attachmentId}`;
}

export async function syncChatAttachments(
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
        fingerprint = `${reference.opfsName}:${reference.size ?? "unknown"}`;
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
