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
  publicKey: string;
  encryptedSk: string;
  encryptedSkIv: string;
};

export type VaultPublicKey = {
  userId: string;
  publicKey: string;
};

export type VaultChatSummary = {
  id: string;
  ownerId: string;
  updatedAt: string;
  rev: number;
};

export type VaultEnvelope = {
  recipientId: string;
  wrappedKey: string;
  wrappedKeyIv?: string;
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
  error?: { code?: string; message?: string };
};

export class VaultError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "VaultError";
    this.status = status;
    this.code = code;
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
    try {
      const body = (await response.json()) as VaultErrorBody;
      code = body.error?.code;
      message = body.error?.message ?? message;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new VaultError(response.status, code, message);
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
      publicKey: string;
      encryptedSk: string;
      encryptedSkIv: string;
      challenge: string;
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
