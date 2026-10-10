/**
 * Client-side cryptography for zero-knowledge chat persistence.
 *
 * The server only ever receives ciphertext, public keys and RSA-wrapped
 * symmetric chat keys. All plaintext and all private keys stay in the browser.
 *
 * Key hierarchy:
 *   Passkey --PRF--> IKM --HKDF--> K_pass (AES-GCM KEK)
 *   K_pass --AES-GCM--> encryptedSK (the user's RSA private key at rest)
 *   Per chat: K_chat (AES-GCM) encrypts the transcript; K_chat is wrapped for
 *   every recipient with their RSA public key (hybrid encryption).
 *
 * See docs/zero-knowledge-chat.md for the design and backend API.
 */

const PRF_SALT_SOURCE = "openai-ui-zero-knowledge-prf-salt-v1";
const HKDF_INFO_SOURCE = "sk-encryption";

const AES_KEY_LENGTH = 256;
const AES_GCM_IV_LENGTH = 12;
export const PRF_SALT_LENGTH = 32;
export const DEFAULT_RSA_MODULUS_LENGTH = 4096;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Fixed salt handed to the WebAuthn PRF extension. It is public (not a secret);
 * it only guarantees that registering and asserting derive the same value.
 */
export function getPrfSalt(): ArrayBuffer {
  return toFixedLength(PRF_SALT_SOURCE, PRF_SALT_LENGTH);
}

function toFixedLength(source: string, length: number): ArrayBuffer {
  const bytes = encoder.encode(source);
  const out = new Uint8Array(length);
  out.set(bytes.subarray(0, length));
  return out.buffer;
}

export function bufferToBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlToBuffer(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive the key-encryption-key (K_pass) from the raw PRF output of a passkey.
 */
export async function deriveKeyFromPrf(
  prfOutput: BufferSource
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    prfOutput,
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: encoder.encode(HKDF_INFO_SOURCE),
    },
    baseKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export type EncryptedKey = {
  encryptedKey: string;
  iv: string;
};

export type ExportedUserKeyPair = {
  publicKey: string;
  encryptedPrivateKey: EncryptedKey;
};

export async function generateUserKeyPair(
  modulusLength: number = DEFAULT_RSA_MODULUS_LENGTH
): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return bufferToBase64Url(spki);
}

export async function importPublicKey(publicKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    base64UrlToBuffer(publicKey),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt", "wrapKey"]
  );
}

/**
 * Wrap the user's private key with K_pass so it can be uploaded and recovered
 * on another device via the passkey.
 */
export async function encryptPrivateKey(
  privateKey: CryptoKey,
  kPass: CryptoKey
): Promise<EncryptedKey> {
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    kPass,
    pkcs8
  );

  return {
    encryptedKey: bufferToBase64Url(encrypted),
    iv: bufferToBase64Url(iv),
  };
}

export async function decryptPrivateKey(
  encrypted: EncryptedKey,
  kPass: CryptoKey
): Promise<CryptoKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBuffer(encrypted.iv) },
    kPass,
    base64UrlToBuffer(encrypted.encryptedKey)
  );

  return crypto.subtle.importKey(
    "pkcs8",
    decrypted,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt", "unwrapKey"]
  );
}

export async function generateChatKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
};

/** Encrypt an arbitrary serializable value with a symmetric chat key. */
export async function encryptChatData(
  data: unknown,
  chatKey: CryptoKey
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const plaintext = encoder.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chatKey,
    plaintext
  );

  return {
    ciphertext: bufferToBase64Url(ciphertext),
    iv: bufferToBase64Url(iv),
  };
}

export async function decryptChatData<T = unknown>(
  payload: EncryptedPayload,
  chatKey: CryptoKey
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBuffer(payload.iv) },
    chatKey,
    base64UrlToBuffer(payload.ciphertext)
  );

  return JSON.parse(decoder.decode(plaintext)) as T;
}

/**
 * Wrap K_chat for one recipient using their RSA public key.
 * This is the per-recipient entry of the multi-recipient key header.
 */
export async function wrapChatKey(
  chatKey: CryptoKey,
  recipientPublicKey: CryptoKey | string
): Promise<string> {
  const publicKey =
    typeof recipientPublicKey === "string"
      ? await importPublicKey(recipientPublicKey)
      : recipientPublicKey;

  const wrapped = await crypto.subtle.wrapKey("raw", chatKey, publicKey, {
    name: "RSA-OAEP",
  });

  return bufferToBase64Url(wrapped);
}

/** Unwrap K_chat with the recipient's private key. */
export async function unwrapChatKey(
  wrappedKey: string,
  recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    base64UrlToBuffer(wrappedKey),
    recipientPrivateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export type ChatEnvelope = {
  recipientId: string;
  wrappedKey: string;
};

/** Wrap a chat key for every recipient and return the key header. */
export async function buildEnvelopes(
  chatKey: CryptoKey,
  recipients: { recipientId: string; publicKey: CryptoKey | string }[]
): Promise<ChatEnvelope[]> {
  return Promise.all(
    recipients.map(async ({ recipientId, publicKey }) => ({
      recipientId,
      wrappedKey: await wrapChatKey(chatKey, publicKey),
    }))
  );
}
