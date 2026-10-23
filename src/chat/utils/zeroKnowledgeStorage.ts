import { VaultError, chatVault, type VaultUserKey } from "../service/chatVault";
import {
  decryptPrivateKey,
  DEFAULT_USER_KEY_ALGORITHM,
  deriveKeyFromPrf,
  encryptPrivateKey,
  exportPublicKey,
  generateChatKey,
  generateUserKeyPair,
  importPrivateKey,
  LEGACY_RSA_KEY_ALGORITHM,
  type UserKeyAlgorithm,
  bufferToBase64Url,
  base64UrlToBuffer,
  unwrapChatKey,
  wrapChatKey,
} from "./zeroKnowledgeCrypto";
import {
  assertPasskeyWithResponse,
  isPrfSupported,
  registerPasskey,
  UnexpectedPasskeyError,
  UnsupportedWebAuthnPrfError,
} from "./webauthn";
import {
  loadActiveCredentialId,
  loadPrivateKey,
  savePrivateKey,
} from "./zeroKnowledgeKeystore";

type AuthenticatedUser = {
  sub?: string;
  id?: string | number;
  email?: string;
  preferred_username?: string;
  name?: string;
  displayName?: string;
} | null;

export type EnabledZkStorage = {
  privateKey: CryptoKey;
  userKey: VaultUserKey;
  created: boolean;
};

export type VaultLinkTarget = {
  requestCode: string;
  privateKey: CryptoKey;
  transferId: string;
  userId: string;
  targetOrigin: string;
};

type VaultLinkRequestPayload = {
  type: "openai-ui-vault-link-request";
  version: 1;
  transferId: string;
  userId: string;
  targetOrigin: string;
  publicKey: string;
};

type VaultLinkResponsePayload = {
  type: "openai-ui-vault-link-response";
  version: 1;
  transferId: string;
  userId: string;
  targetOrigin: string;
  sourceOrigin: string;
  publicKey: string;
  iv: string;
  ciphertext: string;
};

export function getZeroKnowledgeStorageErrorKey(
  error: unknown
):
  | "zk_storage_rp_id_mismatch"
  | "zk_storage_prf_unsupported"
  | "zk_storage_passkey_mismatch"
  | "zk_storage_passkey_unavailable"
  | null {
  if (
    error instanceof VaultError &&
    (error.code === "rp_id_mismatch" ||
      error.message.includes("rp_id_mismatch"))
  ) {
    return "zk_storage_rp_id_mismatch";
  }
  if (error instanceof UnsupportedWebAuthnPrfError) {
    return "zk_storage_prf_unsupported";
  }
  if (error instanceof UnexpectedPasskeyError) {
    return "zk_storage_passkey_mismatch";
  }
  if (error instanceof Error && error.name === "NotAllowedError") {
    return "zk_storage_passkey_unavailable";
  }
  return null;
}

function getUserIdentity(user: AuthenticatedUser): {
  id: string;
  username: string;
  displayName: string;
} {
  const id = user?.sub ?? user?.id ?? user?.email;
  const username = user?.email ?? user?.preferred_username ?? user?.name;
  if (!id || !username) {
    throw new Error("Could not identify the signed-in account for passkey setup");
  }

  return {
    id: String(id),
    username,
    displayName: user?.displayName ?? user?.name ?? username,
  };
}

