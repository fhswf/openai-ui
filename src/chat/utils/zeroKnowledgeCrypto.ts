/**
 * Client-side cryptography for zero-knowledge chat persistence.
 *
 * The server only ever receives ciphertext, public keys and wrapped symmetric
 * chat keys. All plaintext and all private keys stay in the browser.
 *
 * Key hierarchy:
 *   Passkey --PRF--> IKM --HKDF--> K_pass (AES-GCM KEK)
 *   K_pass --AES-GCM--> encryptedSK (the user's private key at rest)
 *   Per chat: K_chat (AES-GCM) encrypts the transcript; K_chat is wrapped for
 *   every recipient using ephemeral ECDH or legacy RSA-OAEP.
 *
 * See docs/zero-knowledge-chat.md for the design and backend API.
 */

const PRF_SALT_SOURCE = "openai-ui-zero-knowledge-prf-salt-v1";
const HKDF_INFO_SOURCE = "sk-encryption";

const AES_KEY_LENGTH = 256;
const AES_GCM_IV_LENGTH = 12;
export const PRF_SALT_LENGTH = 32;
export const DEFAULT_RSA_MODULUS_LENGTH = 4096;
export const DEFAULT_USER_KEY_ALGORITHM = "ECDH-P256" as const;
export const LEGACY_RSA_KEY_ALGORITHM = "RSA-OAEP-SHA256" as const;
export const ECDH_ENVELOPE_ALGORITHM =
  "ECDH-P256-HKDF-SHA256-AES-256-GCM" as const;
export const RSA_ENVELOPE_ALGORITHM = "RSA-OAEP-SHA256" as const;

export type UserKeyAlgorithm =
  | typeof DEFAULT_USER_KEY_ALGORITHM
  | typeof LEGACY_RSA_KEY_ALGORITHM;
export type EnvelopeAlgorithm =
  | typeof ECDH_ENVELOPE_ALGORITHM
  | typeof RSA_ENVELOPE_ALGORITHM;
export type WrappedChatKey = {
  envelopeAlgorithm?: EnvelopeAlgorithm;
  wrappedKey: string;
  wrappedKeyIv?: string;
  ephemeralPublicKey?: string;
};

const CHAT_KEY_WRAP_INFO = "openai-ui-zk-chat-key-wrap-v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

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
  modulusLength?: number
): Promise<CryptoKeyPair> {
  // An omitted length selects the compact default; an explicit length retains
  // the RSA path for legacy compatibility.
  if (modulusLength === undefined) {
    return crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
  }

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

export async function importPublicKey(
  publicKey: string,
  algorithm: UserKeyAlgorithm = DEFAULT_USER_KEY_ALGORITHM
): Promise<CryptoKey> {
  if (algorithm === DEFAULT_USER_KEY_ALGORITHM) {
    return crypto.subtle.importKey(
      "spki",
      base64UrlToBuffer(publicKey),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
  }

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
  kPass: CryptoKey,
  algorithm: UserKeyAlgorithm = DEFAULT_USER_KEY_ALGORITHM,
  extractable = false
): Promise<CryptoKey> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBuffer(encrypted.iv) },
    kPass,
    base64UrlToBuffer(encrypted.encryptedKey)
  );

  return importPrivateKey(decrypted, algorithm, extractable);
}

export async function importPrivateKey(
  pkcs8: BufferSource,
  algorithm: UserKeyAlgorithm = DEFAULT_USER_KEY_ALGORITHM,
  extractable = false
): Promise<CryptoKey> {
  if (algorithm === DEFAULT_USER_KEY_ALGORITHM) {
    return crypto.subtle.importKey(
      "pkcs8",
      pkcs8,
      { name: "ECDH", namedCurve: "P-256" },
      extractable,
      ["deriveBits"]
    );
  }

  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    extractable,
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

export type GroupChatEventContext = {
  chatId: string;
  eventId: string;
  epoch: number;
};

const MAX_GROUP_EVENT_CIPHERTEXT_BYTES = 256 * 1024;

function getGroupEventAdditionalData(context: GroupChatEventContext): ArrayBuffer {
  const value = encoder.encode(
    JSON.stringify([
      "openai-ui-zk-group-event-v1",
      context.chatId,
      context.eventId,
      context.epoch,
    ])
  );
  return copyToArrayBuffer(value);
}

/** Encrypt a group event and bind its routing fields as AES-GCM AAD. */
export async function encryptGroupChatEvent(
  data: unknown,
  chatKey: CryptoKey,
  context: GroupChatEventContext
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const plaintext = encoder.encode(JSON.stringify(data));
  if (plaintext.byteLength + 16 > MAX_GROUP_EVENT_CIPHERTEXT_BYTES) {
    throw new Error("This message is too large to sync to the group");
  }
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: copyToArrayBuffer(iv),
      additionalData: getGroupEventAdditionalData(context),
    },
    chatKey,
    copyToArrayBuffer(plaintext)
  );
  return {
    ciphertext: bufferToBase64Url(ciphertext),
    iv: bufferToBase64Url(iv),
  };
}

