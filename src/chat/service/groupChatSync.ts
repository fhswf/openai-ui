import type { Chat, Message } from "../context/types";
import {
  chatVault,
  VaultError,
  type VaultGroupChat,
  type VaultGroupEvent,
  type VaultGroupMember,
  type VaultPublicKey,
  type VaultUserKey,
} from "./chatVault";
import {
  decryptChatData,
  decryptGroupChatEvent,
  encryptChatData,
  encryptGroupChatEvent,
  generateChatKey,
  bufferToBase64Url,
  LEGACY_RSA_KEY_ALGORITHM,
  unwrapChatKey,
  wrapChatKey,
  type GroupChatEventContext,
} from "../utils/zeroKnowledgeCrypto";
import {
  enqueueGroupChatEvent,
  type GroupChatOutboxEvent,
} from "./groupChatLocalStore";

export type SavedGroupRoster = {
  id: string;
  name: string;
  members: { userId: string; email: string; publicKeyFingerprint: string }[];
};

type EncryptedRosterCatalog = { version: 1; rosters: SavedGroupRoster[] };

export type GroupChatRuntime = {
  group: VaultGroupChat;
  epochKeys: Map<number, CryptoKey>;
  cursor: number;
  messageFingerprints: Map<string, string>;
  titleFingerprint: string;
};

export type GroupChatOperation =
  | { type: "message.upsert"; message: Message }
  | { type: "message.delete"; messageId: string }
  | { type: "chat.title"; title: string };

export function groupMessageFingerprint(message: Message): string {
  return JSON.stringify(message);
}

export function hasPendingLocalGroupChatChanges(
  chat: Chat,
  runtime: GroupChatRuntime
): boolean {
  if (!chat.groupChat) return false;
  const currentIds = new Set<string>();
  for (const message of chat.messages ?? []) {
    const id = String(message.id);
    currentIds.add(id);
    if (message.role === "assistant" && message.endTime == null) continue;
    if (runtime.messageFingerprints.get(id) !== groupMessageFingerprint(message)) {
      return true;
    }
  }
  if ([...runtime.messageFingerprints.keys()].some((id) => !currentIds.has(id))) {
    return true;
  }
  return runtime.titleFingerprint !== chat.title;
}

export function seedGroupChatRuntime(
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  cursor: number,
  chat: Chat
): GroupChatRuntime {
  return {
    group,
    epochKeys,
    cursor,
    messageFingerprints: new Map(
      (chat.messages ?? []).map((message) => [
        String(message.id),
        groupMessageFingerprint(message),
      ])
    ),
    titleFingerprint: chat.title,
  };
}

export async function unwrapGroupEpochKeys(
  group: VaultGroupChat,
  privateKey: CryptoKey
): Promise<Map<number, CryptoKey>> {
  const keys = new Map<number, CryptoKey>();
  for (const envelope of group.envelopes) {
    keys.set(envelope.epoch, await unwrapChatKey(envelope, privateKey));
  }
  return keys;
}

function eventContext(
  event: Pick<VaultGroupEvent, "chatId" | "eventId" | "epoch">
): GroupChatEventContext {
  return {
    chatId: event.chatId,
    eventId: event.eventId,
    epoch: event.epoch,
  };
}

export async function decryptGroupEvent(
  event: Pick<
    VaultGroupEvent,
    "chatId" | "eventId" | "epoch" | "ciphertext" | "iv"
  >,
  runtime: GroupChatRuntime
): Promise<GroupChatOperation> {
  const key = runtime.epochKeys.get(event.epoch);
  if (!key) {
    throw new Error(`No key is available for group chat epoch ${event.epoch}`);
  }
  const operation = await decryptGroupChatEvent<GroupChatOperation>(
    { ciphertext: event.ciphertext, iv: event.iv },
    key,
    eventContext(event)
  );
  if (!operation || typeof operation !== "object" || !("type" in operation)) {
    throw new Error("The group event has an unsupported format");
  }
  return operation;
}

