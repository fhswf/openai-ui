import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiHubError, generateUniqueAiHubKey } from "../aiHub";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function requestBody(call: unknown[]) {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body));
}

function requestedAlias(call: unknown[]) {
  return requestBody(call).key_alias;
}

describe("generateUniqueAiHubKey", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the base alias when it is still free", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ key: "sk-1" }));

    const result = await generateUniqueAiHubKey("KImpuls-a@fh-swf.de");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedAlias(fetchMock.mock.calls[0])).toBe("KImpuls-a@fh-swf.de");
    expect(result).toEqual({ key: "sk-1", key_alias: "KImpuls-a@fh-swf.de" });
  });

  it("sends accepted_terms when the user accepted the terms", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ key: "sk-1" }));

    await generateUniqueAiHubKey("KImpuls-a@fh-swf.de", {
      acceptedTerms: true,
    });

    expect(requestBody(fetchMock.mock.calls[0])).toEqual({
      key_alias: "KImpuls-a@fh-swf.de",
      accepted_terms: true,
    });
  });

  it("does not accept the terms implicitly", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ key: "sk-1" }));

    await generateUniqueAiHubKey("KImpuls-a@fh-swf.de");

    expect(requestBody(fetchMock.mock.calls[0]).accepted_terms).toBe(false);
  });

  it("appends a suffix when the alias is already taken", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ error: "alias exists" }, { status: 409 })
      )
      .mockResolvedValueOnce(jsonResponse({ key: "sk-2" }));

    const result = await generateUniqueAiHubKey("KImpuls-a@fh-swf.de", {
      createSuffix: () => "abc123",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedAlias(fetchMock.mock.calls[1])).toBe(
      "KImpuls-a@fh-swf.de-abc123"
    );
    expect(result.key).toBe("sk-2");
    expect(result.key_alias).toBe("KImpuls-a@fh-swf.de-abc123");
  });

  it("keeps accepted_terms on retries with a suffix", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ error: "alias exists" }, { status: 409 })
      )
      .mockResolvedValueOnce(jsonResponse({ key: "sk-2" }));

    await generateUniqueAiHubKey("KImpuls-a@fh-swf.de", {
      acceptedTerms: true,
      createSuffix: () => "abc123",
    });

    expect(requestBody(fetchMock.mock.calls[1])).toEqual({
      key_alias: "KImpuls-a@fh-swf.de-abc123",
      accepted_terms: true,
    });
  });

  it("prefers the alias returned by the hub", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ key: "sk-1", key_alias: "KImpuls-from-hub" })
    );

    const result = await generateUniqueAiHubKey("KImpuls-a@fh-swf.de");

    expect(result.key_alias).toBe("KImpuls-from-hub");
  });

  it("does not retry when the hub session is invalid", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: "Invalid session" }, { status: 401 })
    );

    await expect(
      generateUniqueAiHubKey("KImpuls-a@fh-swf.de", { acceptedTerms: true })
    ).rejects.toMatchObject({ code: "key_generation_failed", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts conflicts", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: "alias exists" }, { status: 400 })
    );

    await expect(
      generateUniqueAiHubKey("KImpuls-a@fh-swf.de", { maxAttempts: 3 })
    ).rejects.toMatchObject({ code: "key_generation_failed", status: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry on other errors", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { status: 500 }));

    const promise = generateUniqueAiHubKey("KImpuls-a@fh-swf.de");

    await expect(promise).rejects.toBeInstanceOf(AiHubError);
    await expect(promise).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
