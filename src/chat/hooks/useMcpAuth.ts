import * as jose from "jose";
import { McpAuthConfig } from "../context/types";
import { buildWellKnownUrls, MCP_JWKS_PATH } from "../utils/mcp";

const BLOCKED_FIELDS = new Set(["__proto__", "constructor", "prototype"]);
const MCP_JWE_ALG = "RSA-OAEP-256";
const MCP_JWE_ENC = "A256GCM";
const MCP_TOKEN_TTL_SECONDS = 5 * 60;

interface McpImportedPublicKey {
  key: CryptoKey;
  kid?: string;
}

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

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isEncryptionJwk(jwk: unknown): jwk is jose.JWK {
  if (!isObject(jwk) || jwk.kty !== "RSA") return false;

  const use = typeof jwk.use === "string" ? jwk.use : undefined;
  if (use && use !== "enc") return false;

  const alg = typeof jwk.alg === "string" ? jwk.alg : undefined;
  if (alg && alg !== MCP_JWE_ALG) return false;

  return typeof jwk.n === "string" && typeof jwk.e === "string";
}

function selectEncryptionJwk(keys: unknown[]): jose.JWK | null {
  const candidates = keys.filter(isEncryptionJwk);
  if (candidates.length === 0) return null;

  return (
    candidates.find((jwk) => jwk.use === "enc" && jwk.alg === MCP_JWE_ALG) ||
    candidates.find((jwk) => jwk.use === "enc") ||
    candidates[0]
  );
}

async function fetchMcpPublicKey(
  serverUrl: string
): Promise<McpImportedPublicKey> {
  const jwksUrls = buildWellKnownUrls(serverUrl, MCP_JWKS_PATH);

  for (const jwksUrl of jwksUrls) {
    const jwksResponse = await fetch(jwksUrl).catch(() => null);
    if (!jwksResponse?.ok) continue;

    const jwks = await jwksResponse.json().catch(() => null);
    if (!jwks?.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      continue;
    }

    const jwk = selectEncryptionJwk(jwks.keys);
    if (!jwk) continue;

    const key = await jose.importJWK(jwk, MCP_JWE_ALG);
    return {
      key: key as CryptoKey,
      kid: typeof jwk.kid === "string" ? jwk.kid : undefined,
    };
  }

  throw new Error("JWKS response contains no valid keys");
}

function getAuthorizationFields(config: McpAuthConfig): string[] {
  if (Array.isArray(config.selectedFields) && config.selectedFields.length > 0) {
    return config.selectedFields;
  }

  if (Array.isArray(config.grantedScopes) && config.grantedScopes.length > 0) {
    return config.grantedScopes;
  }

  return [];
}

function encryptPayload(
  data: Record<string, unknown>,
  publicKey: CryptoKey,
  kid?: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    ...data,
    iat: now,
    exp: now + MCP_TOKEN_TTL_SECONDS,
  });
  const protectedHeader: jose.CompactJWEHeaderParameters = {
    alg: MCP_JWE_ALG,
    enc: MCP_JWE_ENC,
    typ: "JWT",
  };

  if (kid) {
    protectedHeader.kid = kid;
  }

  return new jose.CompactEncrypt(new TextEncoder().encode(payload))
    .setProtectedHeader(protectedHeader)
    .encrypt(publicKey);
}

function getStaticAuthorization(
  staticToken: string | undefined
): string | undefined {
  const token = staticToken?.trim();
  return token ? token : undefined;
}

async function getUserDataAuthorization(
  config: McpAuthConfig,
  serverUrl: string,
  user: Record<string, unknown> | null
): Promise<string | undefined> {
  const selectedFields = getAuthorizationFields(config);
  if (!selectedFields.length || !serverUrl || !user) return undefined;

  const filteredData = buildFilteredData(selectedFields, user);
  if (!filteredData) return undefined;

  try {
    const publicKey = await fetchMcpPublicKey(serverUrl);
    return await encryptPayload(filteredData, publicKey.key, publicKey.kid);
  } catch (error) {
    console.error("Error encrypting user data:", error);
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(`Verschluesselung fehlgeschlagen: ${message}`);
  }
}

export async function getAuthorizationForMcpConfig(
  config: McpAuthConfig,
  serverUrl: string,
  user: Record<string, unknown> | null
): Promise<string | undefined> {
  switch (config.mode) {
    case "none":
      return undefined;
    case "static":
      return getStaticAuthorization(config.staticToken);
    case "user-data":
      return getUserDataAuthorization(config, serverUrl, user);
    default:
      return undefined;
  }
}

export function useMcpAuth(user: Record<string, unknown> | null) {
  const getAuthorization = async (
    config: McpAuthConfig,
    serverUrl: string
  ): Promise<string | undefined> => {
    return getAuthorizationForMcpConfig(config, serverUrl, user);
  };

  const userFields = user ? Object.keys(user) : [];

  return { getAuthorization, userFields };
}
