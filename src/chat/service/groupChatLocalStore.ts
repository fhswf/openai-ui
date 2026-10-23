/** Local encrypted-event outbox and durable event cursors. */

export type GroupChatOutboxEvent = {
  chatId: string;
  eventId: string;
  epoch: number;
  ciphertext: string;
  iv: string;
  createdAt: number;
};

const DATABASE_NAME = "OpenAIGroupChatSync";
const DATABASE_VERSION = 1;
const OUTBOX_STORE = "outbox";
const CURSOR_STORE = "cursors";

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: "eventId" });
      }
      if (!database.objectStoreNames.contains(CURSOR_STORE)) {
        database.createObjectStore(CURSOR_STORE);
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Group chat storage is blocked"));
  }).catch((error) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

async function useStore<T>(
  name: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(name, mode);
    const request = action(transaction.objectStore(name));
    let result: T;
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function enqueueGroupChatEvent(
  event: GroupChatOutboxEvent
): Promise<void> {
  await useStore<IDBValidKey>(OUTBOX_STORE, "readwrite", (store) => store.put(event));
}

export async function listGroupChatOutbox(
  chatIds?: Set<string>
): Promise<GroupChatOutboxEvent[]> {
  const events = await useStore<GroupChatOutboxEvent[]>(OUTBOX_STORE, "readonly", (store) =>
    store.getAll()
  );
  return events
    .filter((event) => !chatIds || chatIds.has(event.chatId))
    .sort((left, right) => left.createdAt - right.createdAt);
}

export async function getGroupChatOutboxEvent(
  eventId: string
): Promise<GroupChatOutboxEvent | undefined> {
  return useStore<GroupChatOutboxEvent | undefined>(OUTBOX_STORE, "readonly", (store) =>
    store.get(eventId)
  );
}

export async function removeGroupChatOutboxEvent(eventId: string): Promise<void> {
  await useStore<undefined>(OUTBOX_STORE, "readwrite", (store) => store.delete(eventId));
}

function cursorKey(userId: string, chatId: string): string {
  return `${userId}\u0000${chatId}`;
}

export async function loadGroupChatCursor(
  userId: string,
  chatId: string
): Promise<number> {
  const value = await useStore<number | undefined>(CURSOR_STORE, "readonly", (store) =>
    store.get(cursorKey(userId, chatId))
  );
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

export async function saveGroupChatCursor(
  userId: string,
  chatId: string,
  cursor: number
): Promise<void> {
  await useStore<IDBValidKey>(CURSOR_STORE, "readwrite", (store) =>
    store.put(cursor, cursorKey(userId, chatId))
  );
}