async function getCurrentUserKey(): Promise<VaultUserKey | null> {
  try {
    return await chatVault.getMyKey();
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function isPrivateKeyForUser(
  privateKey: CryptoKey,
  userKey: VaultUserKey
): Promise<boolean> {
  try {
    const probeKey = await generateChatKey();
    const wrappedProbe = await wrapChatKey(
      probeKey,
      userKey.publicKey,
      userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
    );
    await unwrapChatKey(wrappedProbe, privateKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Enable vault storage, registering a passkey on the first device or using an
 * existing passkey to unlock the user's private key on a new device.
 */
export async function enableZeroKnowledgeStorage(
  user: AuthenticatedUser,
  options: { credentialId?: string; credentialName?: string } = {}
): Promise<EnabledZkStorage> {
  if (!isPrfSupported()) {
    throw new Error(
      "This browser does not support passkeys with the WebAuthn PRF extension"
    );
  }

  const existing = await getCurrentUserKey();
  if (existing) {
    const cachedPrivateKey = await loadPrivateKey();
    if (
      !options.credentialId &&
      cachedPrivateKey &&
      (await isPrivateKeyForUser(cachedPrivateKey, existing))
    ) {
      return {
        privateKey: cachedPrivateKey,
        userKey: existing,
        created: false,
      };
    }

    const credentialId = options.credentialId ?? existing.credentialId;
    if (!credentialId) {
      throw new Error("No passkey is registered for this site yet");
    }
    const challenge = await chatVault.assertionChallenge(credentialId);
    const assertion = await assertPasskeyWithResponse({
      credentialId,
      challenge: base64UrlToBuffer(challenge.challenge),
    });
    await chatVault.submitAssertion({
      credentialId: assertion.credentialId,
      rpId: window.location.hostname,
      challenge: challenge.challenge,
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      signature: assertion.signature,
    });

    const unlockedKey = await chatVault.getMyKey();
    if (!unlockedKey.encryptedSk || !unlockedKey.encryptedSkIv) {
      throw new Error("The server did not release the encrypted chat key");
    }
    const kPass = await deriveKeyFromPrf(assertion.prfOutput);
    const privateKey = await decryptPrivateKey(
      {
        encryptedKey: unlockedKey.encryptedSk,
        iv: unlockedKey.encryptedSkIv,
      },
      kPass,
      unlockedKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
    );
    await savePrivateKey(privateKey);

    return { privateKey, userKey: unlockedKey, created: false };
  }

  const identity = getUserIdentity(user);
  const challenge = await chatVault.registrationChallenge();
  const passkey = await registerPasskey({
    userId: await getWebAuthnUserId(identity.id),
    username: identity.username,
    displayName: identity.displayName,
    challenge: base64UrlToBuffer(challenge.challenge),
  });
  const kPass = await deriveKeyFromPrf(passkey.prfOutput);
  const keyPair = await generateUserKeyPair();
  const encryptedPrivateKey = await encryptPrivateKey(keyPair.privateKey, kPass);
  const publicKey = await exportPublicKey(keyPair.publicKey);

  const registered = await chatVault.registerKey({
    credentialId: passkey.credentialId,
    rpId: window.location.hostname,
    credentialName: requireCredentialName(options.credentialName),
    publicKey,
    publicKeyAlgorithm: DEFAULT_USER_KEY_ALGORITHM,
    encryptedSk: encryptedPrivateKey.encryptedKey,
    encryptedSkIv: encryptedPrivateKey.iv,
    challenge: challenge.challenge,
    credentialPublicKey: passkey.credentialPublicKey,
  });
  const userKey: VaultUserKey = {
    userId: registered.userId,
    credentialId: passkey.credentialId,
    credentialName: requireCredentialName(options.credentialName),
    credentials: [
      {
        credentialId: passkey.credentialId,
        name: requireCredentialName(options.credentialName),
        createdAt: registered.createdAt,
      },
    ],
    publicKey,
    publicKeyAlgorithm: DEFAULT_USER_KEY_ALGORITHM,
    encryptedSk: encryptedPrivateKey.encryptedKey,
    encryptedSkIv: encryptedPrivateKey.iv,
  };

  await savePrivateKey(keyPair.privateKey);
  return { privateKey: keyPair.privateKey, userKey, created: true };
}

/** Add another named passkey that unlocks the existing user private key. */
export async function registerAdditionalPasskey(
  user: AuthenticatedUser,
  credentialName: string,
  existingCredentialId?: string
): Promise<VaultUserKey> {
  if (!isPrfSupported()) {
    throw new Error(
      "This browser does not support passkeys with the WebAuthn PRF extension"
    );
  }

  const name = requireCredentialName(credentialName);
  const existing = await getCurrentUserKey();
  if (!existing) {
    throw new Error("Enable encrypted chat storage before adding a passkey");
  }
  const cachedPrivateKey = await loadPrivateKey();
  if (
    !cachedPrivateKey ||
    !(await isPrivateKeyForUser(cachedPrivateKey, existing))
  ) {
    throw new Error("Unlock encrypted chat storage before adding a passkey");
  }
  const credentialId = existingCredentialId ?? existing.credentialId;
  if (!credentialId) {
    throw new Error("There is no passkey for this site to authorize the new one");
  }

  // Cached private keys are deliberately non-extractable. Re-authenticate
  // with an existing passkey and import a temporary exportable copy so it can
  // be encrypted for the new passkey. The temporary key is never persisted.
  const assertionChallenge = await chatVault.assertionChallenge(credentialId);
  const assertion = await assertPasskeyWithResponse({
    credentialId,
    challenge: base64UrlToBuffer(assertionChallenge.challenge),
  });
  await chatVault.submitAssertion({
    credentialId: assertion.credentialId,
    rpId: window.location.hostname,
    challenge: assertionChallenge.challenge,
    authenticatorData: assertion.authenticatorData,
    clientDataJSON: assertion.clientDataJSON,
    signature: assertion.signature,
  });

  const assertedKey = await chatVault.getMyKey();
  if (
    assertedKey.credentialId !== assertion.credentialId ||
    !assertedKey.encryptedSk ||
    !assertedKey.encryptedSkIv
  ) {
    throw new Error("The server did not release the encrypted chat key");
  }
  const existingKPass = await deriveKeyFromPrf(assertion.prfOutput);
  const privateKey = await decryptPrivateKey(
    {
      encryptedKey: assertedKey.encryptedSk,
      iv: assertedKey.encryptedSkIv,
    },
    existingKPass,
    assertedKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM,
    true
  );
  if (!(await isPrivateKeyForUser(privateKey, assertedKey))) {
    throw new Error("The selected passkey could not unlock the chat key");
  }

  const identity = getUserIdentity(user);
  const challenge = await chatVault.registrationChallenge();
  const passkey = await registerPasskey({
    userId: await getWebAuthnUserId(identity.id),
    username: identity.username,
    displayName: identity.displayName,
    challenge: base64UrlToBuffer(challenge.challenge),
  });
  const kPass = await deriveKeyFromPrf(passkey.prfOutput);
  const encryptedPrivateKey = await encryptPrivateKey(privateKey, kPass);

  await chatVault.registerKey({
    credentialId: passkey.credentialId,
    rpId: window.location.hostname,
    credentialName: name,
    publicKey: existing.publicKey,
    publicKeyAlgorithm:
      existing.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM,
    identityDisclosure: existing.identityDisclosure ?? "subject",
    encryptedSk: encryptedPrivateKey.encryptedKey,
    encryptedSkIv: encryptedPrivateKey.iv,
    challenge: challenge.challenge,
    credentialPublicKey: passkey.credentialPublicKey,
  });

  return chatVault.getMyKey();
}

const VAULT_LINK_INFO = "openai-ui-vault-link-v1";

function encodeVaultLinkCode(value: object): string {
  return bufferToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function decodeVaultLinkCode<T>(value: string): T {
  if (!value.trim() || value.length > 16_000) {
    throw new Error("The vault link code is empty or too long");
  }
  try {
    const decoded: unknown = JSON.parse(
      new TextDecoder().decode(base64UrlToBuffer(value.trim()))
    );
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      throw new Error("Invalid vault link payload");
    }
    return decoded as T;
  } catch {
    throw new Error("The vault link code is invalid");
  }
}

function validateTransferId(value: string): string {
  if (!/^[A-Za-z0-9_-]{22}$/.test(value)) {
    throw new Error("The vault link contains an invalid transfer ID");
  }
  try {
    if (base64UrlToBuffer(value).byteLength !== 16) throw new Error();
  } catch {
    throw new Error("The vault link contains an invalid transfer ID");
  }
  return value;
}

function validateLinkOrigin(origin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error("The vault link contains an invalid site address");
  }
  if (
    parsed.origin !== origin ||
    (parsed.protocol !== "https:" &&
      !(parsed.protocol === "http:" && parsed.hostname === "localhost"))
  ) {
    throw new Error("Vault links are only supported on secure sites");
  }
  return parsed.origin;
}

function vaultLinkAdditionalData(payload: {
  transferId: string;
  userId: string;
  targetOrigin: string;
  sourceOrigin: string;
}): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify([
      VAULT_LINK_INFO,
      payload.transferId,
      payload.userId,
      payload.targetOrigin,
      payload.sourceOrigin,
    ])
  );
}

async function deriveVaultLinkKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  transferId: string
): Promise<CryptoKey> {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );
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
      salt: base64UrlToBuffer(transferId),
      info: new TextEncoder().encode(VAULT_LINK_INFO),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/** Create the destination-side, one-time request for linking this site's RP ID. */
export async function createVaultLinkRequest(): Promise<VaultLinkTarget> {
  const userKey = await getCurrentUserKey();
  if (!userKey) {
    throw new Error("There is no existing vault to link on this account");
  }
  if (userKey.credentials?.length) {
    throw new Error("This site already has a registered passkey");
  }

  const keyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  const transferId = bufferToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const targetOrigin = validateLinkOrigin(window.location.origin);
  const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const request: VaultLinkRequestPayload = {
    type: "openai-ui-vault-link-request",
    version: 1,
    transferId: validateTransferId(transferId),
    userId: userKey.userId,
    targetOrigin,
    publicKey: bufferToBase64Url(publicKey),
  };

  return {
    requestCode: encodeVaultLinkCode(request),
    privateKey: keyPair.privateKey,
    transferId,
    userId: userKey.userId,
    targetOrigin,
  };
}

export function getVaultLinkRequestOrigin(requestCode: string): string {
  const request = decodeVaultLinkCode<VaultLinkRequestPayload>(requestCode);
  if (
    request.type !== "openai-ui-vault-link-request" ||
    request.version !== 1
  ) {
    throw new Error("This is not a valid vault link request");
  }
  validateTransferId(request.transferId);
  return validateLinkOrigin(request.targetOrigin);
}

type PreparedVaultLinkRequest = {
  request: VaultLinkRequestPayload;
  targetOrigin: string;
  sourceOrigin: string;
  targetPublicKey: CryptoKey;
};

async function prepareVaultLinkRequest(
  requestCode: string
): Promise<PreparedVaultLinkRequest> {
  const request = decodeVaultLinkCode<VaultLinkRequestPayload>(requestCode);
  if (
    request.type !== "openai-ui-vault-link-request" ||
    request.version !== 1 ||
    typeof request.userId !== "string" ||
    !request.userId ||
    request.userId.length > 256
  ) {
    throw new Error("This is not a valid vault link request");
  }
  validateTransferId(request.transferId);
  const targetOrigin = validateLinkOrigin(request.targetOrigin);
  const sourceOrigin = validateLinkOrigin(window.location.origin);
  if (sourceOrigin === targetOrigin) {
    throw new Error("Choose a request from a different site");
  }

  if (typeof request.publicKey !== "string") {
    throw new Error("The destination key in the vault link is invalid");
  }
  const targetPublicKeyBytes = base64UrlToBuffer(request.publicKey);
  if (targetPublicKeyBytes.byteLength !== 65) {
    throw new Error("The destination key in the vault link is invalid");
  }
  const targetPublicKey = await crypto.subtle.importKey(
    "raw",
    targetPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  return { request, targetOrigin, sourceOrigin, targetPublicKey };
}

async function requireVaultLinkSourceAccount(
  prepared: PreparedVaultLinkRequest,
  sourceCredentialId?: string
): Promise<void> {
  const { request, targetOrigin } = prepared;
  const current = await getCurrentUserKey();
  if (!current || current.userId !== request.userId) {
    throw new Error("The request belongs to a different signed-in account");
  }
  if (!current.allowedOrigins?.includes(targetOrigin)) {
    throw new Error("That site is not allowed to access this vault backend");
  }
  const activeCredentialId = await loadActiveCredentialId();
  const credentialIsVisible = current.credentials?.some(
    (credential) => credential.credentialId === sourceCredentialId
  );
  if (
    sourceCredentialId &&
    !credentialIsVisible &&
    activeCredentialId !== sourceCredentialId
  ) {
    throw new Error("Choose a passkey registered for this site");
  }
}

async function unlockVaultLinkSourceKey(
  sourceCredentialId?: string
): Promise<CryptoKey> {
  const challenge = await chatVault.assertionChallenge(sourceCredentialId);
  const assertion = await assertPasskeyWithResponse({
    credentialId: sourceCredentialId,
    challenge: base64UrlToBuffer(challenge.challenge),
  });
  await chatVault.submitAssertion({
    credentialId: assertion.credentialId,
    rpId: window.location.hostname,
    challenge: challenge.challenge,
    authenticatorData: assertion.authenticatorData,
    clientDataJSON: assertion.clientDataJSON,
    signature: assertion.signature,
  });

  const assertedKey = await chatVault.getMyKey();
  if (
    assertedKey.credentialId !== assertion.credentialId ||
    !assertedKey.encryptedSk ||
    !assertedKey.encryptedSkIv
  ) {
    throw new Error("The server did not release the encrypted chat key");
  }
  const kPass = await deriveKeyFromPrf(assertion.prfOutput);
  const privateKey = await decryptPrivateKey(
    { encryptedKey: assertedKey.encryptedSk, iv: assertedKey.encryptedSkIv },
    kPass,
    assertedKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM,
    true
  );
  if (!(await isPrivateKeyForUser(privateKey, assertedKey))) {
    throw new Error("The selected passkey could not unlock the chat key");
  }
  return privateKey;
}

async function encryptVaultLinkResponse(
  prepared: PreparedVaultLinkRequest,
  privateKey: CryptoKey
): Promise<string> {
  const { request, targetOrigin, sourceOrigin, targetPublicKey } = prepared;
  const sourcePair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  )) as CryptoKeyPair;
  const linkKey = await deriveVaultLinkKey(
    sourcePair.privateKey,
    targetPublicKey,
    request.transferId
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: vaultLinkAdditionalData({
          transferId: request.transferId,
          userId: request.userId,
          targetOrigin,
          sourceOrigin,
        }),
      },
      linkKey,
      pkcs8
    );
  } finally {
    new Uint8Array(pkcs8).fill(0);
  }

  const sourcePublicKey = await crypto.subtle.exportKey(
    "raw",
    sourcePair.publicKey
  );
  const response: VaultLinkResponsePayload = {
    type: "openai-ui-vault-link-response",
    version: 1,
    transferId: request.transferId,
    userId: request.userId,
    targetOrigin,
    sourceOrigin,
    publicKey: bufferToBase64Url(sourcePublicKey),
    iv: bufferToBase64Url(iv),
    ciphertext: bufferToBase64Url(ciphertext),
  };
  return encodeVaultLinkCode(response);
}

