import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  KEYSTORE_ID,
  clearPrivateKey,
  loadPrivateKey,
  savePrivateKey,
} from "../zeroKnowledgeKeystore";

async function makeRsaPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

describe("zero-knowledge keystore", () => {
  afterEach(async () => {
    await clearPrivateKey().catch(() => undefined);
  });

  it("returns null when no key is stored", async () => {
    await clearPrivateKey().catch(() => undefined);
    expect(await loadPrivateKey()).toBeNull();
  });

  it("stores and restores a usable, non-exportable CryptoKey", async () => {
    const pair = await makeRsaPair();
    await savePrivateKey(pair.privateKey);

    const restored = await loadPrivateKey();
    expect(restored).not.toBeNull();
    expect(restored!.type).toBe("private");
    expect((restored!.algorithm as RsaKeyAlgorithm).name).toBe("RSA-OAEP");

    // The restored key must actually unwrap a key wrapped for its public half.
    const chatKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const wrapped = await crypto.subtle.wrapKey(
      "raw",
      chatKey,
      pair.publicKey,
      {
        name: "RSA-OAEP",
      }
    );
    const unwrapped = await crypto.subtle.unwrapKey(
      "raw",
      wrapped,
      restored!,
      { name: "RSA-OAEP" },
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      unwrapped,
      new TextEncoder().encode("payload")
    );
    expect(cipher.byteLength).toBeGreaterThan(0);
  });

  it("clears the stored key", async () => {
    const pair = await makeRsaPair();
    await savePrivateKey(pair.privateKey);
    expect(await loadPrivateKey()).not.toBeNull();
    await clearPrivateKey();
    expect(await loadPrivateKey()).toBeNull();
  });

  it("uses a stable store id", () => {
    expect(KEYSTORE_ID).toBe("private-chat-key");
  });
});