export function applyGroupOperation(chat: Chat, operation: GroupChatOperation): Chat {
  if (operation.type === "chat.title" && typeof operation.title === "string") {
    return { ...chat, title: operation.title };
  }
  if (operation.type === "message.delete") {
    return {
      ...chat,
      messages: (chat.messages ?? []).filter(
        (message) => String(message.id) !== operation.messageId
      ),
    };
  }
  if (operation.type === "message.upsert" && operation.message) {
    const messages = [...(chat.messages ?? [])];
    const index = messages.findIndex(
      (message) => String(message.id) === String(operation.message.id)
    );
    if (index < 0) messages.push(operation.message);
    else messages[index] = operation.message;
    return { ...chat, messages };
  }
  return chat;
}

async function enqueueOperation(
  chatId: string,
  runtime: GroupChatRuntime,
  operation: GroupChatOperation
): Promise<GroupChatOutboxEvent> {
  const epoch = runtime.group.currentEpoch;
  const key = runtime.epochKeys.get(epoch);
  if (!key) throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
  const eventId = crypto.randomUUID();
  const encrypted = await encryptGroupChatEvent(operation, key, {
    chatId,
    eventId,
    epoch,
  });
  const event = {
    chatId,
    eventId,
    epoch,
    ...encrypted,
    createdAt: Date.now(),
  };
  await enqueueGroupChatEvent(event);
  return event;
}

export function requeueGroupChatOperation(
  chatId: string,
  runtime: GroupChatRuntime,
  operation: GroupChatOperation
): Promise<GroupChatOutboxEvent> {
  return enqueueOperation(chatId, runtime, operation);
}

/** Turn local message/title edits into encrypted, durable outbox events. */
export async function queueLocalGroupChatChanges(
  chat: Chat,
  runtime: GroupChatRuntime
): Promise<number> {
  if (!chat.groupChat) return 0;
  let queued = 0;
  const currentIds = new Set<string>();

  for (const message of chat.messages ?? []) {
    const messageId = String(message.id);
    currentIds.add(messageId);
    const serialized = groupMessageFingerprint(message);
    if (runtime.messageFingerprints.get(messageId) === serialized) continue;
    // Do not publish partial assistant generations. The final message update
    // includes endTime; user messages are complete when they enter the chat.
    if (message.role === "assistant" && message.endTime == null) {
      continue;
    }
    await enqueueOperation(chatIdOf(chat), runtime, {
      type: "message.upsert",
      message,
    });
    runtime.messageFingerprints.set(messageId, serialized);
    queued += 1;
  }

  for (const messageId of runtime.messageFingerprints.keys()) {
    if (currentIds.has(messageId)) continue;
    await enqueueOperation(chatIdOf(chat), runtime, {
      type: "message.delete",
      messageId,
    });
    runtime.messageFingerprints.delete(messageId);
    queued += 1;
  }

  if (runtime.titleFingerprint !== chat.title) {
    await enqueueOperation(chatIdOf(chat), runtime, {
      type: "chat.title",
      title: chat.title,
    });
    runtime.titleFingerprint = chat.title;
    queued += 1;
  }
  return queued;
}

function chatIdOf(chat: Chat): string {
  return String(chat.id);
}

export function rememberAppliedGroupOperation(
  runtime: GroupChatRuntime,
  operation: GroupChatOperation
): void {
  if (operation.type === "message.upsert") {
    runtime.messageFingerprints.set(
      String(operation.message.id),
      groupMessageFingerprint(operation.message)
    );
  } else if (operation.type === "message.delete") {
    runtime.messageFingerprints.delete(operation.messageId);
  } else if (operation.type === "chat.title") {
    runtime.titleFingerprint = operation.title;
  }
}

async function getCatalog(
  privateKey: CryptoKey
): Promise<{ catalog: EncryptedRosterCatalog; key: CryptoKey; rev: number } | null> {
  try {
    const encrypted = await chatVault.getGroupCatalog();
    const key = await unwrapChatKey(encrypted.selfEnvelope, privateKey);
    const catalog = await decryptChatData<EncryptedRosterCatalog>(encrypted, key);
    return { catalog, key, rev: encrypted.rev };
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) return null;
    throw error;
  }
}

export async function loadSavedGroupRosters(
  privateKey: CryptoKey
): Promise<SavedGroupRoster[]> {
  const saved = await getCatalog(privateKey);
  return saved?.catalog.version === 1 ? saved.catalog.rosters : [];
}

