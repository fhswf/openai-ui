import React from "react";
import * as jose from "jose";
import i18n from "../../i18n/config";
import { McpAuthConfig, McpScopeDefinition } from "../context/types";

const BLOCKED_FIELDS = new Set(["__proto__", "constructor", "prototype"]);
const OPENID_CONFIGURATION_PATH = "/.well-known/openid-configuration";
const MCP_AUTH_TOKEN_LIFETIME_SECONDS = 6 * 60 * 60;

export const DEFAULT_MCP_AUTH_CONFIG: McpAuthConfig = {
  mode: "none",
};

const DEFAULT_MCP_USER_DATA = {
  scopes: [] as McpScopeDefinition[],
  consentGranted: false,
  consentPrompted: false,
};
const FALLBACK_MCP_USER_SCOPE_KEYS = [
  "name",
  "email",
  "preferred_username",
  "sub",
  "affiliations",
] as const;

interface OpenIdConfigurationResponse {
  issuer?: unknown;
  jwks_uri?: unknown;
  scopes_supported?: unknown;
}

interface McpDiscoveryMetadata {
  issuer?: string;
  jwksUri: string;
  scopes: McpScopeDefinition[];
}

interface PublicKeyResult {
  error?: EndpointInvalidError | EndpointUnavailableError;
  publicKey?: CryptoKey;
}

interface UseMcpAuthDiscoveryArgs {
  config: McpAuthConfig;
  onChange: React.Dispatch<McpAuthConfig>;
  serverUrl: string;
}

class EndpointUnavailableError extends Error {}
class EndpointInvalidError extends Error {}

function areScopesEqual(
  a: McpScopeDefinition[],
  b: McpScopeDefinition[]
): boolean {
  return (
    JSON.stringify(getSortedScopeNames(a)) ===
    JSON.stringify(getSortedScopeNames(b))
  );
}

function normalizeScopeDefinitions(scopes: unknown): McpScopeDefinition[] {
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

function getSortedScopeNames(scopes: McpScopeDefinition[]): string[] {
  return [...scopes]
    .map(({ scope }) => scope)
    .sort((left, right) => left.localeCompare(right));
}

function getOwnValue(record: Record<string, unknown>, key: string): unknown {
  return Object.getOwnPropertyDescriptor(record, key)?.value;
}

function hasDefinedOwnValue(record: Record<string, unknown>, key: string): boolean {
  return (
    !BLOCKED_FIELDS.has(key) &&
    Object.hasOwn(record, key) &&
    getOwnValue(record, key) != null
  );
}

function getPublicKeyErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown error";
}

function resolvePublicKey(result: PublicKeyResult): CryptoKey {
  if (result.publicKey) {
    return result.publicKey;
  }

  throw (
    result.error ??
    new EndpointInvalidError("JWKS response contains no importable keys")
  );
}

export function getFallbackMcpUserScopes(
  user: Record<string, unknown> | null | undefined
): McpScopeDefinition[] {
  if (!user) return [];

  return FALLBACK_MCP_USER_SCOPE_KEYS.filter((scope) =>
    hasDefinedOwnValue(user, scope)
  ).map((scope) => ({ scope }));
}

export function normalizeMcpAuthConfig(config: unknown): McpAuthConfig {
  if (!isRecord(config)) {
    return DEFAULT_MCP_AUTH_CONFIG;
  }

  if (config.mode === "static") {
    return {
      mode: "static",
      staticToken:
        typeof config.staticToken === "string" ? config.staticToken : "",
    };
  }

  if (config.mode === "user-data") {
    const userData = isRecord(config.userData) ? config.userData : null;
    const legacySelectedFields = normalizeScopeDefinitions(
      config.selectedFields
    );
    const scopes = normalizeScopeDefinitions(userData?.scopes);

    return {
      mode: "user-data",
      userData: {
        ...DEFAULT_MCP_USER_DATA,
        scopes: scopes.length > 0 ? scopes : legacySelectedFields,
        consentGranted:
          userData?.consentGranted === true || legacySelectedFields.length > 0,
        consentPrompted: userData?.consentPrompted === true,
      },
    };
  }

  return {
    mode: "none",
  };
}

export function areMcpAuthConfigsEqual(
  a: McpAuthConfig,
  b: McpAuthConfig
): boolean {
  const normalizedA = normalizeMcpAuthConfig(a);
  const normalizedB = normalizeMcpAuthConfig(b);

  if (
    normalizedA.mode !== normalizedB.mode
  ) {
    return false;
  }

  switch (normalizedA.mode) {
    case "none":
      return true;
    case "static": {
      return (
        normalizedB.mode === "static" &&
        normalizedA.staticToken === normalizedB.staticToken
      );
    }
    case "user-data": {
      if (normalizedB.mode !== "user-data") {
        return false;
      }

      return (
        normalizedA.userData.consentGranted ===
          normalizedB.userData.consentGranted &&
        areScopesEqual(normalizedA.userData.scopes, normalizedB.userData.scopes)
      );
    }
    default:
      return false;
  }
}

