import * as jose from "jose";
import { McpAuthConfig } from "../context/types";

const BLOCKED_FIELDS = new Set(["__proto__", "constructor", "prototype"]);

function buildFilteredData(
  selectedFields: string[],
  user: Record<string, unknown>
): Record<string, unknown> | null {
  const entries = selectedFields
    .filter((f) => !BLOCKED_FIELDS.has(f) && Object.hasOwn(user, f))
    .map((f) => [f, Object.getOwnPropertyDescriptor(user, f)?.value]);

  if (!entries.length) return null;
  return Object.fromEntries(entries);
}

async function fetchMcpPublicKey(serverUrl: string): Promise<CryptoKey> {
  const jwksUrl = new URL("/.well-known/jwks.json", serverUrl).toString();
  const jwksResponse = await fetch(jwksUrl);

  if (!jwksResponse.ok) {
    throw new Error(
      `JWKS fetch failed: ${jwksResponse.status} ${jwksResponse.statusText}`
    );
  }

  const jwks = await jwksResponse.json();

  if (!jwks?.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error("JWKS response contains no valid keys");
  }

  return jose.importJWK(jwks.keys[0], "RSA-OAEP-256") as Promise<CryptoKey>;
}

async function encryptPayload(
  data: Record<string, unknown>,
  publicKey: CryptoKey
): Promise<string> {
  const payload = JSON.stringify({ data });
  return new jose.CompactEncrypt(new TextEncoder().encode(payload))
    .setProtectedHeader({
      alg: "RSA-OAEP-256",
      enc: "A256GCM",
      typ: "JWT",
    })
    .encrypt(publicKey);
}

export function useMcpAuth(user: Record<string, unknown> | null) {
  const getAuthorization = async (
    config: McpAuthConfig,
    serverUrl: string
  ): Promise<string | undefined> => {
    if (config.mode === "none") return undefined;

    if (config.mode === "static") {
      return config.staticToken?.trim() || undefined;
    }

    if (config.mode !== "user-data") return undefined;
    if (!config.selectedFields.length || !serverUrl || !user) return undefined;

    const filteredData = buildFilteredData(config.selectedFields, user);
    if (!filteredData) return undefined;

    try {
      const publicKey = await fetchMcpPublicKey(serverUrl);
      return await encryptPayload(filteredData, publicKey);
    } catch (error) {
      console.error("Error encrypting user data:", error);
      throw new Error(
        `Verschlüsselung fehlgeschlagen: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  const userFields = user ? Object.keys(user) : [];

  return { getAuthorization, userFields };
}
