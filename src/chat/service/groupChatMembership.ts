import {
  chatVault,
  type VaultGroupChat,
  type VaultGroupMember,
  type VaultPublicKey,
  type VaultUserKey,
} from "./chatVault";
import {
  generateChatKey,
  LEGACY_RSA_KEY_ALGORITHM,
  unwrapChatKey,
  wrapChatKey,
} from "../utils/zeroKnowledgeCrypto";
import {
  publicKeyFingerprint,
  type SavedGroupRoster,
} from "./groupChatRosters";

async function resolveRosterPublicKeys(
  roster: SavedGroupRoster,
  ownerId: string
): Promise<{ userId: string; publicKey: VaultPublicKey }[]> {
  const resolved = await Promise.all(
    roster.members.map(async (member) => {
      const publicKey = await chatVault.getPublicKey(member.userId);
      const fingerprint = await publicKeyFingerprint(publicKey);
      if (fingerprint !== member.publicKeyFingerprint) {
        throw new Error(
          `The registered key for ${member.email} changed. Verify their new key before sharing.`
        );
      }
      return { userId: member.userId, publicKey };
    })
  );
  if (resolved.some((member) => member.userId === ownerId)) {
    throw new Error("The roster unexpectedly contains your account");
  }
  return resolved;
}

export async function createVaultGroupChat(
  chatId: string,
  roster: SavedGroupRoster,
  userKey: VaultUserKey,
  privateKey: CryptoKey,
  chatKey: CryptoKey
): Promise<VaultGroupChat> {
  const recipientKeys = await resolveRosterPublicKeys(roster, userKey.userId);
  const members = [
    userKey.userId,
    ...recipientKeys.map((member) => member.userId),
  ];
  const publicKeys = [
    {
      userId: userKey.userId,
      publicKey: {
        userId: userKey.userId,
        publicKey: userKey.publicKey,
        publicKeyAlgorithm: userKey.publicKeyAlgorithm,
      } satisfies VaultPublicKey,
    },
    ...recipientKeys,
  ];
  const envelopes = await Promise.all(
    publicKeys.map(async ({ userId, publicKey }) => ({
      recipientId: userId,
      ...(await wrapChatKey(
        chatKey,
        publicKey.publicKey,
        publicKey.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      )),
    }))
  );
  await chatVault.createGroupChat(chatId, { members, envelopes });
  const group = await chatVault.getGroupChat(chatId);
  const keys = new Map([[1, chatKey]]);
  for (const envelope of group.envelopes) {
    if (!keys.has(envelope.epoch)) {
      keys.set(envelope.epoch, await unwrapChatKey(envelope, privateKey));
    }
  }
  return group;
}

async function rotateGroupMembership(
  chatId: string,
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  memberIds: string[],
  addedMemberIds: Set<string>
): Promise<{ group: VaultGroupChat; epochKeys: Map<number, CryptoKey> }> {
  const nextEpoch = group.currentEpoch + 1;
  const nextKey = await generateChatKey();
  const currentKeys = await Promise.all(
    memberIds.map(async (userId) => ({
      userId,
      key: await chatVault.getPublicKey(userId),
    }))
  );
  const envelopes: (Awaited<ReturnType<typeof wrapChatKey>> & {
    recipientId: string;
    epoch: number;
  })[] = [];

  for (const { userId, key } of currentKeys) {
    envelopes.push({
      recipientId: userId,
      epoch: nextEpoch,
      ...(await wrapChatKey(
        nextKey,
        key.publicKey,
        key.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
      )),
    });
    if (addedMemberIds.has(userId)) {
      for (const [epoch, epochKey] of epochKeys) {
        envelopes.push({
          recipientId: userId,
          epoch,
          ...(await wrapChatKey(
            epochKey,
            key.publicKey,
            key.publicKeyAlgorithm ?? LEGACY_RSA_KEY_ALGORITHM
          )),
        });
      }
    }
  }

  await chatVault.updateGroupMembership(chatId, {
    baseEpoch: group.currentEpoch,
    members: memberIds,
    envelopes,
  });
  const updated = await chatVault.getGroupChat(chatId);
  const nextEpochKeys = new Map(epochKeys);
  nextEpochKeys.set(nextEpoch, nextKey);
  return { group: updated, epochKeys: nextEpochKeys };
}

export async function inviteVaultGroupMember(
  chatId: string,
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  email: string,
  currentUserId: string,
  expectedFingerprint: string
): Promise<{ group: VaultGroupChat; epochKeys: Map<number, CryptoKey> }> {
  if (group.ownerId !== currentUserId) {
    throw new Error("Only the group owner can change membership");
  }
  for (let epoch = 1; epoch <= group.currentEpoch; epoch += 1) {
    if (!epochKeys.has(epoch)) {
      throw new Error(`The key for group chat epoch ${epoch} is unavailable`);
    }
  }
  const recipient = await chatVault.lookupKeyByEmail(email.trim());
  if ((await publicKeyFingerprint(recipient)) !== expectedFingerprint) {
    throw new Error(
      "The registered key changed. Verify the new fingerprint before inviting this member."
    );
  }
  if (recipient.userId === currentUserId) {
    throw new Error("You are already a member of this group");
  }
  if (group.members.some((member) => member.userId === recipient.userId)) {
    throw new Error("This person is already a member of the group");
  }
  return rotateGroupMembership(
    chatId,
    group,
    epochKeys,
    [...group.members.map((member) => member.userId), recipient.userId],
    new Set([recipient.userId])
  );
}

export async function removeVaultGroupMember(
  chatId: string,
  group: VaultGroupChat,
  epochKeys: Map<number, CryptoKey>,
  memberId: string,
  currentUserId: string
): Promise<{ group: VaultGroupChat; epochKeys: Map<number, CryptoKey> }> {
  if (group.ownerId !== currentUserId) {
    throw new Error("Only the group owner can change membership");
  }
  if (memberId === group.ownerId) {
    throw new Error("The group owner cannot remove themself");
  }
  if (!group.members.some((member) => member.userId === memberId))
    return { group, epochKeys };
  return rotateGroupMembership(
    chatId,
    group,
    epochKeys,
    group.members
      .filter((member) => member.userId !== memberId)
      .map((member) => member.userId),
    new Set()
  );
}

export function activeGroupMemberIds(group: VaultGroupChat): string[] {
  return group.members.map((member: VaultGroupMember) => member.userId);
}