export function isMcpAuthorizationIncomplete(
  config: McpAuthConfig | undefined
): boolean {
  if (!config) return false;

  const normalizedConfig = normalizeMcpAuthConfig(config);
  return (
    normalizedConfig.mode === "user-data" &&
    normalizedConfig.userData.scopes.length > 0 &&
    !normalizedConfig.userData.consentGranted
  );
}

export function hasBeenConsentPrompted(
  config: McpAuthConfig | undefined
): boolean {
  if (!config) return false;

  const normalizedConfig = normalizeMcpAuthConfig(config);
  return (
    normalizedConfig.mode === "user-data" &&
    normalizedConfig.userData.consentPrompted === true
  );
}

function buildFilteredData(
  selectedScopes: string[],
  user: Record<string, unknown>
): Record<string, unknown> | null {
  const entries = selectedScopes
    .filter((field) => hasDefinedOwnValue(user, field))
    .map((field) => [field, getOwnValue(user, field)]);

  if (!entries.length) return null;
  return Object.fromEntries(entries);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function fetchMcpDiscoveryMetadata(
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

async function fetchMcpPublicKey(jwksUri: string): Promise<PublicKeyResult> {
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
      error: new EndpointInvalidError("JWKS response contains no importable keys"),
    };
  } catch (error) {
    return {
      error: new EndpointUnavailableError(
        `JWKS fetch failed: ${getPublicKeyErrorMessage(error)}`
      ),
    };
  }
}

export function buildUserDataConfig(
  currentConfig: McpAuthConfig,
  scopes: McpScopeDefinition[]
): McpAuthConfig {
  const normalizedScopes = [...scopes].sort((a, b) =>
    a.scope.localeCompare(b.scope)
  );
  const currentUserData =
    currentConfig.mode === "user-data" ? currentConfig.userData : undefined;
  const scopesMatch =
    currentUserData && areScopesEqual(currentUserData.scopes, normalizedScopes);

  return {
    mode: "user-data",
    userData: {
      scopes: normalizedScopes,
      consentGranted: scopesMatch ? currentUserData.consentGranted : false,
      consentPrompted: scopesMatch
        ? currentUserData.consentPrompted ?? false
        : false,
    },
  };
}

export async function discoverMcpUserDataScopes(
  serverUrl: string
): Promise<McpScopeDefinition[]> {
  const discovery = await fetchMcpDiscoveryMetadata(serverUrl);
  return discovery.scopes;
}

export async function discoverMcpAuthConfig(
  config: McpAuthConfig | undefined,
  serverUrl: string
): Promise<McpAuthConfig> {
  const currentConfig = normalizeMcpAuthConfig(config);
  if (!serverUrl) {
    return currentConfig;
  }

  try {
    const discovery = await fetchMcpDiscoveryMetadata(serverUrl);

    if (currentConfig.mode === "user-data") {
      resolvePublicKey(await fetchMcpPublicKey(discovery.jwksUri));
    }

    return buildUserDataConfig(currentConfig, discovery.scopes);
  } catch (error) {
    console.warn("Unable to discover MCP auth config for %s: %o", serverUrl, error);
    return currentConfig;
  }
}

export function discoverMcpAuthForServer(
  serverUrl: string,
  config?: McpAuthConfig
): Promise<McpAuthConfig> {
  return discoverMcpAuthConfig(config, serverUrl);
}