/** Unlock the vault on its existing site and encrypt it to the destination's one-time key. */
export async function createVaultLinkResponse(
  requestCode: string,
  sourceCredentialId?: string
): Promise<string> {
  const prepared = await prepareVaultLinkRequest(requestCode);
  await requireVaultLinkSourceAccount(prepared, sourceCredentialId);
  const privateKey = await unlockVaultLinkSourceKey(sourceCredentialId);
  return encryptVaultLinkResponse(prepared, privateKey);
}

type PreparedVaultLinkResponse = {
  response: VaultLinkResponsePayload;
  sourceOrigin: string;
};

type ImportedVaultLinkResponse = PreparedVaultLinkResponse & {
  sourcePublicKey: CryptoKey;
  iv: Uint8Array;
  ciphertext: Uint8Array;
};

function prepareVaultLinkResponse(
  responseCode: string,
  target: VaultLinkTarget
): PreparedVaultLinkResponse {
  const response = decodeVaultLinkCode<VaultLinkResponsePayload>(responseCode);
  if (
    response.type !== "openai-ui-vault-link-response" ||
    response.version !== 1 ||
    response.transferId !== target.transferId ||
    response.userId !== target.userId ||
    response.targetOrigin !== target.targetOrigin ||
    validateLinkOrigin(response.targetOrigin) !== window.location.origin
  ) {
    throw new Error("This vault transfer does not match the request on this site");
  }
  validateTransferId(response.transferId);
  const sourceOrigin = validateLinkOrigin(response.sourceOrigin);
  return { response, sourceOrigin };
}

