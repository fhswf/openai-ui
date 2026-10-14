/**
 * API client for the zero-knowledge chat vault (`/api/zk`, implemented by the
 * proxy backend). The client only transports ciphertext, public keys and
 * wrapped chat keys; it never sees plaintext transcripts or private keys.
 *
 * See docs/zero-knowledge-chat.md for the full endpoint specification.
 */

export type VaultUserKey = {
  userId: string;
  credentialId: string;
  credentialName?: string;
  credentials?: VaultCredential[];
  publicKey: string;
  /** Missing metadata identifies legacy RSA keys stored before algorithm tags. */
  publicKeyAlgorithm?: "RSA-OAEP-SHA256" | "ECDH-P256";
  encryptedSk?: string;
  encryptedSkIv?: string;
};

export type VaultCredential = {
  credentialId: string;
  name: string;
  createdAt: string;
};

export type VaultPublicKey = {
  userId: string;
  publicKey: string;
  publicKeyAlgorithm?: "RSA-OAEP-SHA256" | "ECDH-P256";
};

export type VaultChatSummary = {
  id: string;
  ownerId: string;
  updatedAt: string;
  rev: number;
};

export type VaultEnvelope = {
  recipientId: string;
  envelopeAlgorithm?:
    | "RSA-OAEP-SHA256"
    | "ECDH-P256-HKDF-SHA256-AES-256-GCM";
  wrappedKey: string;
  wrappedKeyIv?: string;
  ephemeralPublicKey?: string;
};

export type VaultChat = {
  id: string;
  ownerId: string;
  rev: number;
  ciphertext: string;
  iv: string;
  metadataCt?: string;
  metadataIv?: string;
  envelopes: VaultEnvelope[];
};

export type PutChatPayload = {
  ciphertext: string;
  iv: string;
  metadataCt?: string;
  metadataIv?: string;
  selfEnvelope: VaultEnvelope;
  baseRev?: number;
};

export type VaultErrorBody = {
  currentRev?: number;
  error?: { code?: string; message?: string; currentRev?: number };
};

export class VaultError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly currentRev?: number;

  constructor(
    status: number,
    code: string | undefined,
    message: string,
    currentRev?: number
  ) {
    super(message);
    this.name = "VaultError";
    this.status = status;
    this.code = code;
    this.currentRev = currentRev;
  }
}

export function getVaultBaseUrl(): string {
  const configured = import.meta.env?.VITE_ZK_API_BASE_URL;
  const base = configured || "/api/zk";
  if (base.startsWith("/")) {
    return new URL(base, window.location.origin).toString().replace(/\/$/, "");
  }
  return base.replace(/\/$/, "");
}

type RequestOptions = { signal?: AbortSignal };

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<T> {
  const response = await fetch(`${getVaultBaseUrl()}${path}`, {
    credentials: "include",
    ...init,
    signal: options.signal,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let code: string | undefined;
    let message = response.statusText;
    let currentRev: number | undefined;
    try {
      const body = (await response.json()) as VaultErrorBody;
      code = body.error?.code;
      message = body.error?.message ?? message;
      currentRev = body.currentRev ?? body.error?.currentRev;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new VaultError(response.status, code, message, currentRev);
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export const chatVault = {
  registrationChallenge(
    options?: RequestOptions
  ): Promise<{ challenge: string }> {
    return request("/keys/registration-challenge", { method: "POST" }, options);
  },

  registerKey(
    payload: {
      credentialId: string;
      credentialName: string;
      publicKey: string;
      publicKeyAlgorithm: "RSA-OAEP-SHA256" | "ECDH-P256";
      encryptedSk: string;
      encryptedSkIv: string;
      challenge: string;
      credentialPublicKey: string;
    },
    options?: RequestOptions
  ): Promise<{ userId: string; createdAt: string }> {
    return request(
      "/keys",
      { method: "POST", body: JSON.stringify(payload) },
      options
    );
  },

  assertionChallenge(
    credentialId: string,
    options?: RequestOptions
  ): Promise<{ challenge: string }> {
    return request(
      "/keys/assertion-challenge",
      { method: "POST", body: JSON.stringify({ credentialId }) },
      options
    );
  },

  submitAssertion(
    payload: {
      credentialId: string;
      challenge: string;
      authenticatorData: string;
      clientDataJSON: string;
      signature: string;
    },
    options?: RequestOptions
  ): Promise<void> {
    return request(
      "/keys/assertion",
      { method: "POST", body: JSON.stringify(payload) },
      options
    );
  },

  getMyKey(options?: RequestOptions): Promise<VaultUserKey> {
    return request("/keys/me", {}, options);
  },

  getPublicKey(
    userId: string,
    options?: RequestOptions
  ): Promise<VaultPublicKey> {
    return request(
      `/keys/${encodeURIComponent(userId)}/public-key`,
      {},
      options
    );
  },

  /** Resolve a recipient's public key by identity for sharing. */
  lookupKeyByEmail(
    email: string,
    options?: RequestOptions
  ): Promise<VaultPublicKey> {
    return request(
      `/keys/lookup?email=${encodeURIComponent(email)}`,
      {},
      options
    );
  },

  /** Opt out of central storage by removing the server-side key material. */
  deleteMyKey(options?: RequestOptions): Promise<void> {
    return request("/keys/me", { method: "DELETE" }, options);
  },

  listChats(options?: RequestOptions): Promise<VaultChatSummary[]> {
    return request("/chats", {}, options);
  },

  getChat(id: string, options?: RequestOptions): Promise<VaultChat> {
    return request(`/chats/${encodeURIComponent(id)}`, {}, options);
  },

  putChat(
    id: string,
    payload: PutChatPayload,
    options?: RequestOptions
  ): Promise<VaultChat> {
    return request(
      `/chats/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(payload) },
      options
    );
  },

  shareChat(
    id: string,
    envelope: VaultEnvelope,
    options?: RequestOptions
  ): Promise<void> {
    return request(
      `/chats/${encodeURIComponent(id)}/share`,
      { method: "POST", body: JSON.stringify(envelope) },
      options
    );
  },

  revokeShare(
    id: string,
    recipientId: string,
    options?: RequestOptions
  ): Promise<void> {
    return request(
      `/chats/${encodeURIComponent(id)}/revoke`,
      { method: "POST", body: JSON.stringify({ recipientId }) },
      options
    );
  },

  deleteChat(id: string, options?: RequestOptions): Promise<void> {
    return request(
      `/chats/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      options
    );
  },
};

export default chatVault;
