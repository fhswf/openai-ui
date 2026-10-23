import type { Chat, Message } from "../context/types";
import type { VaultGroupChat, VaultGroupEvent } from "./chatVault";
import {
  decryptGroupChatEvent,
  encryptGroupChatEvent,
  unwrapChatKey,
  type GroupChatEventContext,
} from "../utils/zeroKnowledgeCrypto";
import {
  enqueueGroupChatEvent,
  type GroupChatOutboxEvent,
} from "./groupChatLocalStore";

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
    if (
      runtime.messageFingerprints.get(id) !== groupMessageFingerprint(message)
    ) {
      return true;
    }
  }
  if (
    [...runtime.messageFingerprints.keys()].some((id) => !currentIds.has(id))
  ) {
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

export function applyGroupOperation(
  chat: Chat,
  operation: GroupChatOperation
): Chat {
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
  if (!key)
    throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
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

// Keep the previous service entry point available for existing consumers.
export type { SavedGroupRoster } from "./groupChatRosters";
export {
  deleteGroupRoster,
  loadSavedGroupRosters,
  lookupGroupInviteTarget,
  publicKeyFingerprint,
  saveGroupRoster,
} from "./groupChatRosters";
export {
  activeGroupMemberIds,
  createVaultGroupChat,
  inviteVaultGroupMember,
  removeVaultGroupMember,
} from "./groupChatMembership";
