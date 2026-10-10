/**
 * IndexedDB cache for the user's decrypted private chat key (SK_user).
 *
 * The key is kept as a non-exportable CryptoKey object and only lives for the
 * duration that the user wants to stay unlocked on this device. It is never
 * written to localStorage and never sent anywhere.
 */

const DB_NAME = "ChatCryptoDB";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const PRIVATE_KEY_ID = "private-chat-key";

function getIndexedDB(): IDBFactory {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment");
  }
  return indexedDB;
}

function openDatabase(idb: IDBFactory = getIndexedDB()): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePrivateKey(
  privateKey: CryptoKey,
  idb: IDBFactory = getIndexedDB()
): Promise<void> {
  const db = await openDatabase(idb);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(privateKey, PRIVATE_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadPrivateKey(
  idb: IDBFactory = getIndexedDB()
): Promise<CryptoKey | null> {
  const db = await openDatabase(idb);
  try {
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(PRIVATE_KEY_ID);
      request.onsuccess = () =>
        resolve((request.result as CryptoKey | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function clearPrivateKey(
  idb: IDBFactory = getIndexedDB()
): Promise<void> {
  const db = await openDatabase(idb);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(PRIVATE_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const KEYSTORE_ID = PRIVATE_KEY_ID;