async function importVaultLinkResponse(
  prepared: PreparedVaultLinkResponse
): Promise<ImportedVaultLinkResponse> {
  const { response, sourceOrigin } = prepared;
  if (
    typeof response.publicKey !== "string" ||
    typeof response.iv !== "string" ||
    typeof response.ciphertext !== "string"
  ) {
    throw new Error("The vault response code is invalid");
  }
  const sourcePublicKeyBytes = base64UrlToBuffer(response.publicKey);
  const iv = base64UrlToBuffer(response.iv);
  const ciphertext = base64UrlToBuffer(response.ciphertext);
  if (
    sourcePublicKeyBytes.byteLength !== 65 ||
    iv.byteLength !== 12 ||
    ciphertext.byteLength < 16
  ) {
    throw new Error("The vault response code is invalid");
  }
  const sourcePublicKey = await crypto.subtle.importKey(
    "raw",
    sourcePublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  return { ...prepared, sourcePublicKey, iv, ciphertext };
}

async function requireVaultLinkTargetVault(
  target: VaultLinkTarget,
  sourceOrigin: string
): Promise<VaultUserKey> {
  const existing = await getCurrentUserKey();
  if (
    !existing ||
    existing.userId !== target.userId ||
    existing.credentials?.length
  ) {
    throw new Error("This site already has a passkey or the account does not match");
  }
  if (!existing.allowedOrigins?.includes(sourceOrigin)) {
    throw new Error("The sending site is not allowed to access this vault backend");
  }
  return existing;
}

async function decryptVaultLinkPrivateKey(
  prepared: ImportedVaultLinkResponse,
  target: VaultLinkTarget,
  existing: VaultUserKey
): Promise<{ pkcs8: ArrayBuffer; algorithm: UserKeyAlgorithm }> {
  const { response, sourceOrigin, sourcePublicKey, iv, ciphertext } = prepared;
  const linkKey = await deriveVaultLinkKey(
    target.privateKey,
    sourcePublicKey,
    target.transferId
  );
  const pkcs8 = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: vaultLinkAdditionalData({
        transferId: response.transferId,
        userId: response.userId,
        targetOrigin: response.targetOrigin,
        sourceOrigin,
      }),
    },
    linkKey,
    ciphertext
  );
  return {
    pkcs8,
    algorithm: existing.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM,
  };
}

