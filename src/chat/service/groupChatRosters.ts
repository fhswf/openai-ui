import {
  chatVault,
  VaultError,
  type VaultPublicKey,
  type VaultUserKey,
} from "./chatVault";
import {
  decryptChatData,
  encryptChatData,
  generateChatKey,
  bufferToBase64Url,
  LEGACY_RSA_KEY_ALGORITHM,
  unwrapChatKey,
  wrapChatKey,
} from "../utils/zeroKnowledgeCrypto";

export type SavedGroupRoster = {
  id: string;
  name: string;
  members: { userId: string; email: string; publicKeyFingerprint: string }[];
};

type EncryptedRosterCatalog = { version: 1; rosters: SavedGroupRoster[] };

export function isGroupRosterCatalogDecryptionFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "OperationError"
  );
}

async function getCatalog(
  privateKey: CryptoKey
): Promise<{
  catalog: EncryptedRosterCatalog;
  key: CryptoKey;
  rev: number;
} | null> {
  try {
    const encrypted = await chatVault.getGroupCatalog();
    const key = await unwrapChatKey(encrypted.selfEnvelope, privateKey);
    const catalog = await decryptChatData<EncryptedRosterCatalog>(
      encrypted,
      key
    );
    return { catalog, key, rev: encrypted.rev };
  } catch (error) {
    if (error instanceof VaultError && error.status === 404) return null;
    throw error;
  }
}

export async function loadSavedGroupRosters(
  privateKey: CryptoKey
): Promise<SavedGroupRoster[]> {
  const saved = await getCatalog(privateKey);
  return saved?.catalog.version === 1 ? saved.catalog.rosters : [];
}

export async function publicKeyFingerprint(
  key: VaultPublicKey
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key.publicKey)
  );
  return bufferToBase64Url(digest);
}

export async function lookupGroupInviteTarget(
  email: string
): Promise<{ userId: string; email: string; publicKeyFingerprint: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter a member email address");
  const key = await chatVault.lookupKeyByEmail(normalizedEmail);
  return {
    userId: key.userId,
    email: normalizedEmail,
    publicKeyFingerprint: await publicKeyFingerprint(key),
  };
}

export async function saveGroupRoster(
  userKey: VaultUserKey,
  privateKey: CryptoKey,
  name: string,
  emails: string[]
): Promise<SavedGroupRoster[]> {
  const cleanedName = name.trim();
  if (!cleanedName) throw new Error("Enter a name for this group");
  const uniqueEmails = [
    ...new Set(
      emails.map((email) => email.trim().toLowerCase()).filter(Boolean)
    ),
  ];
  const members = await Promise.all(
    uniqueEmails.map(async (email) => {
      const key = await chatVault.lookupKeyByEmail(email);
      if (key.userId === userKey.userId) {
        throw new Error("Your account is added automatically to each group");
      }
      return {
        userId: key.userId,
        email,
        publicKeyFingerprint: await publicKeyFingerprint(key),
      };
    })
  );
  if (new Set(members.map((member) => member.userId)).size !== members.length) {
    throw new Error("The same account was added more than once");
  }

  const previous = await getCatalog(privateKey);
  const roster: SavedGroupRoster = {
    id: crypto.randomUUID(),
    name: cleanedName,
    members,
  };
  const next = {
    version: 1 as const,
    rosters: [...(previous?.catalog.rosters ?? []), roster],
  };
  const key = previous?.key ?? (await generateChatKey());
  const encrypted = await encryptChatData(next, key);
  const wrapped = await wrapChatKey(
    key,
    userKey.publicKey,
    userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
  );
  await chatVault.putGroupCatalog({
    ...encrypted,
    selfEnvelope: { recipientId: userKey.userId, ...wrapped },
    ...(previous ? { baseRev: previous.rev } : {}),
  });
  return next.rosters;
}

export async function deleteGroupRoster(
  userKey: VaultUserKey,
  privateKey: CryptoKey,
  rosterId: string
): Promise<SavedGroupRoster[]> {
  const previous = await getCatalog(privateKey);
  if (!previous) return [];
  const next = {
    ...previous.catalog,
    rosters: previous.catalog.rosters.filter(
      (roster) => roster.id !== rosterId
    ),
  };
  const encrypted = await encryptChatData(next, previous.key);
  await chatVault.putGroupCatalog({
    ...encrypted,
    selfEnvelope: {
      recipientId: userKey.userId,
      ...(await wrapChatKey(
        previous.key,
        userKey.publicKey,
        userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      )),
    },
    baseRev: previous.rev,
  });
  return next.rosters;
}

/** Replace an unreadable saved-roster catalog with an empty catalog. */
export async function resetSavedGroupRosters(
  userKey: VaultUserKey
): Promise<SavedGroupRoster[]> {
  let baseRev = 0;
  try {
    const existing = await chatVault.getGroupCatalog();
    baseRev = existing.rev;
  } catch (error) {
    if (!(error instanceof VaultError && error.status === 404)) throw error;
  }

  const catalog: EncryptedRosterCatalog = { version: 1, rosters: [] };
  const key = await generateChatKey();
  const encrypted = await encryptChatData(catalog, key);
  const wrapped = await wrapChatKey(
    key,
    userKey.publicKey,
    userKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
  );
  await chatVault.putGroupCatalog({
    ...encrypted,
    selfEnvelope: { recipientId: userKey.userId, ...wrapped },
    baseRev,
  });
  return [];
}
