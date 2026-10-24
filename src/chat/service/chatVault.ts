/**
 * API client for the zero-knowledge chat vault (`/api/zk`, implemented by the
 * proxy backend). The client only transports ciphertext, public keys and
 * wrapped chat keys; it never sees plaintext transcripts or private keys.
 *
 * See docs/zero-knowledge-chat.md for the full endpoint specification.
 */

export type VaultUserKey = {
  userId: string;
  credentialId: string | null;
  credentialName?: string | null;
  credentials?: VaultCredential[];
  allowedOrigins?: string[];
  publicKey: string;
  /** Missing metadata identifies legacy RSA keys stored before algorithm tags. */
  publicKeyAlgorithm?: "RSA-OAEP-SHA256" | "ECDH-P256";
  encryptedSk?: string;
  encryptedSkIv?: string;
  identityDisclosure?: "subject" | "profile";
};

export type VaultCredential = {
  credentialId: string;
  name: string;
  createdAt: string;
  canDelete?: boolean;
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

export type VaultGroupEnvelope = Omit<VaultEnvelope, "recipientId"> & {
  epoch: number;
};

export type VaultGroupMember = {
  userId: string;
  role: "owner" | "member";
};

export type VaultGroupChat = {
  chatId: string;
  ownerId: string;
  currentEpoch: number;
  cursor: number;
  members: VaultGroupMember[];
  envelopes: VaultGroupEnvelope[];
};

export type VaultGroupCatalog = {
  ciphertext: string;
  iv: string;
  selfEnvelope: VaultEnvelope;
  rev: number;
  updatedAt: string;
};

export type VaultSettings = {
  ciphertext: string;
  iv: string;
  selfEnvelope: VaultEnvelope;
  rev: number;
  updatedAt: string;
};

export type VaultGroupEvent = {
  chatId: string;
  sequence: number;
  eventId: string;
  actorId: string;
  epoch: number;
  ciphertext: string;
  iv: string;
  createdAt: string;
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

export type VaultSharedChat = Omit<VaultChat, "envelopes" | "ownerId">;

export type VaultShareLink = {
  token: string;
  expiresAt: string;
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

async function requestBinary(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {}
): Promise<ArrayBuffer> {
  const response = await fetch(`${getVaultBaseUrl()}${path}`, {
    credentials: "include",
    ...init,
    signal: options.signal,
    headers: {
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
  return response.arrayBuffer();
}

export const chatVault = {
  registrationChallenge(
    options?: RequestOptions
  ): Promise<{ challenge: string }> {
    return request(
      "/keys/registration-challenge",
      {
        method: "POST",
        body: JSON.stringify({ rpId: window.location.hostname }),
      },
      options
    );
  },

  registerKey(
    payload: {
      credentialId: string;
      rpId: string;
      credentialName: string;
      publicKey: string;
      publicKeyAlgorithm: "RSA-OAEP-SHA256" | "ECDH-P256";
      identityDisclosure?: "subject" | "profile";
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
    credentialId?: string,
    options?: RequestOptions
  ): Promise<{ challenge: string }> {
    return request(
      "/keys/assertion-challenge",
      {
        method: "POST",
        body: JSON.stringify({
          ...(credentialId ? { credentialId } : {}),
          rpId: window.location.hostname,
        }),
      },
      options
    );
  },

  submitAssertion(
    payload: {
      credentialId: string;
      rpId: string;
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
    const query = new URLSearchParams({ rpId: window.location.hostname });
    return request(`/keys/me?${query}`, {}, options);
  },

  setIdentityDisclosure(
    identityDisclosure: "subject" | "profile",
    options?: RequestOptions
  ): Promise<{ identityDisclosure: "subject" | "profile" }> {
    return request(
      "/keys/me/identity-disclosure",
      { method: "PATCH", body: JSON.stringify({ identityDisclosure }) },
      options
    );
  },

  renameMyCredential(
    credentialId: string,
    credentialName: string,
    options?: RequestOptions
  ): Promise<{ credentialId: string; credentialName: string }> {
    return request(
      `/keys/me/credentials/${encodeURIComponent(credentialId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          credentialName,
          rpId: window.location.hostname,
        }),
      },
      options
    );
  },

  deleteMyCredential(
    credentialId: string,
    options?: RequestOptions
  ): Promise<void> {
    const query = new URLSearchParams({ rpId: window.location.hostname });
    return request(
      `/keys/me/credentials/${encodeURIComponent(credentialId)}?${query}`,
      { method: "DELETE" },
      options
    );
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

  /** Delete the shared vault account and all of its registered passkeys. */
  deleteMyKey(options?: RequestOptions): Promise<void> {
    return request("/keys/me", { method: "DELETE" }, options);
  },

  listChats(options?: RequestOptions): Promise<VaultChatSummary[]> {
    return request("/chats", {}, options);
  },

  getGroupCatalog(options?: RequestOptions): Promise<VaultGroupCatalog> {
    return request("/group-catalog", {}, options);
  },

  putGroupCatalog(
    payload: {
      ciphertext: string;
      iv: string;
      selfEnvelope: VaultEnvelope;
      baseRev?: number;
    },
    options?: RequestOptions
  ): Promise<{ rev: number }> {
    return request(
      "/group-catalog",
      { method: "PUT", body: JSON.stringify(payload) },
      options
    );
  },

  getSettings(options?: RequestOptions): Promise<VaultSettings> {
    return request("/settings", {}, options);
  },

  putSettings(
    payload: {
      ciphertext: string;
      iv: string;
      selfEnvelope: VaultEnvelope;
      baseRev?: number;
    },
    options?: RequestOptions
  ): Promise<{ rev: number }> {
    return request(
      "/settings",
      { method: "PUT", body: JSON.stringify(payload) },
      options
    );
  },

  getGroupChat(
    id: string,
    options?: RequestOptions
  ): Promise<VaultGroupChat> {
    return request(`/chats/${encodeURIComponent(id)}/group`, {}, options);
  },

  createGroupChat(
    id: string,
    payload: { members: string[]; envelopes: VaultEnvelope[] },
    options?: RequestOptions
  ): Promise<{ chatId: string; ownerId: string; currentEpoch: number; members: string[] }> {
    return request(
      `/chats/${encodeURIComponent(id)}/group`,
      { method: "POST", body: JSON.stringify(payload) },
      options
    );
  },

  updateGroupMembership(
    id: string,
    payload: {
      baseEpoch: number;
      members: string[];
      envelopes: (VaultEnvelope & { epoch: number })[];
    },
    options?: RequestOptions
  ): Promise<{ chatId: string; currentEpoch: number; members: string[] }> {
    return request(
      `/chats/${encodeURIComponent(id)}/group/membership`,
      { method: "PUT", body: JSON.stringify(payload) },
      options
    );
  },

  listGroupEvents(
    id: string,
    after = 0,
    limit = 20,
    options?: RequestOptions
  ): Promise<{ events: VaultGroupEvent[]; nextCursor: number; hasMore: boolean }> {
    return request(
      `/chats/${encodeURIComponent(id)}/events?after=${after}&limit=${limit}`,
      {},
      options
    );
  },

  appendGroupEvent(
    id: string,
    event: { eventId: string; epoch: number; ciphertext: string; iv: string },
    options?: RequestOptions
  ): Promise<{ chatId: string; eventId: string; sequence: number; duplicate: boolean; createdAt: string }> {
    return request(
      `/chats/${encodeURIComponent(id)}/events`,
      { method: "POST", body: JSON.stringify(event) },
      options
    );
  },

  getChat(id: string, options?: RequestOptions): Promise<VaultChat> {
    return request(`/chats/${encodeURIComponent(id)}`, {}, options);
  },

  putAttachment(
    chatId: string,
    attachmentId: string,
    ciphertext: Uint8Array,
    options?: RequestOptions
  ): Promise<void> {
    return request(
      `/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {
        method: "PUT",
        body: ciphertext.buffer.slice(
          ciphertext.byteOffset,
          ciphertext.byteOffset + ciphertext.byteLength
        ) as ArrayBuffer,
        headers: { "Content-Type": "application/octet-stream" },
      },
      options
    );
  },

  getAttachment(
    chatId: string,
    attachmentId: string,
    options?: RequestOptions
  ): Promise<ArrayBuffer> {
    return requestBinary(
      `/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
      {},
      options
    );
  },

  async hasAttachment(
    chatId: string,
    attachmentId: string,
    options?: RequestOptions
  ): Promise<boolean> {
    try {
      await request(
        `/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { method: "HEAD" },
        options
      );
      return true;
    } catch (error) {
      if (error instanceof VaultError && error.status === 404) return false;
      throw error;
    }
  },

  deleteAttachment(
    chatId: string,
    attachmentId: string,
    options?: RequestOptions
  ): Promise<void> {
    return request(
      `/chats/${encodeURIComponent(chatId)}/attachments/${encodeURIComponent(attachmentId)}`,
      { method: "DELETE" },
      options
    );
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

  createShareLink(
    id: string,
    options?: RequestOptions
  ): Promise<VaultShareLink> {
    return request(
      `/chats/${encodeURIComponent(id)}/share-link`,
      { method: "POST" },
      options
    );
  },

  revokeShareLink(
    id: string,
    token: string,
    options?: RequestOptions
  ): Promise<void> {
    return request(
      `/chats/${encodeURIComponent(id)}/share-link/revoke`,
      { method: "POST", body: JSON.stringify({ token }) },
      options
    );
  },

  redeemShareLink(
    token: string,
    options?: RequestOptions
  ): Promise<VaultSharedChat> {
    return request(
      "/public-shares/redeem",
      { method: "POST", body: JSON.stringify({ token }) },
      options
    );
  },

  redeemShareLinkAttachment(
    token: string,
    attachmentId: string,
    options?: RequestOptions
  ): Promise<ArrayBuffer> {
    return requestBinary(
      "/public-shares/redeem-attachment",
      {
        method: "POST",
        body: JSON.stringify({ token, attachmentId }),
        headers: { "Content-Type": "application/json" },
      },
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
