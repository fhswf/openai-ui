import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "../../context/types";
import {
  encryptChatData,
  exportPublicKey,
  generateChatKey,
  generateUserKeyPair,
  wrapChatKey,
} from "../../utils/zeroKnowledgeCrypto";
import type { VaultChat, VaultUserKey } from "../chatVault";

const listChats = vi.fn();
const getChat = vi.fn();
const putChat = vi.fn();
const deleteChat = vi.fn();

vi.mock("../chatVault", async () => {
  const actual = await vi.importActual<typeof import("../chatVault")>(
    "../chatVault"
  );
  return {
    ...actual,
    chatVault: {
      listChats: (...args: unknown[]) => listChats(...args),
      getChat: (...args: unknown[]) => getChat(...args),
      putChat: (...args: unknown[]) => putChat(...args),
      deleteChat: (...args: unknown[]) => deleteChat(...args),
    },
  };
});

import {
  createVaultSyncCache,
  demoteVaultChat,
  hydrateVaultChat,
  markVaultChats,
  restoreVaultChats,
  searchVaultChats,
  syncVaultChats,
  toVaultPlaceholder,
} from "../zeroKnowledgeSync";

function makeChat(id: string, messageCount: number): Chat {
  return {
    id,
    title: `Chat ${id}`,
    app: 0,
    ct: 1_700_000_000_000,
    messages: Array.from({ length: messageCount }, (_, index) => ({
      id: `${id}-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `message ${index}`,
    })),
  };
}

/** Build a vault user key plus a matching private key and an encrypted chat. */
async function makeVault(chat: Chat) {
  const pair = await generateUserKeyPair();
  const publicKey = await exportPublicKey(pair.publicKey);
  const userKey: VaultUserKey = {
    userId: "user-1",
    credentialId: "cred-1",
    publicKey,
    publicKeyAlgorithm: "ECDH-P256",
  };
  const chatKey = await generateChatKey();
  const payload = await encryptChatData(chat, chatKey);
  const envelope = await wrapChatKey(chatKey, publicKey, "ECDH-P256");
  const vaultChat: VaultChat = {
    id: String(chat.id),
    ownerId: "user-1",
    rev: 1,
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    envelopes: [
      {
        recipientId: "user-1",
        envelopeAlgorithm: envelope.envelopeAlgorithm,
        ephemeralPublicKey: envelope.ephemeralPublicKey,
        wrappedKey: envelope.wrappedKey,
        wrappedKeyIv: envelope.wrappedKeyIv,
      },
    ],
  };
  return { privateKey: pair.privateKey, userKey, vaultChat };
}

describe("lazy vault history", () => {
  beforeEach(() => {
    listChats.mockReset();
    getChat.mockReset();
    putChat.mockReset();
    deleteChat.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stores only a placeholder when lazy history is enabled", async () => {
    const chat = makeChat("c1", 4);
    const { privateKey, userKey, vaultChat } = await makeVault(chat);
    listChats.mockResolvedValue([
      { id: "c1", ownerId: "user-1", updatedAt: "", rev: 1 },
    ]);
    getChat.mockResolvedValue(vaultChat);

    const cache = createVaultSyncCache();
    const restored = await restoreVaultChats([], privateKey, userKey, cache, {
      lazy: true,
    });

    expect(restored).toHaveLength(1);
    expect(restored[0].messages).toEqual([]);
    expect(restored[0].vault).toMatchObject({
      rev: 1,
      ownerId: "user-1",
      messageCount: 4,
      preview: "message 0",
    });
    // The transcript is kept in memory for this session.
    expect(cache.transcripts.get("c1")?.messages).toHaveLength(4);
  });

  it("reuses an unchanged placeholder without downloading the transcript again", async () => {
    const chat = makeChat("c1", 3);
    const placeholder = toVaultPlaceholder(chat, "user-1", 1);
    listChats.mockResolvedValue([
      { id: "c1", ownerId: "user-1", updatedAt: "", rev: 1 },
    ]);

    const cache = createVaultSyncCache();
    const restored = await restoreVaultChats(
      [placeholder],
      {} as CryptoKey,
      {} as VaultUserKey,
      cache,
      { lazy: true }
    );

    expect(restored[0]).toBe(placeholder);
    expect(getChat).not.toHaveBeenCalled();
  });

  it("downloads and hydrates a placeholder on demand", async () => {
    const chat = makeChat("c1", 2);
    const { privateKey, userKey, vaultChat } = await makeVault(chat);
    getChat.mockResolvedValue(vaultChat);

    const cache = createVaultSyncCache();
    const placeholder = toVaultPlaceholder(chat, "user-1", 1);
    const hydrated = await hydrateVaultChat(
      placeholder,
      privateKey,
      userKey,
      cache
    );

    expect(hydrated.messages.map((item) => item.content)).toEqual([
      "message 0",
      "message 1",
    ]);
    // The descriptor is retained so persistence can drop the transcript again.
    expect(hydrated.vault).toMatchObject({ rev: 1, ownerId: "user-1" });

    // A second call is served from the in-memory cache.
    await hydrateVaultChat(placeholder, privateKey, userKey, cache);
    expect(getChat).toHaveBeenCalledTimes(1);
  });

  it("reuses a locally available transcript instead of downloading it", async () => {
    const chat = makeChat("c1", 3);
    listChats.mockResolvedValue([
      { id: "c1", ownerId: "user-1", updatedAt: "", rev: 1 },
    ]);

    const cache = createVaultSyncCache();
    const restored = await restoreVaultChats(
      [chat],
      {} as CryptoKey,
      { userId: "user-1" } as VaultUserKey,
      cache,
      { lazy: true }
    );

    expect(getChat).not.toHaveBeenCalled();
    expect(restored[0].messages).toEqual([]);
    expect(restored[0].vault).toMatchObject({ rev: 1, messageCount: 3 });
    // The transcript stays available for the rest of the session.
    expect(cache.transcripts.get("c1")).toBe(chat);
  });

  it("serves a hydrated chat from memory instead of downloading it again", async () => {
    const chat = makeChat("c1", 3);
    const { privateKey, userKey, vaultChat } = await makeVault(chat);
    getChat.mockResolvedValue(vaultChat);

    const cache = createVaultSyncCache();
    const placeholder = toVaultPlaceholder(chat, "user-1", 1);
    const hydrated = await hydrateVaultChat(
      placeholder,
      privateKey,
      userKey,
      cache
    );
    expect(getChat).toHaveBeenCalledTimes(1);

    listChats.mockResolvedValue([
      { id: "c1", ownerId: "user-1", updatedAt: "", rev: 1 },
    ]);
    const restored = await restoreVaultChats(
      [hydrated],
      privateKey,
      userKey,
      cache,
      { lazy: true }
    );

    expect(getChat).toHaveBeenCalledTimes(1);
    expect(restored[0].messages).toHaveLength(3);
    expect(restored[0].vault).toMatchObject({ rev: 1 });
  });

  it("keeps placeholder metadata when the revision changes", () => {
    const chat = makeChat("c1", 3);
    const placeholder = {
      ...toVaultPlaceholder(chat, "user-1", 1),
      messages: [],
    };
    const cache = createVaultSyncCache();
    cache.revisions.set("c1", 2);
    cache.owners.set("c1", "user-1");

    const marked = markVaultChats([placeholder], cache, {
      userId: "user-1",
    } as VaultUserKey);

    expect(marked?.[0].vault).toMatchObject({
      rev: 2,
      messageCount: 3,
      preview: "message 0",
    });
    expect(marked?.[0].messages).toEqual([]);
  });

  it("re-encrypts a local copy when the vault chat cannot be opened", async () => {
    const chat = makeChat("c1", 2);
    const { privateKey, userKey } = await makeVault(chat);
    listChats.mockResolvedValue([
      { id: "c1", ownerId: "user-1", updatedAt: "", rev: 1 },
    ]);
    // No envelope for the current user, so the chat cannot be decrypted.
    getChat.mockResolvedValue({
      id: "c1",
      ownerId: "user-1",
      rev: 1,
      ciphertext: "x",
      iv: "y",
      envelopes: [],
    });
    putChat.mockResolvedValue({
      id: "c1",
      ownerId: "user-1",
      rev: 2,
      ciphertext: "",
      iv: "",
      envelopes: [],
    });

    const cache = createVaultSyncCache();
    const restored = await restoreVaultChats(
      [chat],
      privateKey,
      userKey,
      cache
    );

    expect(restored[0]).toBe(chat);
    expect(putChat).toHaveBeenCalledTimes(1);
  });

  it("keeps a shared chat that cannot be opened without re-uploading it", async () => {
    const chat = makeChat("c1", 2);
    listChats.mockResolvedValue([
      { id: "c1", ownerId: "someone-else", updatedAt: "", rev: 1 },
    ]);
    getChat.mockResolvedValue({
      id: "c1",
      ownerId: "someone-else",
      rev: 1,
      ciphertext: "x",
      iv: "y",
      envelopes: [],
    });

    const cache = createVaultSyncCache();
    const restored = await restoreVaultChats(
      [chat],
      {} as CryptoKey,
      { userId: "user-1" } as VaultUserKey,
      cache
    );

    expect(restored[0]).toBe(chat);
    expect(putChat).not.toHaveBeenCalled();
  });

  it("searches placeholders by loading only the matching transcripts", async () => {
    const matching = makeChat("match", 2);
    const other = {
      ...makeChat("other", 2),
      messages: [
        { id: "o1", role: "user", content: "nothing to see" },
        { id: "o2", role: "assistant", content: "here" },
      ],
    };
    const matchingVault = await makeVault(matching);
    const otherVault = await makeVault(other);
    getChat.mockImplementation((id: string) =>
      Promise.resolve(
        id === "match" ? matchingVault.vaultChat : otherVault.vaultChat
      )
    );

    const cache = createVaultSyncCache();
    const placeholders = [
      toVaultPlaceholder(matching, "user-1", 1),
      toVaultPlaceholder(other, "user-1", 1),
    ];
    const matches = await searchVaultChats(
      placeholders,
      "message 1",
      matchingVault.privateKey,
      matchingVault.userKey,
      cache
    );

    expect(matches.map((chat) => String(chat.id))).toEqual(["match"]);
    expect(matches[0].messages).toHaveLength(2);
    // The non-matching transcript is not kept in memory.
    expect(cache.transcripts.has("other")).toBe(false);
    expect(cache.transcripts.has("match")).toBe(true);
  });

  it("searches a hydrated chat without downloading it again", async () => {
    const chat = makeChat("c1", 2);
    const { privateKey, userKey, vaultChat } = await makeVault(chat);
    getChat.mockResolvedValue(vaultChat);

    const cache = createVaultSyncCache();
    const hydrated = await hydrateVaultChat(
      toVaultPlaceholder(chat, "user-1", 1),
      privateKey,
      userKey,
      cache
    );
    getChat.mockClear();

    const matches = await searchVaultChats(
      [hydrated],
      "message 0",
      privateKey,
      userKey,
      cache
    );

    expect(matches).toHaveLength(1);
    expect(getChat).not.toHaveBeenCalled();
  });

  it("still matches a placeholder by its preview when it cannot be loaded", async () => {
    const chat = makeChat("c1", 2);
    getChat.mockRejectedValue(new Error("offline"));

    const cache = createVaultSyncCache();
    const matches = await searchVaultChats(
      [toVaultPlaceholder(chat, "user-1", 1)],
      "message 0",
      {} as CryptoKey,
      { userId: "user-1" } as VaultUserKey,
      cache
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].messages).toEqual([]);
  });

  it("demotes a hydrated chat back to a placeholder", () => {
    const chat = makeChat("c1", 3);
    const hydrated: Chat = {
      ...chat,
      vault: {
        rev: 5,
        ownerId: "user-1",
        messageCount: 3,
        preview: "message 0",
        updatedAt: chat.ct,
      },
    };

    const demoted = demoteVaultChat(hydrated);

    expect(demoted.messages).toEqual([]);
    expect(demoted.vault).toMatchObject({
      rev: 5,
      ownerId: "user-1",
      messageCount: 3,
      preview: "message 0",
    });
    expect(demoted.title).toBe(chat.title);
  });

  it("does not overwrite a remote transcript from a placeholder", async () => {
    const chat = makeChat("c1", 5);
    const placeholder = toVaultPlaceholder(chat, "user-1", 1);
    const cache = createVaultSyncCache();
    cache.revisions.set("c1", 1);
    cache.owners.set("c1", "user-1");

    await syncVaultChats([placeholder], {} as VaultUserKey, cache);

    expect(putChat).not.toHaveBeenCalled();
    expect(deleteChat).not.toHaveBeenCalled();
  });

  it("uploads an edit once a placeholder has been hydrated", async () => {
    const chat = makeChat("c1", 2);
    const { privateKey, userKey, vaultChat } = await makeVault(chat);
    getChat.mockResolvedValue(vaultChat);
    putChat.mockResolvedValue({ ...vaultChat, rev: 2 });

    const cache = createVaultSyncCache();
    const placeholder = toVaultPlaceholder(chat, "user-1", 1);
    const hydrated = await hydrateVaultChat(
      placeholder,
      privateKey,
      userKey,
      cache
    );
    hydrated.messages = [
      ...hydrated.messages,
      { id: "new", role: "user", content: "hello again" },
    ];

    await syncVaultChats([hydrated], userKey, cache);

    expect(putChat).toHaveBeenCalledTimes(1);
    expect(cache.revisions.get("c1")).toBe(2);
  });

  it("marks synced chats so the persistence layer may drop their messages", () => {
    const chat = makeChat("c1", 2);
    const cache = createVaultSyncCache();
    cache.revisions.set("c1", 7);
    cache.owners.set("c1", "user-1");

    const marked = markVaultChats([chat], cache, {
      userId: "user-1",
    } as VaultUserKey);

    expect(marked?.[0].vault).toMatchObject({
      rev: 7,
      ownerId: "user-1",
      messageCount: 2,
    });
    // Idempotent: an already marked chat is not marked again.
    expect(
      markVaultChats(marked!, cache, { userId: "user-1" } as VaultUserKey)
    ).toBeNull();
  });

  it("leaves local-only chats untouched when marking", () => {
    const chat = makeChat("local", 1);
    const cache = createVaultSyncCache();

    expect(
      markVaultChats([chat], cache, { userId: "user-1" } as VaultUserKey)
    ).toBeNull();
  });
});
