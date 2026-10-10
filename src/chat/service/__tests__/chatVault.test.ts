import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VaultError, chatVault } from "../chatVault";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("chatVault API client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a registration challenge", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ challenge: "abc" }));
    const result = await chatVault.registrationChallenge();
    expect(result).toEqual({ challenge: "abc" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/zk/keys/registration-challenge");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
  });

  it("registers a key with the encrypted private key", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ userId: "u1", createdAt: "2026-01-01" }, { status: 201 })
    );

    await chatVault.registerKey({
      credentialId: "cid",
      publicKey: "pk",
      encryptedSk: "esk",
      encryptedSkIv: "iv",
      challenge: "ch",
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toMatchObject({
      credentialId: "cid",
      encryptedSk: "esk",
    });
  });

  it("fetches the caller's own key material", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        userId: "u1",
        credentialId: "cid",
        publicKey: "pk",
        encryptedSk: "esk",
        encryptedSkIv: "iv",
      })
    );

    const key = await chatVault.getMyKey();
    expect(key.encryptedSk).toBe("esk");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/zk/keys/me");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("fetches a recipient public key with URL encoding", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ userId: "a/b", publicKey: "pk" })
    );
    await chatVault.getPublicKey("a/b");
    expect(String(fetchMock.mock.calls[0][0])).toContain("a%2Fb");
  });

  it("resolves a recipient public key by email for sharing", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ userId: "u2", publicKey: "pk2" })
    );
    const key = await chatVault.lookupKeyByEmail("bob@example.com");
    expect(key.publicKey).toBe("pk2");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/keys/lookup?email=bob%40example.com");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("deletes the caller's key material on opt-out", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(chatVault.deleteMyKey()).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/zk/keys/me");
    expect(init.method).toBe("DELETE");
  });

  it("lists chats and gets a single chat", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ id: "c1" }]))
      .mockResolvedValueOnce(
        jsonResponse({ id: "c1", ciphertext: "ct", iv: "iv", envelopes: [] })
      );

    const chats = await chatVault.listChats();
    expect(chats).toHaveLength(1);

    const chat = await chatVault.getChat("c1");
    expect(chat.ciphertext).toBe("ct");
  });

  it("puts a chat with a self envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "c1", rev: 1 }, { status: 201 })
    );
    await chatVault.putChat("c1", {
      ciphertext: "ct",
      iv: "iv",
      selfEnvelope: { recipientId: "u1", wrappedKey: "wk" },
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body).selfEnvelope.wrappedKey).toBe("wk");
  });

  it("shares a chat with a recipient envelope", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await chatVault.shareChat("c1", { recipientId: "u2", wrappedKey: "wk" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/chats/c1/share");
    expect(JSON.parse(init.body)).toEqual({
      recipientId: "u2",
      wrappedKey: "wk",
    });
  });

  it("throws a typed VaultError on 403", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: { code: "forbidden", message: "no envelope" } },
        { status: 403 }
      )
    );

    await expect(
      chatVault.shareChat("c1", { recipientId: "u2", wrappedKey: "wk" })
    ).rejects.toMatchObject({
      name: "VaultError",
      status: 403,
      code: "forbidden",
      message: "no envelope",
    });
    await expect(
      chatVault.shareChat("c1", { recipientId: "u2", wrappedKey: "wk" })
    ).rejects.toBeInstanceOf(VaultError);
  });

  it("resolves to undefined for empty 204 responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(
      chatVault.submitAssertion({
        credentialId: "cid",
        authenticatorData: "ad",
        clientDataJSON: "cd",
        signature: "sig",
      })
    ).resolves.toBeUndefined();
  });
});