/** Decrypt a group event only when its authenticated routing fields match. */
export async function decryptGroupChatEvent<T = unknown>(
  payload: EncryptedPayload,
  chatKey: CryptoKey,
  context: GroupChatEventContext
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlToBuffer(payload.iv),
      additionalData: getGroupEventAdditionalData(context),
    },
    chatKey,
    base64UrlToBuffer(payload.ciphertext)
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

/** Encrypt a file with its chat key; the returned binary is IV + AES-GCM data. */
export async function encryptAttachmentData(
  data: ArrayBuffer | Uint8Array,
  chatKey: CryptoKey,
  additionalData?: BufferSource
): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const plaintext = data instanceof Uint8Array ? data : new Uint8Array(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: copyToArrayBuffer(iv), additionalData },
    chatKey,
    copyToArrayBuffer(plaintext)
  );
  const result = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.byteLength);
  return result;
}

/** Decrypt the IV + AES-GCM binary format returned by encryptAttachmentData. */
export async function decryptAttachmentData(
  encryptedData: ArrayBuffer | Uint8Array,
  chatKey: CryptoKey,
  additionalData?: BufferSource
): Promise<ArrayBuffer> {
  const bytes = encryptedData instanceof Uint8Array
    ? encryptedData
    : new Uint8Array(encryptedData);
  if (bytes.byteLength < AES_GCM_IV_LENGTH + 16) {
    throw new Error("Encrypted attachment is incomplete");
  }
  const iv = copyToArrayBuffer(bytes.subarray(0, AES_GCM_IV_LENGTH));
  const ciphertext = copyToArrayBuffer(bytes.subarray(AES_GCM_IV_LENGTH));
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData },
    chatKey,
    ciphertext
  );
}

const GROUP_ATTACHMENT_HEADER = new Uint8Array([0x5a, 0x4b, 0x47, 0x41, 1]);
const GROUP_ATTACHMENT_HEADER_LENGTH = GROUP_ATTACHMENT_HEADER.length + 4;

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/** Return the group epoch stored in a versioned group attachment, if present. */
export function getGroupAttachmentEpoch(
  data: ArrayBuffer | Uint8Array
): number | null {
  const bytes = toBytes(data);
  if (
    bytes.byteLength < GROUP_ATTACHMENT_HEADER_LENGTH + AES_GCM_IV_LENGTH + 16 ||
    !GROUP_ATTACHMENT_HEADER.every((value, index) => bytes[index] === value)
  ) {
    return null;
  }
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset + GROUP_ATTACHMENT_HEADER.length,
    4
  );
  const epoch = view.getUint32(0);
  return epoch > 0 ? epoch : null;
}

/** Encrypt a group attachment with an epoch key and authenticate its epoch. */
export async function encryptGroupAttachmentData(
  data: ArrayBuffer | Uint8Array,
  epochKey: CryptoKey,
  context: Pick<GroupChatEventContext, "chatId" | "epoch"> & {
    attachmentId: string;
  }
): Promise<Uint8Array> {
  if (!Number.isSafeInteger(context.epoch) || context.epoch < 1) {
    throw new Error("The group attachment epoch is invalid");
  }
  const encrypted = await encryptAttachmentData(
    data,
    epochKey,
    getGroupAttachmentAdditionalData(
      context.chatId,
      context.attachmentId,
      context.epoch
    )
  );
  const header = new Uint8Array(GROUP_ATTACHMENT_HEADER_LENGTH);
  header.set(GROUP_ATTACHMENT_HEADER, 0);
  new DataView(header.buffer).setUint32(GROUP_ATTACHMENT_HEADER.length, context.epoch);
  const result = new Uint8Array(header.byteLength + encrypted.byteLength);
  result.set(header, 0);
  result.set(encrypted, header.byteLength);
  return result;
}

/** Decrypt an attachment only with the epoch encoded in its authenticated header. */
export async function decryptGroupAttachmentData(
  data: ArrayBuffer | Uint8Array,
  epochKey: CryptoKey,
  context: Pick<GroupChatEventContext, "chatId" | "epoch"> & {
    attachmentId: string;
  }
): Promise<ArrayBuffer> {
  const bytes = toBytes(data);
  const epoch = getGroupAttachmentEpoch(bytes);
  if (epoch === null || epoch !== context.epoch) {
    throw new Error("The group attachment epoch does not match");
  }
  return decryptAttachmentData(
    bytes.subarray(GROUP_ATTACHMENT_HEADER_LENGTH),
    epochKey,
    getGroupAttachmentAdditionalData(
      context.chatId,
      context.attachmentId,
      context.epoch
    )
  );
}

/** Bind a group attachment to its chat, opaque ID and access-control epoch. */
export function getGroupAttachmentAdditionalData(
  chatId: string,
  attachmentId: string,
  epoch: number
): ArrayBuffer {
  return copyToArrayBuffer(
    encoder.encode(
      `openai-ui-zk-group-attachment-v1\u0000${chatId}\u0000${attachmentId}\u0000${epoch}`
    )
  );
}

