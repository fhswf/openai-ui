import * as jose from "jose";
import { McpScopeDefinition, McpUserDataDiscovery } from "../context/types";

const BLOCKED_FIELDS = new Set(["__proto__", "constructor", "prototype"]);
const OPENID_CONFIGURATION_PATH = "/.well-known/openid-configuration";

export const DEFAULT_MCP_USER_DATA: McpUserDataDiscovery = {
  scopes: [],
  consentGranted: false,
  consentPrompted: false,
};

interface OpenIdConfigurationResponse {
  issuer?: unknown;
  jwks_uri?: unknown;
  scopes_supported?: unknown;
}

interface PublicKeyResult {
  error?: EndpointInvalidError | EndpointUnavailableError;
  publicKey?: CryptoKey;
}

export interface McpDiscoveryMetadata {
  issuer?: string;
  jwksUri: string;
  scopes: McpScopeDefinition[];
}

class EndpointUnavailableError extends Error {}
class EndpointInvalidError extends Error {}

function getSortedScopeNames(scopes: McpScopeDefinition[]): string[] {
  return [...scopes]
    .map(({ scope }) => scope)
    .sort((left, right) => left.localeCompare(right));
}

export function areScopesEqual(
  a: McpScopeDefinition[],
  b: McpScopeDefinition[]
): boolean {
  return getSortedScopeNames(a).join("\u0000") === getSortedScopeNames(b).join("\u0000");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeScopeDefinitions(
  scopes: unknown
): McpScopeDefinition[] {
  if (!Array.isArray(scopes)) return [];

  return scopes
    .map<McpScopeDefinition | null>((scope) => {
      if (typeof scope === "string") {
        const normalizedScope = scope.trim();
        return normalizedScope ? { scope: normalizedScope } : null;
      }

      if (!isRecord(scope) || typeof scope.scope !== "string") return null;

      const normalizedScope = scope.scope.trim();
      if (!normalizedScope) return null;

      return { scope: normalizedScope };
    })
    .filter((scope): scope is McpScopeDefinition => Boolean(scope))
    .sort((left, right) => left.scope.localeCompare(right.scope));
}

function getOwnValue(record: Record<string, unknown>, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

export function hasDefinedOwnValue(
  record: Record<string, unknown>,
  key: string
): boolean {
  return (
    !BLOCKED_FIELDS.has(key) &&
    Object.hasOwn(record, key) &&
    getOwnValue(record, key) != null
  );
}

export function buildFilteredData(
  selectedScopes: string[],
  user: Record<string, unknown>
): Record<string, unknown> | null {
  const entries = selectedScopes
    .filter((field) => hasDefinedOwnValue(user, field))
    .map((field) => [field, getOwnValue(user, field)]);

  if (!entries.length) return null;
  return Object.fromEntries(entries);
}

function getPublicKeyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown error";
}

export function resolvePublicKey(result: PublicKeyResult): CryptoKey {
  if (result.publicKey) {
    return result.publicKey;
  }

  throw (
    result.error ??
    new EndpointInvalidError("JWKS response contains no importable keys")
  );
}

export async function fetchMcpDiscoveryMetadata(
  serverUrl: string
): Promise<McpDiscoveryMetadata> {
  const discoveryResponse = await fetch(
    new URL(OPENID_CONFIGURATION_PATH, serverUrl).toString()
  );

  if (!discoveryResponse.ok) {
    throw new EndpointUnavailableError(
      `OpenID discovery failed: ${discoveryResponse.status} ${discoveryResponse.statusText}`
    );
  }

  const discoveryDocument = (await discoveryResponse.json().catch(() => {
    throw new EndpointInvalidError(
      "OpenID discovery response is not valid JSON"
    );
  })) as OpenIdConfigurationResponse;

  if (!Array.isArray(discoveryDocument.scopes_supported)) {
    throw new EndpointInvalidError(
      "OpenID discovery response is missing scopes_supported"
    );
  }

  const scopes = normalizeScopeDefinitions(discoveryDocument.scopes_supported);

  if (!scopes.length) {
    throw new EndpointInvalidError(
      "OpenID discovery response contains no usable scopes"
    );
  }

  if (typeof discoveryDocument.jwks_uri !== "string") {
    throw new EndpointInvalidError(
      "OpenID discovery response is missing jwks_uri"
    );
  }

  let jwksUri: string;
  try {
    jwksUri = new URL(discoveryDocument.jwks_uri, serverUrl).toString();
  } catch {
    throw new EndpointInvalidError(
      "OpenID discovery response contains an invalid jwks_uri"
    );
  }

  const issuer =
    typeof discoveryDocument.issuer === "string" &&
    discoveryDocument.issuer.trim()
      ? discoveryDocument.issuer.trim()
      : undefined;

  return { issuer, jwksUri, scopes };
}

export async function fetchMcpPublicKey(
  jwksUri: string
): Promise<PublicKeyResult> {
  try {
    const jwksResponse = await fetch(jwksUri);

    if (!jwksResponse.ok) {
      return {
        error: new EndpointUnavailableError(
          `JWKS fetch failed: ${jwksResponse.status} ${jwksResponse.statusText}`
        ),
      };
    }

    const jwks = await jwksResponse.json().catch(() => null);

    if (!jwks) {
      return {
        error: new EndpointInvalidError("JWKS response is not valid JSON"),
      };
    }

    if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      return {
        error: new EndpointInvalidError("JWKS response contains no valid keys"),
      };
    }

    for (const key of jwks.keys) {
      try {
        return {
          publicKey: (await jose.importJWK(key, "RSA-OAEP")) as CryptoKey,
        };
      } catch (error) {
        console.warn("Ignoring invalid JWKS key: %o", error);
      }
    }

    return {
      error: new EndpointInvalidError(
        "JWKS response contains no importable keys"
      ),
    };
  } catch (error) {
    return {
      error: new EndpointUnavailableError(
        `JWKS fetch failed: ${getPublicKeyErrorMessage(error)}`
      ),
    };
  }
}