export async function publicKeyFingerprint(key: VaultPublicKey): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key.publicKey)
  );
  return bufferToBase64Url(digest);
}

export async function lookupGroupInviteTarget(
  email: string
): Promise<{ userId: string; email: string; publicKeyFingerprint: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter a member email address");
  const key = await chatVault.lookupKeyByEmail(normalizedEmail);
  return {
    userId: key.userId,
    email: normalizedEmail,
    publicKeyFingerprint: await publicKeyFingerprint(key),
  };
}

export async function saveGroupRoster(
  userKey: VaultUserKey,
  privateKey: CryptoKey,
  name: string,
  emails: string[]
): Promise<SavedGroupRoster[]> {
  const cleanedName = name.trim();
  if (!cleanedName) throw new Error("Enter a name for this group");
  const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (uniqueEmails.length < 1) throw new Error("Add at least one group member");

  const members = await Promise.all(
    uniqueEmails.map(async (email) => {
      const key = await chatVault.lookupKeyByEmail(email);
      if (key.userId === userKey.userId) {
        throw new Error("Your account is added automatically to each group");
      }
      return {
        userId: key.userId,
        email,
        publicKeyFingerprint: await publicKeyFingerprint(key),
      };
    })
  );
  if (new Set(members.map((member) => member.userId)).size !== members.length) {
    throw new Error("The same account was added more than once");
  }

  const previous = await getCatalog(privateKey);
  const roster: SavedGroupRoster = {
    id: crypto.randomUUID(),
    name: cleanedName,
    members,
  };
  const next = {
    version: 1 as const,
    rosters: [...(previous?.catalog.rosters ?? []), roster],
  };
  const key = previous?.key ?? await generateChatKey();
  const encrypted = await encryptChatData(next, key);
  const wrapped = await wrapChatKey(
    key,
    userKey.publicKey,
    userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
  );
  await chatVault.putGroupCatalog({
    ...encrypted,
    selfEnvelope: { recipientId: userKey.userId, ...wrapped },
    ...(previous ? { baseRev: previous.rev } : {}),
  });
  return next.rosters;
}

export async function deleteGroupRoster(
  userKey: VaultUserKey,
  privateKey: CryptoKey,
  rosterId: string
): Promise<SavedGroupRoster[]> {
  const previous = await getCatalog(privateKey);
  if (!previous) return [];
  const next = {
    ...previous.catalog,
    rosters: previous.catalog.rosters.filter((roster) => roster.id !== rosterId),
  };
  const encrypted = await encryptChatData(next, previous.key);
  await chatVault.putGroupCatalog({
    ...encrypted,
    selfEnvelope: {
      recipientId: userKey.userId,
      ...(await wrapChatKey(
        previous.key,
        userKey.publicKey,
        userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      )),
    },
    baseRev: previous.rev,
  });
  return next.rosters;
}

async function resolveRosterPublicKeys(
  roster: SavedGroupRoster,
  ownerId: string
): Promise<{ userId: string; publicKey: VaultPublicKey }[]> {
  const resolved = await Promise.all(
    roster.members.map(async (member) => {
      const publicKey = await chatVault.getPublicKey(member.userId);
      const fingerprint = await publicKeyFingerprint(publicKey);
      if (fingerprint !== member.publicKeyFingerprint) {
        throw new Error(
          `The registered key for ${member.email} changed. Verify their new key before sharing.`
        );
      }
      return { userId: member.userId, publicKey };
    })
  );
  if (resolved.some((member) => member.userId === ownerId)) {
    throw new Error("The roster unexpectedly contains your account");
  }
  return resolved;
}

