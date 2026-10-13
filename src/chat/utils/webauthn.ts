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
  prfOutput: ArrayBuffer;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
};

function extractPrfOutput(credential: Credential | null): ArrayBuffer {
  if (!credential) {
    throw new Error("Passkey creation was cancelled");
  }
  const results = (
    credential as PublicKeyCredential
  ).getClientExtensionResults() as PrfExtensionResults;
  const prfOutput = results.prf?.results?.first;
  if (!prfOutput) {
    throw new Error(
      "This browser or authenticator does not support WebAuthn PRF encryption"
    );
  }
  return prfOutput;
}

/**
 * Create a new resident passkey and immediately evaluate the PRF extension so
 * the caller can derive K_pass without a second prompt.
 */
export async function registerPasskey(params: {
  userId: string;
  username: string;
  displayName?: string;
  challenge: ArrayBuffer;
  rpId?: string;
  rpName?: string;
}): Promise<RegisteredPasskey> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: params.challenge,
      rp: {
        id: params.rpId ?? window.location.hostname,
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

  return {
    credentialId: bufferToBase64Url(credential.rawId),
    prfOutput: extractPrfOutput(credential),
    credentialPublicKey: bufferToBase64Url(credentialPublicKey),
  };
}

/**
 * Assert an existing passkey and re-derive the PRF output. The same fixed salt
 * yields byte-identical output for the same credential.
 */
export async function assertPasskeyWithResponse(params: {
  credentialId: string;
  challenge: ArrayBuffer;
  rpId?: string;
}): Promise<AssertedPasskey> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: params.challenge,
      rpId: params.rpId ?? window.location.hostname,
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

  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
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
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: params.challenge,
      rpId: params.rpId ?? window.location.hostname,
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

  return extractPrfOutput(assertion);
}