/** Bind an attachment ciphertext to its chat and opaque storage ID. */
export function getAttachmentAdditionalData(
  chatId: string,
  attachmentId: string
): ArrayBuffer {
  return copyToArrayBuffer(encoder.encode(
    `openai-ui-zk-attachment-v1\u0000${chatId}\u0000${attachmentId}`
  ));
}

/** Wrap K_chat for one recipient using ECDH by default or legacy RSA-OAEP. */
export async function wrapChatKey(
  chatKey: CryptoKey,
  recipientPublicKey: CryptoKey | string,
  keyAlgorithm?: UserKeyAlgorithm
): Promise<WrappedChatKey> {
  const algorithm =
    keyAlgorithm ??
    (typeof recipientPublicKey === "string"
      ? DEFAULT_USER_KEY_ALGORITHM
      : recipientPublicKey.algorithm.name === "ECDH"
        ? DEFAULT_USER_KEY_ALGORITHM
        : LEGACY_RSA_KEY_ALGORITHM);
  const publicKey =
    typeof recipientPublicKey === "string"
      ? await importPublicKey(recipientPublicKey, algorithm)
      : recipientPublicKey;

  if (algorithm === DEFAULT_USER_KEY_ALGORITHM) {
    const ephemeral = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );
    const ephemeralBytes = new Uint8Array(
      await crypto.subtle.exportKey("spki", ephemeral.publicKey)
    );
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: publicKey },
      ephemeral.privateKey,
      256
    );
    const wrappingKey = await deriveChatKeyWrappingKey(
      sharedSecret,
      ephemeralBytes
    );
    const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
    const rawChatKey = await crypto.subtle.exportKey("raw", chatKey);
    const wrapped = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      rawChatKey
    );

    return {
      envelopeAlgorithm: ECDH_ENVELOPE_ALGORITHM,
      wrappedKey: bufferToBase64Url(wrapped),
      wrappedKeyIv: bufferToBase64Url(iv),
      ephemeralPublicKey: bufferToBase64Url(ephemeralBytes),
    };
  }

  const wrapped = await crypto.subtle.wrapKey("raw", chatKey, publicKey, {
    name: "RSA-OAEP",
  });

  return {
    envelopeAlgorithm: RSA_ENVELOPE_ALGORITHM,
    wrappedKey: bufferToBase64Url(wrapped),
  };
}

async function deriveChatKeyWrappingKey(
  sharedSecret: BufferSource,
  salt: BufferSource
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    sharedSecret,
    "HKDF",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: encoder.encode(CHAT_KEY_WRAP_INFO),
    },
    hkdfKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Unwrap K_chat with the recipient's key; strings are legacy RSA envelopes. */
export async function unwrapChatKey(
  wrappedKey: WrappedChatKey | string,
  recipientPrivateKey: CryptoKey
): Promise<CryptoKey> {
  if (
    typeof wrappedKey !== "string" &&
    wrappedKey.envelopeAlgorithm === ECDH_ENVELOPE_ALGORITHM
  ) {
    if (!wrappedKey.ephemeralPublicKey || !wrappedKey.wrappedKeyIv) {
      throw new Error("ECDH envelope is missing its public key or IV");
    }
    const ephemeralBytes = new Uint8Array(
      base64UrlToBuffer(wrappedKey.ephemeralPublicKey)
    );
    const ephemeralPublicKey = await crypto.subtle.importKey(
      "spki",
      ephemeralBytes,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: ephemeralPublicKey },
      recipientPrivateKey,
      256
    );
    const wrappingKey = await deriveChatKeyWrappingKey(
      sharedSecret,
      ephemeralBytes
    );
    const rawChatKey = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBuffer(wrappedKey.wrappedKeyIv) },
      wrappingKey,
      base64UrlToBuffer(wrappedKey.wrappedKey)
    );
    return crypto.subtle.importKey(
      "raw",
      rawChatKey,
      { name: "AES-GCM", length: AES_KEY_LENGTH },
      true,
      ["encrypt", "decrypt"]
    );
  }

  return crypto.subtle.unwrapKey(
    "raw",
    base64UrlToBuffer(
      typeof wrappedKey === "string" ? wrappedKey : wrappedKey.wrappedKey
    ),
    recipientPrivateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

export type ChatEnvelope = {
  recipientId: string;
} & WrappedChatKey;

/** Wrap a chat key for every recipient and return the key header. */
export async function buildEnvelopes(
  chatKey: CryptoKey,
  recipients: {
    recipientId: string;
    publicKey: CryptoKey | string;
    keyAlgorithm?: UserKeyAlgorithm;
  }[]
): Promise<ChatEnvelope[]> {
  return Promise.all(
    recipients.map(async ({ recipientId, publicKey, keyAlgorithm }) => ({
      recipientId,
      ...(await wrapChatKey(chatKey, publicKey, keyAlgorithm)),
    }))
  );
}
