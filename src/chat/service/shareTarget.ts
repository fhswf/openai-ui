import type { SharedTargetContent } from "../context/types";

const SHARE_DB_NAME = "kimpuls-share-target";
const SHARE_STORE_NAME = "shares";

type StoredShare = SharedTargetContent & { id: string };

function openShareDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SHARE_STORE_NAME)) {
        request.result.createObjectStore(SHARE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open shared content"));
  });
}

/** Reads and removes a one-time share payload written by the service worker. */
export async function consumeSharedContent(
  id: string
): Promise<SharedTargetContent | null> {
  const database = await openShareDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(SHARE_STORE_NAME, "readwrite");
    const store = transaction.objectStore(SHARE_STORE_NAME);
    const request = store.get(id);
    let share: StoredShare | undefined;
    request.onsuccess = () => {
      share = request.result as StoredShare | undefined;
      if (share) store.delete(id);
    };
    transaction.oncomplete = () => {
      database.close();
      if (!share) {
        resolve(null);
        return;
      }
      resolve({
        title: share.title || "",
        text: share.text || "",
        url: share.url || "",
        files: Array.isArray(share.files) ? share.files : [],
      });
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not read shared content"));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not read shared content"));
    };
  });
}