async function registerVaultLinkPasskey(
  user: AuthenticatedUser,
  credentialName: string,
  existing: VaultUserKey,
  pkcs8: ArrayBuffer,
  algorithm: UserKeyAlgorithm
): Promise<CryptoKey> {
  try {
    const privateKey = await importPrivateKey(pkcs8, algorithm, true);
    if (!(await isPrivateKeyForUser(privateKey, existing))) {
      throw new Error("The transferred key does not match this account's vault");
    }

    const identity = getUserIdentity(user);
    const challenge = await chatVault.registrationChallenge();
    const passkey = await registerPasskey({
      userId: await getWebAuthnUserId(identity.id),
      username: identity.username,
      displayName: identity.displayName,
      challenge: base64UrlToBuffer(challenge.challenge),
    });
    const kPass = await deriveKeyFromPrf(passkey.prfOutput);
    const encryptedPrivateKey = await encryptPrivateKey(privateKey, kPass);
    const cachedPrivateKey = await importPrivateKey(pkcs8, algorithm, false);
    await chatVault.registerKey({
      credentialId: passkey.credentialId,
      rpId: window.location.hostname,
      credentialName: requireCredentialName(credentialName),
      publicKey: existing.publicKey,
      publicKeyAlgorithm: algorithm,
      identityDisclosure: existing.identityDisclosure ?? "subject",
      encryptedSk: encryptedPrivateKey.encryptedKey,
      encryptedSkIv: encryptedPrivateKey.iv,
      challenge: challenge.challenge,
      credentialPublicKey: passkey.credentialPublicKey,
    });
    return cachedPrivateKey;
  } finally {
    new Uint8Array(pkcs8).fill(0);
  }
}

/** Import the one-time transfer on the destination and register its first passkey. */
export async function completeVaultLink(
  user: AuthenticatedUser,
  credentialName: string,
  target: VaultLinkTarget,
  responseCode: string
): Promise<VaultUserKey> {
  const responseIdentity = prepareVaultLinkResponse(responseCode, target);
  const existing = await requireVaultLinkTargetVault(
    target,
    responseIdentity.sourceOrigin
  );
  const prepared = await importVaultLinkResponse(responseIdentity);
  const { pkcs8, algorithm } = await decryptVaultLinkPrivateKey(
    prepared,
    target,
    existing
  );
  const cachedPrivateKey = await registerVaultLinkPasskey(
    user,
    credentialName,
    existing,
    pkcs8,
    algorithm
  );
  await savePrivateKey(cachedPrivateKey);
  return chatVault.getMyKey();
}

function requireCredentialName(value?: string): string {
  const name = value?.trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error("Enter a name between 1 and 80 printable characters");
  }
  return name;
}

async function getWebAuthnUserId(identity: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(identity)
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
