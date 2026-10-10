import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPasskey, isPrfSupported, registerPasskey } from "../webauthn";
import {
  base64UrlToBuffer,
  bufferToBase64Url,
  getPrfSalt,
} from "../zeroKnowledgeCrypto";

function makeCredential(prfOutput?: ArrayBuffer) {
  const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
  return {
    rawId,
    getClientExtensionResults: () =>
      prfOutput ? { prf: { results: { first: prfOutput } } } : {},
  };
}

describe("webauthn passkey helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects PRF support based on the credential APIs", () => {
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn(), get: vi.fn() },
    });
    vi.stubGlobal("PublicKeyCredential", function () {});
    expect(isPrfSupported()).toBe(true);

    vi.stubGlobal("navigator", { credentials: {} });
    expect(isPrfSupported()).toBe(false);
  });

  it("registers a passkey and returns the credential id and PRF output", async () => {
    const prfOutput = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const credential = makeCredential(prfOutput);
    const create = vi.fn().mockResolvedValue(credential);
    vi.stubGlobal("navigator", { credentials: { create } });
    vi.stubGlobal("PublicKeyCredential", function () {});

    const result = await registerPasskey({
      userId: "user-1",
      username: "user@example.com",
      challenge: crypto.getRandomValues(new Uint8Array(32)).buffer,
    });

    expect(result.credentialId).toBe(bufferToBase64Url(credential.rawId));
    expect(new Uint8Array(result.prfOutput)).toEqual(new Uint8Array(prfOutput));

    const options = create.mock.calls[0][0].publicKey;
    expect(options.rp.id).toBe(window.location.hostname);
    expect(options.extensions.prf.eval.first).toEqual(getPrfSalt());
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: "required",
      userVerification: "required",
    });
  });

  it("throws a helpful error when PRF is unsupported", async () => {
    const create = vi.fn().mockResolvedValue(makeCredential());
    vi.stubGlobal("navigator", { credentials: { create } });
    vi.stubGlobal("PublicKeyCredential", function () {});

    await expect(
      registerPasskey({
        userId: "user-1",
        username: "user@example.com",
        challenge: new ArrayBuffer(32),
      })
    ).rejects.toThrow(/PRF/);
  });

  it("asserts an existing passkey with the same fixed salt", async () => {
    const prfOutput = crypto.getRandomValues(new Uint8Array(32)).buffer;
    const get = vi.fn().mockResolvedValue(makeCredential(prfOutput));
    vi.stubGlobal("navigator", { credentials: { get } });
    vi.stubGlobal("PublicKeyCredential", function () {});

    const credentialId = bufferToBase64Url(
      crypto.getRandomValues(new Uint8Array(16))
    );
    const result = await assertPasskey({
      credentialId,
      challenge: new ArrayBuffer(32),
    });

    expect(new Uint8Array(result)).toEqual(new Uint8Array(prfOutput));
    const options = get.mock.calls[0][0].publicKey;
    expect(options.allowCredentials[0].id).toEqual(
      base64UrlToBuffer(credentialId)
    );
    expect(options.extensions.prf.eval.first).toEqual(getPrfSalt());
  });
});
