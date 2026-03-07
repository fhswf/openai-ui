import { McpAuthConfig, McpScopeDefinition } from "../context/types";

export interface McpDiscoveryResult {
  kind: "consent-required" | "no-consent" | "unreachable";
  scopes: McpScopeDefinition[];
  error?: string;
}

export const MCP_SCOPES_PATH = "/.well-known/fhswf-scopes";
export const MCP_JWKS_PATH = "/.well-known/jwks.json";
const MCP_DISCOVERY_TIMEOUT_MS = 3000;

const DEFAULT_DISCOVERY_ERROR =
  "The server could not be reached. Please check the URL.";
const DEFAULT_METADATA_ERROR =
  "The server is reachable, but the MCP authorization metadata is unavailable.";
const DEFAULT_AUTH_MESSAGE = "Currently unavailable";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function createDefaultMcpAuthConfig(): McpAuthConfig {
  return {
    mode: "none",
    staticToken: "",
    selectedFields: [],
    serverType: "unknown",
    discoveryState: "unknown",
    availabilityState: "unknown",
    scopes: [],
    grantedScopes: [],
  };
}

export function normalizeScopes(scopes: unknown): McpScopeDefinition[] {
  if (!Array.isArray(scopes)) return [];
  return scopes
    .filter(
      (scope): scope is McpScopeDefinition =>
        isObject(scope) && typeof scope.scope === "string"
    )
    .map((scope) => ({
      scope: scope.scope.trim(),
      description:
        typeof scope.description === "string" ? scope.description : undefined,
      description_en:
        typeof scope.description_en === "string"
          ? scope.description_en
          : undefined,
    }))
    .filter((scope) => scope.scope.length > 0);
}

function getScopesPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload;
  if (!isObject(payload)) return undefined;

  if (Array.isArray(payload.required_scopes)) return payload.required_scopes;
  if (Array.isArray(payload.scopes_supported)) return payload.scopes_supported;
  if (Array.isArray(payload.scopes)) return payload.scopes;

  for (const value of Object.values(payload)) {
    if (!value) continue;
    if (
      Array.isArray(value) &&
      value.every((s) => isObject(s) && typeof s.scope === "string")
    ) {
      return value;
    }
    const nested = getScopesPayload(value);
    if (nested) return nested;
  }

  return undefined;
}

export function normalizeMcpAuthConfig(config: unknown): McpAuthConfig {
  if (!isObject(config)) return createDefaultMcpAuthConfig();

  const mode =
    config.mode === "static" || config.mode === "user-data"
      ? config.mode
      : "none";
  const discoveryState =
    config.discoveryState === "consent-required" ||
    config.discoveryState === "no-consent" ||
    config.discoveryState === "unreachable"
      ? config.discoveryState
      : "unknown";
  const serverType =
    config.serverType === "scoped" || config.serverType === "plain"
      ? config.serverType
      : discoveryState === "consent-required"
        ? "scoped"
        : discoveryState === "no-consent"
          ? "plain"
          : "unknown";

  const normalized = createDefaultMcpAuthConfig();
  normalized.mode = mode;
  normalized.staticToken =
    typeof config.staticToken === "string" ? config.staticToken : "";
  normalized.selectedFields = Array.isArray(config.selectedFields)
    ? config.selectedFields.filter(
        (field): field is string =>
          typeof field === "string" && field.trim().length > 0
      )
    : [];
  normalized.serverType = serverType;
  normalized.discoveryState = discoveryState;
  normalized.availabilityState =
    config.availabilityState === "available" ||
    config.availabilityState === "unavailable"
      ? config.availabilityState
      : "unknown";
  normalized.scopes = normalizeScopes(config.scopes);
  normalized.grantedScopes = Array.isArray(config.grantedScopes)
    ? config.grantedScopes.filter(
        (scope): scope is string =>
          typeof scope === "string" && scope.trim().length > 0
      )
    : [];
  normalized.discoveryError =
    typeof config.discoveryError === "string"
      ? config.discoveryError
      : undefined;
  normalized.availabilityMessage =
    typeof config.availabilityMessage === "string"
      ? config.availabilityMessage
      : undefined;
  normalized.lastCheckedAt =
    typeof config.lastCheckedAt === "number" ? config.lastCheckedAt : undefined;

  return normalized;
}

export function isConsentRequired(config: McpAuthConfig): boolean {
  return (
    config.serverType === "scoped" &&
    config.discoveryState === "consent-required"
  );
}

export function supportsUserDataAuth(config: McpAuthConfig): boolean {
  return isConsentRequired(config);
}

export type McpUserDataSupportState =
  | "unknown"
  | "plain-server"
  | "unreachable"
  | "available";

export type McpSaveValidationReason =
  | "server-unreachable"
  | "user-data-required"
  | "user-data-unavailable"
  | "consent-missing"
  | "none";

export function getMcpUserDataSupportState(
  config: McpAuthConfig
): McpUserDataSupportState {
  if (config.discoveryState === "unreachable") return "unreachable";
  if (config.discoveryState === "no-consent" || config.serverType === "plain") {
    return "plain-server";
  }
  if (supportsUserDataAuth(config)) return "available";
  return "unknown";
}

export function areAllScopesGranted(config: McpAuthConfig): boolean {
  if (!isConsentRequired(config)) return true;
  if (config.scopes.length === 0) return false;
  const granted = new Set(config.grantedScopes);
  return config.scopes.every((scope) => granted.has(scope.scope));
}

export function needsConsent(config: McpAuthConfig): boolean {
  return isConsentRequired(config) && !areAllScopesGranted(config);
}

export function shouldBlockSave(config: McpAuthConfig): boolean {
  return config.mode === "user-data" && config.discoveryState === "unreachable";
}

