/**
 * Thin wrappers around the WebAuthn credential API that only expose the
 * pieces needed for zero-knowledge key management: creating a resident
 * passkey bound to a fixed PRF salt and later re-deriving the same PRF output.
 */

import {
  bufferToBase64Url,
  base64UrlToBuffer,
  getPrfSalt,
} from "./zeroKnowledgeCrypto";

type PrfExtensionResults = {
  prf?: {
    enabled?: boolean;
    results?: { first?: ArrayBuffer };
  };
};

export function isPrfSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator?.credentials?.create === "function" &&
    typeof navigator?.credentials?.get === "function"
  );
}

export type RegisteredPasskey = {
  credentialId: string;
  prfOutput: ArrayBuffer;
  credentialPublicKey: string;
};

export type AssertedPasskey = {
  credentialId: string;
  prfOutput: ArrayBuffer;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
};

export class UnsupportedWebAuthnPrfError extends Error {
  readonly extensionEnabled?: boolean;
  readonly resultLength?: number;

  constructor(details: { extensionEnabled?: boolean; resultLength?: number } = {}) {
    super("The passkey did not return a valid WebAuthn PRF result");
    this.name = "UnsupportedWebAuthnPrfError";
    this.extensionEnabled = details.extensionEnabled;
    this.resultLength = details.resultLength;
  }
}

export class UnexpectedPasskeyError extends Error {
  constructor() {
    super("The selected passkey is not registered for encrypted chat storage");
    this.name = "UnexpectedPasskeyError";
  }
}

function extractPrfOutput(credential: Credential | null): ArrayBuffer {
  if (!credential) {
    throw new Error("Passkey creation was cancelled");
  }
  const results = (
    credential as PublicKeyCredential
  ).getClientExtensionResults() as PrfExtensionResults;
  const prfOutput = results.prf?.results?.first;
  if (!prfOutput || prfOutput.byteLength !== 32) {
    throw new UnsupportedWebAuthnPrfError({
      extensionEnabled: results.prf?.enabled,
      resultLength: prfOutput?.byteLength,
    });
  }
  return prfOutput;
}

/**
 * Create a new resident passkey and evaluate its PRF. If the authenticator
 * defers evaluation until authentication, assert the new credential to get it.
 */
export async function registerPasskey(params: {
  userId: string;
  username: string;
  displayName?: string;
  challenge: ArrayBuffer;
  rpId?: string;
  rpName?: string;
}): Promise<RegisteredPasskey> {
  const rpId = params.rpId ?? window.location.hostname;
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: params.challenge,
      rp: {
        id: rpId,
        name: params.rpName ?? "OpenAI UI",
      },
      user: {
        id: new TextEncoder().encode(params.userId),
        name: params.username,
        displayName: params.displayName ?? params.username,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      extensions: {
        prf: { eval: { first: getPrfSalt() } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Passkey creation was cancelled");
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  const credentialPublicKey = response.getPublicKey();
  if (!credentialPublicKey) {
    throw new Error(
      "This browser cannot export the passkey public key required by the chat vault"
    );
  }

  const credentialId = bufferToBase64Url(credential.rawId);
  let prfOutput: ArrayBuffer;
  try {
    prfOutput = extractPrfOutput(credential);
  } catch (error) {
    if (!(error instanceof UnsupportedWebAuthnPrfError)) {
      throw error;
    }

    // An explicit false means the authenticator cannot evaluate PRF for this
    // credential, so a follow-up assertion cannot help.
    if (error.extensionEnabled === false) {
      throw error;
    }

    // WebAuthn permits authenticators to defer PRF evaluation until an
    // assertion, even when PRF was requested during credential creation.
    if (typeof navigator.credentials.get !== "function") {
      throw error;
    }
    const assertionChallenge = new ArrayBuffer(32);
    crypto.getRandomValues(new Uint8Array(assertionChallenge));
    prfOutput = await assertPasskey({
      credentialId,
      challenge: assertionChallenge,
      rpId,
    });
  }

  return {
    credentialId,
    prfOutput,
    credentialPublicKey: bufferToBase64Url(credentialPublicKey),
  };
}

/**
 * Assert an existing passkey and re-derive the PRF output. The same fixed salt
 * yields byte-identical output for the same credential.
 */
export async function assertPasskeyWithResponse(params: {
  credentialId?: string;
  challenge: ArrayBuffer;
  rpId?: string;
}): Promise<AssertedPasskey> {
  const rpId = params.rpId ?? window.location.hostname;
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: params.challenge,
      rpId,
      // The UI has the user choose a named credential first. Constraining the
      // assertion here keeps the browser prompt aligned with that choice.
      ...(params.credentialId
        ? {
            allowCredentials: [
              {
                id: base64UrlToBuffer(params.credentialId),
                type: "public-key" as const,
              },
            ],
          }
        : {}),
      userVerification: "required",
      extensions: {
        prf: { eval: { first: getPrfSalt() } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Passkey authentication was cancelled");
  }

  const credentialId = bufferToBase64Url(assertion.rawId);
  if (params.credentialId && credentialId !== params.credentialId) {
    throw new UnexpectedPasskeyError();
  }

  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
    credentialId,
    prfOutput: extractPrfOutput(assertion),
    authenticatorData: bufferToBase64Url(response.authenticatorData),
    clientDataJSON: bufferToBase64Url(response.clientDataJSON),
    signature: bufferToBase64Url(response.signature),
  };
}

export async function assertPasskey(params: {
  credentialId: string;
  challenge: ArrayBuffer;
  rpId?: string;
}): Promise<ArrayBuffer> {
  const rpId = params.rpId ?? window.location.hostname;
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: params.challenge,
      rpId,
      allowCredentials: [
        {
          id: base64UrlToBuffer(params.credentialId),
          type: "public-key",
        },
      ],
      userVerification: "required",
      extensions: {
        prf: { eval: { first: getPrfSalt() } },
      },
    },
  })) as PublicKeyCredential | null;

  if (!assertion) {
    throw new Error("Passkey authentication was cancelled");
  }

  if (bufferToBase64Url(assertion.rawId) !== params.credentialId) {
    throw new UnexpectedPasskeyError();
  }

  return extractPrfOutput(assertion);
}
