import React from "react";
import * as jose from "jose";
import i18n from "../../i18n/config";
import { McpAuthConfig, McpScopeDefinition } from "../context/types";
import {
  areScopesEqual,
  buildFilteredData,
  DEFAULT_MCP_USER_DATA,
  fetchMcpDiscoveryMetadata,
  fetchMcpPublicKey,
  hasDefinedOwnValue,
  isRecord,
  normalizeScopeDefinitions,
  resolvePublicKey,
} from "./mcpAuthHelpers";

const MCP_AUTH_TOKEN_LIFETIME_SECONDS = 6 * 60 * 60;

export const DEFAULT_MCP_AUTH_CONFIG: McpAuthConfig = {
  mode: "none",
};

const FALLBACK_MCP_USER_SCOPE_KEYS = [
  "name",
  "email",
  "preferred_username",
  "sub",
  "affiliations",
] as const;

interface UseMcpAuthDiscoveryArgs {
  config: McpAuthConfig;
  onChange: React.Dispatch<McpAuthConfig>;
  serverUrl: string;
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
