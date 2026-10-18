const SHARE_DB_NAME = "kimpuls-share-target";
const SHARE_STORE_NAME = "shares";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function saveSharedContent(share) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SHARE_STORE_NAME)) {
        request.result.createObjectStore(SHARE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(SHARE_STORE_NAME, "readwrite");
      transaction.objectStore(SHARE_STORE_NAME).put(share);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (
    requestUrl.origin !== self.location.origin ||
    requestUrl.pathname !== "/share" ||
    event.request.method !== "POST"
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const form = await event.request.formData();
        const textValue = (name) => {
          const value = form.get(name);
          return typeof value === "string" ? value : "";
        };
        const share = {
          id: crypto.randomUUID(),
          title: textValue("title"),
          text: textValue("text"),
          url: textValue("url"),
          files: form
            .getAll("files")
            .filter((value) => value instanceof File),
        };
        await saveSharedContent(share);
        return Response.redirect(
          new URL(
            `/?share=${encodeURIComponent(share.id)}`,
            self.location.origin
          ),
          303
        );
      } catch (error) {
        console.error("Could not receive shared content:", error);
        return Response.redirect(
          new URL("/?shareError=1", self.location.origin),
          303
        );
      }
    })()
  );
});