export async function createVaultGroupChat(
  chatId: string,
  roster: SavedGroupRoster,
  userKey: VaultUserKey,
  privateKey: CryptoKey,
  chatKey: CryptoKey
): Promise<VaultGroupChat> {
  const recipientKeys = await resolveRosterPublicKeys(roster, userKey.userId);
  const members = [userKey.userId, ...recipientKeys.map((member) => member.userId)];
  const publicKeys = [
    {
      userId: userKey.userId,
      publicKey: {
        userId: userKey.userId,
        publicKey: userKey.publicKey,
        publicKeyAlgorithm: userKey.publicKeyAlgorithm,
      } satisfies VaultPublicKey,
    },
    ...recipientKeys,
  ];
  const envelopes = await Promise.all(
    publicKeys.map(async ({ userId, publicKey }) => ({
      recipientId: userId,
      ...(await wrapChatKey(
        chatKey,
        publicKey.publicKey,
        publicKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      )),
    }))
  );
  await chatVault.createGroupChat(chatId, { members, envelopes });
  const group = await chatVault.getGroupChat(chatId);
  const keys = new Map([[1, chatKey]]);
  for (const envelope of group.envelopes) {
    if (!keys.has(envelope.epoch)) {
      keys.set(envelope.epoch, await unwrapChatKey(envelope, privateKey));
    }
  }
  return group;
}

async function rotateGroupMembership(
  chatId: string,
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  memberIds: string[],
  addedMemberIds: Set<string>
): Promise<{ group: VaultGroupChat; epochKeys: Map<number, CryptoKey> }> {
  const nextEpoch = group.currentEpoch + 1;
  const nextKey = await generateChatKey();
  const currentKeys = await Promise.all(
    memberIds.map(async (userId) => ({
      userId,
      key: await chatVault.getPublicKey(userId),
    }))
  );
  const envelopes: (Awaited<ReturnType<typeof wrapChatKey>> & {
    recipientId: string;
    epoch: number;
  })[] = [];

  for (const { userId, key } of currentKeys) {
    envelopes.push({
      recipientId: userId,
      epoch: nextEpoch,
      ...(await wrapChatKey(
        nextKey,
        key.publicKey,
        key.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      )),
    });
    if (addedMemberIds.has(userId)) {
      for (const [epoch, epochKey] of epochKeys) {
        envelopes.push({
          recipientId: userId,
          epoch,
          ...(await wrapChatKey(
            epochKey,
            key.publicKey,
            key.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
          )),
        });
      }
    }
  }

  await chatVault.updateGroupMembership(chatId, {
    baseEpoch: group.currentEpoch,
    members: memberIds,
    envelopes,
  });
  const updated = await chatVault.getGroupChat(chatId);
  const nextEpochKeys = new Map(epochKeys);
  nextEpochKeys.set(nextEpoch, nextKey);
  return { group: updated, epochKeys: nextEpochKeys };
}

export async function inviteVaultGroupMember(
  chatId: string,
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  email: string,
  currentUserId: string,
  expectedFingerprint: string
): Promise<{ group: VaultGroupChat; epochKeys: Map<number, CryptoKey> }> {
  if (group.ownerId !== currentUserId) {
    throw new Error("Only the group owner can change membership");
  }
  for (let epoch = 1; epoch <= group.currentEpoch; epoch += 1) {
    if (!epochKeys.has(epoch)) {
      throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
    }
  }
  const recipient = await chatVault.lookupKeyByEmail(email.trim());
  if ((await publicKeyFingerprint(recipient)) !== expectedFingerprint) {
    throw new Error("The registered key changed. Verify the new fingerprint before inviting this member.");
  }
  if (recipient.userId === currentUserId) {
    throw new Error("You are already a member of this group");
  }
  if (group.members.some((member) => member.userId === recipient.userId)) {
    throw new Error("This person is already a member of the group");
  }
  return rotateGroupMembership(
    chatId,
    group,
    epochKeys,
    [...group.members.map((member) => member.userId), recipient.userId],
    new Set([recipient.userId])
  );
}

export async function removeVaultGroupMember(
  chatId: string,
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  memberId: string,
  currentUserId: string
): Promise<{ group: VaultGroupChat; epochKeys: Map<number, CryptoKey> }> {
  if (group.ownerId !== currentUserId) {
    throw new Error("Only the group owner can change membership");
  }
  if (memberId === group.ownerId) {
    throw new Error("The group owner cannot remove themself");
  }
  if (!group.members.some((member) => member.userId === memberId)) return { group, epochKeys };
  return rotateGroupMembership(
    chatId,
    group,
    epochKeys,
    group.members.filter((member) => member.userId !== memberId).map((member) => member.userId),
    new Set()
  );
}

export function activeGroupMemberIds(group: VaultGroupChat): string[] {
  return group.members.map((member: VaultGroupMember) => member.userId);
}
