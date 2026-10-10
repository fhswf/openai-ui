import { describe, expect, it } from "vitest";
import {
  base64UrlToBuffer,
  bufferToBase64Url,
  buildEnvelopes,
  decryptChatData,
  decryptPrivateKey,
  deriveKeyFromPrf,
  encryptChatData,
  encryptPrivateKey,
  exportPublicKey,
  generateChatKey,
  generateUserKeyPair,
  getPrfSalt,
  importPublicKey,
  unwrapChatKey,
  wrapChatKey,
} from "../zeroKnowledgeCrypto";

// Real 2048-bit RSA keys keep the tests fast while exercising the same code path.
const TEST_MODULUS = 2048;

describe("base64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    const encoded = bufferToBase64Url(bytes);
    expect(encoded).not.toMatch(/[+/=]/);
    const decoded = new Uint8Array(base64UrlToBuffer(encoded));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("uses the fixed-length public PRF salt", () => {
    expect(getPrfSalt().byteLength).toBe(32);
    expect(bufferToBase64Url(getPrfSalt())).toBe(
      bufferToBase64Url(getPrfSalt())
    );
  });
});

describe("K_pass derivation", () => {
  it("is deterministic for identical PRF output", async () => {
    const prf = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const k1 = await deriveKeyFromPrf(prf);
    const k2 = await deriveKeyFromPrf(prf);
    expect(k1.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });

    const ikm = await crypto.subtle.exportKey("raw", await generateChatKey());
    const payload = await encryptChatData({ hello: "world" }, k1);
    const roundTrip = await decryptChatData<{ hello: string }>(payload, k2);
    expect(roundTrip).toEqual({ hello: "world" });
    expect(ikm.byteLength).toBe(32);
  });

  it("produces different keys for different PRF output", async () => {
    const k1 = await deriveKeyFromPrf(
      crypto.getRandomValues(new Uint8Array(32))
    );
    const k2 = await deriveKeyFromPrf(
      crypto.getRandomValues(new Uint8Array(32))
    );
    const payload = await encryptChatData({ secret: 1 }, k1);
    await expect(decryptChatData(payload, k2)).rejects.toThrow();
  });
});

describe("private key wrapping with K_pass", () => {
  it("encrypts and restores the user private key", async () => {
    const kPass = await deriveKeyFromPrf(
      crypto.getRandomValues(new Uint8Array(32))
    );
    const pair = await generateUserKeyPair(TEST_MODULUS);

    const encrypted = await encryptPrivateKey(pair.privateKey, kPass);
    expect(encrypted.encryptedKey).toBeTruthy();

    const restored = await decryptPrivateKey(encrypted, kPass);
    const chatKey = await generateChatKey();
    const wrapped = await wrapChatKey(chatKey, pair.publicKey);
    const unwrapped = await unwrapChatKey(wrapped, restored);
    const payload = await encryptChatData({ ok: true }, unwrapped);
    expect(await decryptChatData(payload, chatKey)).toEqual({ ok: true });
  });

  it("fails to decrypt with the wrong K_pass", async () => {
    const pair = await generateUserKeyPair(TEST_MODULUS);
    const encrypted = await encryptPrivateKey(
      pair.privateKey,
      await deriveKeyFromPrf(crypto.getRandomValues(new Uint8Array(32)))
    );
    const wrongKey = await deriveKeyFromPrf(
      crypto.getRandomValues(new Uint8Array(32))
    );
    await expect(decryptPrivateKey(encrypted, wrongKey)).rejects.toThrow();
  });
});

describe("chat encryption and sharing", () => {
  it("round-trips a chat transcript", async () => {
    const chatKey = await generateChatKey();
    const transcript = {
      title: "Hello",
      messages: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello there" },
      ],
    };
    const payload = await encryptChatData(transcript, chatKey);
    expect(payload.ciphertext).not.toContain("Hi");
    expect(await decryptChatData(payload, chatKey)).toEqual(transcript);
  });

  it("lets a second recipient unwrap a shared chat key", async () => {
    const alice = await generateUserKeyPair(TEST_MODULUS);
    const bob = await generateUserKeyPair(TEST_MODULUS);
    const chatKey = await generateChatKey();
    const transcript = { messages: [{ role: "user", content: "shared" }] };
    const payload = await encryptChatData(transcript, chatKey);

    const envelopes = await buildEnvelopes(chatKey, [
      {
        recipientId: "alice",
        publicKey: await exportPublicKey(alice.publicKey),
      },
      { recipientId: "bob", publicKey: await exportPublicKey(bob.publicKey) },
    ]);
    expect(envelopes.map((e) => e.recipientId)).toEqual(["alice", "bob"]);

    const bobEnvelope = envelopes.find((e) => e.recipientId === "bob")!;
    const bobChatKey = await unwrapChatKey(
      bobEnvelope.wrappedKey,
      bob.privateKey
    );
    expect(await decryptChatData(payload, bobChatKey)).toEqual(transcript);
  });

  it("does not allow a non-recipient to unwrap the chat key", async () => {
    const alice = await generateUserKeyPair(TEST_MODULUS);
    const mallory = await generateUserKeyPair(TEST_MODULUS);
    const chatKey = await generateChatKey();
    const wrapped = await wrapChatKey(
      chatKey,
      await exportPublicKey(alice.publicKey)
    );
    await expect(unwrapChatKey(wrapped, mallory.privateKey)).rejects.toThrow();
  });

  it("imports an exported public key so an owner can share", async () => {
    const recipient = await generateUserKeyPair(TEST_MODULUS);
    const imported = await importPublicKey(
      await exportPublicKey(recipient.publicKey)
    );
    const chatKey = await generateChatKey();
    const wrapped = await wrapChatKey(chatKey, imported);
    const unwrapped = await unwrapChatKey(wrapped, recipient.privateKey);
    expect(unwrapped.algorithm).toMatchObject({ name: "AES-GCM" });
  });
});