export function useMcpAuthDiscovery({
  config,
  onChange,
  serverUrl,
}: UseMcpAuthDiscoveryArgs): {
  effectiveUserDataScopes: McpScopeDefinition[];
  normalizedConfig: McpAuthConfig;
  serverAuthOptionsDisabled: boolean;
  userData: Extract<McpAuthConfig, { mode: "user-data" }>["userData"];
  userDataOptionDisabled: boolean;
} {
  const normalizedConfig = normalizeMcpAuthConfig(config);
  const [discoveredScopes, setDiscoveredScopes] = React.useState<
    McpScopeDefinition[]
  >([]);
  const discoveredServerUrlRef = React.useRef("");
  const trimmedServerUrl = serverUrl.trim();
  const userData =
    normalizedConfig.mode === "user-data"
      ? normalizedConfig.userData
      : DEFAULT_MCP_USER_DATA;
  const normalizedMode = normalizedConfig.mode;
  const staticToken =
    normalizedConfig.mode === "static" ? normalizedConfig.staticToken : "";
  const userDataScopeKey = userData.scopes.map((scope) => scope.scope).join(",");

  React.useEffect(() => {
    let cancelled = false;

    if (discoveredServerUrlRef.current !== trimmedServerUrl) {
      discoveredServerUrlRef.current = trimmedServerUrl;
      setDiscoveredScopes([]);
    }

    if (!trimmedServerUrl) {
      setDiscoveredScopes([]);
      if (normalizedConfig.mode === "user-data") {
        onChange(DEFAULT_MCP_AUTH_CONFIG);
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void discoverMcpUserDataScopes(trimmedServerUrl)
        .then((scopes) => {
          if (cancelled) return;

          discoveredServerUrlRef.current = trimmedServerUrl;
          setDiscoveredScopes(scopes);

          if (normalizedConfig.mode === "user-data") {
            const nextConfig = buildUserDataConfig(normalizedConfig, scopes);
            if (!areMcpAuthConfigsEqual(normalizedConfig, nextConfig)) {
              onChange(nextConfig);
            }
          }
        })
        .catch(() => {
          if (cancelled) return;

          discoveredServerUrlRef.current = trimmedServerUrl;
          setDiscoveredScopes([]);

          if (normalizedConfig.mode === "user-data") {
            onChange(DEFAULT_MCP_AUTH_CONFIG);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    onChange,
    trimmedServerUrl,
    normalizedMode,
    staticToken,
    userData.consentGranted,
    userData.consentPrompted,
    userDataScopeKey,
  ]);

  const effectiveUserDataScopes =
    discoveredScopes.length > 0 ? discoveredScopes : userData.scopes;
  const serverAuthOptionsDisabled =
    normalizedConfig.mode === "user-data" && effectiveUserDataScopes.length > 0;
  const userDataOptionDisabled = effectiveUserDataScopes.length === 0;

  return {
    effectiveUserDataScopes,
    normalizedConfig,
    serverAuthOptionsDisabled,
    userData,
    userDataOptionDisabled,
  };
}

function encryptPayload(
  data: Record<string, unknown>,
  publicKey: CryptoKey,
  consentGranted: boolean
): Promise<string | undefined> {
  if (!consentGranted) {
    return Promise.resolve(undefined);
  }

  const issuedAt = Math.floor(Date.now() / 1000);

  return new jose.EncryptJWT({ data })
    .setProtectedHeader({
      alg: "RSA-OAEP",
      enc: "A256GCM",
    })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + MCP_AUTH_TOKEN_LIFETIME_SECONDS)
    .encrypt(publicKey);
}

function getStaticAuthorization(
  staticToken: string | undefined
): string | undefined {
  const token = staticToken?.trim();
  return token ? token : undefined;
}

async function getUserDataAuthorization(
  config: Extract<McpAuthConfig, { mode: "user-data" }>,
  serverUrl: string,
  user: Record<string, unknown> | null
): Promise<string | undefined> {
  const selectedScopes = config.userData.scopes.map((scope) => scope.scope);
  if (
    !config.userData.consentGranted ||
    !selectedScopes.length ||
    !serverUrl ||
    !user
  ) {
    return undefined;
  }

  const filteredData = buildFilteredData(selectedScopes, user);
  if (!filteredData) return undefined;

  try {
    const discovery = await fetchMcpDiscoveryMetadata(serverUrl);
    const publicKey = resolvePublicKey(
      await fetchMcpPublicKey(discovery.jwksUri)
    );
    return await encryptPayload(
      filteredData,
      publicKey,
      config.userData.consentGranted
    );
  } catch (error) {
    console.error("Error encrypting user data:", error);
    throw new Error(
      `${i18n.t("mcp_encryption_failed")}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function getAuthorizationForMcpConfig(
  config: McpAuthConfig,
  serverUrl: string,
  user: Record<string, unknown> | null
): Promise<string | undefined> {
  const normalizedConfig = normalizeMcpAuthConfig(config);

  try {
    switch (normalizedConfig.mode) {
      case "none":
        return undefined;
      case "static":
        return getStaticAuthorization(normalizedConfig.staticToken);
      case "user-data":
        return await getUserDataAuthorization(normalizedConfig, serverUrl, user);
      default:
        return undefined;
    }
  } catch (error) {
    console.error("Failed to get MCP authorization:", error);
    throw error instanceof Error
      ? error
      : new Error(i18n.t("mcp_authorization_failed"));
  }
}

export function useMcpAuth(user: Record<string, unknown> | null) {
  const getAuthorization = async (
    config: McpAuthConfig,
    serverUrl: string
  ): Promise<string | undefined> => {
    return getAuthorizationForMcpConfig(config, serverUrl, user);
  };

  return { getAuthorization };
}
