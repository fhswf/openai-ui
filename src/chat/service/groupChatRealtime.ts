import { getVaultBaseUrl } from "./chatVault";
import type { VaultGroupEvent } from "./chatVault";
import {
  getGroupChatOutboxEvent,
  listGroupChatOutbox,
  removeGroupChatOutboxEvent,
  type GroupChatOutboxEvent,
} from "./groupChatLocalStore";

export type GroupChatSubscription = { chatId: string; cursor: number };

type RealtimeCallbacks = {
  onEvent: (event: VaultGroupEvent) => Promise<number>;
  onOutboxError?: (
    event: GroupChatOutboxEvent | undefined,
    code: string,
    message: string
  ) => Promise<void> | void;
};

function socketUrl(): string {
  const url = new URL(`${getVaultBaseUrl()}/ws`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/** Authenticated live delivery with cursor catch-up and an encrypted IDB outbox. */
export class GroupChatRealtimeClient {
  private readonly callbacks: RealtimeCallbacks;
  private socket: WebSocket | null = null;
  private subscriptions = new Map<string, number>();
  private cursors = new Map<string, number>();
  private sent = new Set<string>();
  private messageQueue = Promise.resolve();
  private reconnectTimer: number | null = null;
  private retryTimer: number | null = null;
  private reconnectDelay = 500;
  private stopped = true;
  private ready = false;
  private flushing = false;

  constructor(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    window.addEventListener("online", this.handleOnline);
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    window.removeEventListener("online", this.handleOnline);
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.ready = false;
    this.sent.clear();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
  }

  setSubscriptions(subscriptions: GroupChatSubscription[]): void {
    const next = new Map(subscriptions.map(({ chatId, cursor }) => [chatId, cursor]));
    if (this.ready && this.socket) {
      for (const chatId of this.subscriptions.keys()) {
        if (!next.has(chatId)) {
          this.send({ type: "unsubscribe", chatId });
          this.cursors.delete(chatId);
        }
      }
    }
    this.subscriptions = next;
    for (const [chatId, cursor] of next) {
      if (!this.cursors.has(chatId)) this.cursors.set(chatId, cursor);
    }
    if (this.ready) {
      this.subscribeAll();
      void this.flushOutbox();
    }
  }

  flushPendingEvents(): void {
    void this.flushOutbox();
  }

  private handleOnline = (): void => {
    this.connect();
  };

  private connect(): void {
    if (
      this.stopped ||
      !navigator.onLine ||
      this.socket ||
      typeof WebSocket === "undefined"
    ) {
      return;
    }

    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl());
    } catch (error) {
      console.warn("Could not open group chat WebSocket:", error);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onmessage = (message) => {
      this.messageQueue = this.messageQueue
        .then(() => this.processMessage(String(message.data)))
        .catch((error) => {
          console.error("Could not process a group chat update:", error);
        });
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.ready = false;
      this.sent.clear();
      this.scheduleReconnect();
    };
    socket.onerror = () => socket.close();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer !== null) return;
    const delay = this.reconnectDelay + Math.floor(Math.random() * 250);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(message: Record<string, unknown>): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  private subscribeAll(): void {
    for (const [chatId] of this.subscriptions) {
      this.send({
        type: "subscribe",
        chatId,
        after: this.cursors.get(chatId) ?? this.subscriptions.get(chatId) ?? 0,
      });
    }
  }

  private async processMessage(raw: string): Promise<void> {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    if (message.type === "ready") {
      this.ready = true;
      this.reconnectDelay = 500;
      this.subscribeAll();
      await this.flushOutbox();
      return;
    }

    if (message.type === "event" && message.event && typeof message.event === "object") {
      const event = message.event as VaultGroupEvent;
      const previous = this.cursors.get(event.chatId) ?? 0;
      if (event.sequence <= previous) return;
      const cursor = await this.callbacks.onEvent(event);
      this.cursors.set(event.chatId, cursor);
      return;
    }

    if (message.type === "catchup_complete" && message.chatId) {
      const chatId = String(message.chatId);
      if (message.hasMore === true && this.subscriptions.has(chatId)) {
        this.send({
          type: "subscribe",
          chatId,
          after: this.cursors.get(chatId) ?? 0,
        });
      }
      return;
    }

    if (message.type === "ack" && typeof message.eventId === "string") {
      await removeGroupChatOutboxEvent(message.eventId);
      this.sent.delete(message.eventId);
      void this.flushOutbox();
      return;
    }

    if (message.type === "error" && typeof message.requestId === "string") {
      const eventId = message.requestId;
      const code = String(message.code ?? "internal");
      const event = await getGroupChatOutboxEvent(eventId);
      this.sent.delete(eventId);
      if (["conflict", "forbidden", "not_found", "invalid_payload"].includes(code)) {
        if (code === "conflict") {
          await this.callbacks.onOutboxError?.(
            event,
            code,
            String(message.message ?? "The group could not accept a pending message")
          );
          await removeGroupChatOutboxEvent(eventId);
        } else {
          await removeGroupChatOutboxEvent(eventId);
          await this.callbacks.onOutboxError?.(
            event,
            code,
            String(message.message ?? "The group could not accept a pending message")
          );
        }
        void this.flushOutbox();
      } else if (this.retryTimer === null) {
        this.retryTimer = window.setTimeout(() => {
          this.retryTimer = null;
          void this.flushOutbox();
        }, 1500);
      }
    }
  }

  private async flushOutbox(): Promise<void> {
    if (!this.ready || this.flushing || !this.socket) return;
    this.flushing = true;
    try {
      const activeChatIds = new Set(this.subscriptions.keys());
      const pending = await listGroupChatOutbox(activeChatIds);
      for (const event of pending) {
        if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) break;
        if (this.sent.has(event.eventId)) continue;
        const accepted = this.send({
          type: "append",
          requestId: event.eventId,
          chatId: event.chatId,
          eventId: event.eventId,
          epoch: event.epoch,
          ciphertext: event.ciphertext,
          iv: event.iv,
        });
        if (!accepted) break;
        this.sent.add(event.eventId);
      }
    } catch (error) {
      console.warn("Could not flush pending group chat events:", error);
    } finally {
      this.flushing = false;
    }
  }
}
