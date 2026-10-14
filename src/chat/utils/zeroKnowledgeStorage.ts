import { VaultError, chatVault, type VaultUserKey } from "../service/chatVault";
import {
  decryptPrivateKey,
  DEFAULT_USER_KEY_ALGORITHM,
  deriveKeyFromPrf,
  encryptPrivateKey,
  exportPublicKey,
  generateChatKey,
  generateUserKeyPair,
  LEGACY_RSA_KEY_ALGORITHM,
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
import { loadPrivateKey, savePrivateKey } from "./zeroKnowledgeKeystore";

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

export function getZeroKnowledgeStorageErrorKey(
  error: unknown
):
  | "zk_storage_rp_id_mismatch"
  | "zk_storage_prf_unsupported"
  | "zk_storage_passkey_mismatch"
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
    const challenge = await chatVault.assertionChallenge(credentialId);
    const assertion = await assertPasskeyWithResponse({
      credentialId,
      challenge: base64UrlToBuffer(challenge.challenge),
    });
    await chatVault.submitAssertion({
      credentialId: assertion.credentialId,
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
  credentialName: string
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
  const privateKey = await loadPrivateKey();
  if (!privateKey || !(await isPrivateKeyForUser(privateKey, existing))) {
    throw new Error("Unlock encrypted chat storage before adding a passkey");
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
    credentialName: name,
    publicKey: existing.publicKey,
    publicKeyAlgorithm:
      existing.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM,
    encryptedSk: encryptedPrivateKey.encryptedKey,
    encryptedSkIv: encryptedPrivateKey.iv,
    challenge: challenge.challenge,
    credentialPublicKey: passkey.credentialPublicKey,
  });

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