export function validateMcpAuthConfigForSave(config: McpAuthConfig): {
  blockingReason: McpSaveValidationReason;
} {
  if (isConsentRequired(config) && config.mode !== "user-data") {
    return { blockingReason: "user-data-required" };
  }

  if (config.mode !== "user-data") {
    return { blockingReason: "none" };
  }

  if (config.discoveryState === "unreachable") {
    return { blockingReason: "server-unreachable" };
  }

  if (!supportsUserDataAuth(config)) {
    return { blockingReason: "user-data-unavailable" };
  }

  if (isConsentRequired(config) && !areAllScopesGranted(config)) {
    return { blockingReason: "consent-missing" };
  }

  return { blockingReason: "none" };
}

export function getScopeDescription(
  scope: McpScopeDefinition,
  language?: string
): string {
  if (language?.startsWith("en")) {
    return scope.description_en || scope.description || scope.scope;
  }
  return scope.description || scope.description_en || scope.scope;
}

function createUrlWithTrailingSlash(serverUrl: string): URL {
  const url = new URL(serverUrl);
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  return url;
}

export function buildWellKnownUrls(serverUrl: string, path: string): string[] {
  const baseUrl = createUrlWithTrailingSlash(serverUrl);
  const relativePath = path.replace(/^\//, "");
  const normalizedPathname = baseUrl.pathname.replace(/\/+$/, "");
  const rootUrl = new URL(path, baseUrl.origin).toString();

  if (normalizedPathname === "/mcp") {
    return [rootUrl];
  }

  const candidates = [rootUrl, new URL(relativePath, baseUrl).toString()];
  return Array.from(new Set(candidates));
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | "timeout"> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => resolve("timeout"), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function discoverMcpServerScopes(
  serverUrl: string,
  fetcher: typeof fetch = fetch
): Promise<McpDiscoveryResult> {
  let scopesUrls: string[];
  try {
    scopesUrls = buildWellKnownUrls(serverUrl, MCP_SCOPES_PATH);
  } catch (_error) {
    return { kind: "unreachable", scopes: [], error: DEFAULT_DISCOVERY_ERROR };
  }
  let sawHttpResponse = false;
  let sawMetadataError = false;

  for (const scopesUrl of scopesUrls) {
    let response: Response | "timeout";
    try {
      response = await withTimeout(fetcher(scopesUrl), MCP_DISCOVERY_TIMEOUT_MS);
    } catch (_error) {
      continue;
    }

    if (response === "timeout") continue;

    sawHttpResponse = true;

    if (response.status === 404) continue;

    if (!response.ok) {
      sawMetadataError = true;
      continue;
    }

    const payload = await response.json().catch(() => null);
    const scopes = normalizeScopes(getScopesPayload(payload));

    if (scopes.length === 0) {
      sawMetadataError = true;
      continue;
    }

    return { kind: "consent-required", scopes };
  }

  if (sawHttpResponse) {
    if (sawMetadataError) {
      return { kind: "unreachable", scopes: [], error: DEFAULT_METADATA_ERROR };
    }
    return { kind: "no-consent", scopes: [] };
  }

  return { kind: "unreachable", scopes: [], error: DEFAULT_DISCOVERY_ERROR };
}

export async function checkMcpUserDataAvailability(
  serverUrl: string,
  fetcher: typeof fetch = fetch
): Promise<"available" | "unavailable"> {
  let jwksUrls: string[];
  try {
    jwksUrls = buildWellKnownUrls(serverUrl, MCP_JWKS_PATH);
  } catch (_error) {
    return "unavailable";
  }

  for (const jwksUrl of jwksUrls) {
    try {
      const result = await withTimeout(fetcher(jwksUrl), MCP_DISCOVERY_TIMEOUT_MS);
      if (result === "timeout" || !result.ok) continue;
      const jwks = await result.json().catch(() => null);
      if (jwks?.keys && Array.isArray(jwks.keys) && jwks.keys.length > 0) {
        return "available";
      }
    } catch (_error) {
      continue;
    }
  }

  return "unavailable";
}

export function mergeDiscoveryIntoConfig(
  previous: McpAuthConfig,
  result: McpDiscoveryResult
): McpAuthConfig {
  const normalized = normalizeMcpAuthConfig(previous);

  if (result.kind === "consent-required") {
    return {
      ...normalized,
      serverType: "scoped",
      discoveryState: "consent-required",
      availabilityState:
        normalized.availabilityState === "unavailable"
          ? "unavailable"
          : "available",
      scopes: result.scopes,
      grantedScopes: result.scopes
        .filter((scope) => normalized.grantedScopes.includes(scope.scope))
        .map((scope) => scope.scope),
      discoveryError: undefined,
      availabilityMessage: undefined,
      lastCheckedAt: Date.now(),
    };
  }

  if (result.kind === "no-consent") {
    return {
      ...normalized,
      serverType: "plain",
      discoveryState: "no-consent",
      availabilityState: "available",
      scopes: [],
      grantedScopes: [],
      discoveryError: undefined,
      availabilityMessage: undefined,
      lastCheckedAt: Date.now(),
    };
  }

  return {
    ...normalized,
    discoveryState: "unreachable",
    availabilityState: "unavailable",
    discoveryError: result.error || DEFAULT_DISCOVERY_ERROR,
    availabilityMessage: DEFAULT_AUTH_MESSAGE,
    lastCheckedAt: Date.now(),
  };
}

export async function checkTypeAServerAvailability(
  serverUrl: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  const [scopesResult, jwksResult] = await Promise.all([
    discoverMcpServerScopes(serverUrl, fetcher),
    checkMcpUserDataAvailability(serverUrl, fetcher),
  ]);
  return scopesResult.kind === "consent-required" && jwksResult === "available";
}
