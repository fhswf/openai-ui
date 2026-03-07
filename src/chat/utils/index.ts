import i18next from "i18next";
import type { Dispatch } from "react";
import {
  AccountOptions,
  GeneralOptions,
  GlobalAction,
  GlobalActionType,
  McpAuthConfig,
  OpenAIOptions,
  OptionAction,
  OptionActionType,
  Tool,
} from "../context/types";
import { getAuthorizationForMcpConfig } from "../hooks/useMcpAuth";
import {
  createDefaultMcpAuthConfig,
  discoverMcpServerScopes,
  mergeDiscoveryIntoConfig,
  needsConsent,
} from "./mcp";
import { normalizeOpenAIOptions } from "./mcpOptions";

export * from "./options";

export function formatNumber(n) {
  return n < 10 ? `0${n}` : n;
}

export function dateFormat(secs) {
  const activeLocale = i18next.resolvedLanguage;

  const date = new Date(1000 * secs);
  return new Intl.DateTimeFormat(activeLocale, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export async function sha256Digest(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface McpAuthorizationUpdate {
  key: string;
  authorization?: string;
}

function isRefreshableMcpAuth(
  openai: OpenAIOptions | undefined
): openai is OpenAIOptions & { mcpAuthConfigs: Map<string, McpAuthConfig> } {
  return Boolean(
    openai &&
      openai.tools instanceof Map &&
      openai.mcpAuthConfigs instanceof Map &&
      openai.mcpAuthConfigs.size > 0
  );
}

function isMcpTool(tool: unknown): tool is Tool.Mcp {
  return Boolean(
    tool &&
      typeof tool === "object" &&
      "type" in tool &&
      (tool as { type?: unknown }).type === "mcp"
  );
}

async function buildMcpAuthorizationUpdates(
  tools: Map<string, Tool>,
  configs: Map<string, McpAuthConfig>,
  user: Record<string, unknown> | null
): Promise<(McpAuthorizationUpdate | null)[]> {
  return Promise.all(
    Array.from(configs.entries()).map(async ([key, config]) => {
      const tool = tools.get(key);
      if (!isMcpTool(tool)) return null;
      const serverUrl = tool.server_url || "";
      try {
        const authorization = await getAuthorizationForMcpConfig(
          config,
          serverUrl,
          user
        );
        return { key, authorization };
      } catch (error) {
        console.warn(
          "Unable to refresh MCP authorization for %s: %o",
          key,
          error
        );
        return { key, authorization: undefined };
      }
    })
  );
}

function applyMcpAuthorizationUpdates(
  tools: Map<string, Tool>,
  updates: (McpAuthorizationUpdate | null)[]
): boolean {
  let changed = false;
  for (const update of updates) {
    if (!update) continue;
    const tool = tools.get(update.key);
    if (!isMcpTool(tool)) continue;
    const previousAuthorization = tool.authorization;
    const nextAuthorization = update.authorization;
    if (previousAuthorization === nextAuthorization) continue;
    const nextTool = { ...tool } as Tool.Mcp;
    if (nextAuthorization) {
      nextTool.authorization = nextAuthorization;
    } else {
      delete nextTool.authorization;
    }
    tools.set(update.key, nextTool);
    changed = true;
  }
  return changed;
}

async function refreshMcpToolAuthorizations(
  openai: OpenAIOptions | undefined,
  user: Record<string, unknown> | null
): Promise<Map<string, Tool> | null> {
  const normalizedOpenai = normalizeOpenAIOptions(openai);
  if (!isRefreshableMcpAuth(normalizedOpenai)) return null;

  const tools = new Map(normalizedOpenai.tools);
  const updates = await buildMcpAuthorizationUpdates(
    tools,
    normalizedOpenai.mcpAuthConfigs,
    user
  );
  const changed = applyMcpAuthorizationUpdates(tools, updates);

  return changed ? tools : null;
}

async function checkMcpServersOnLogin(
  openai: OpenAIOptions | undefined
): Promise<
  | {
      mcpAuthConfigs: Map<string, McpAuthConfig>;
      toolsEnabled?: Set<string>;
    }
  | null
> {
  const normalizedOpenai = normalizeOpenAIOptions(openai);
  if (normalizedOpenai.mcpAuthConfigs.size === 0) return null;

  const configs = new Map(normalizedOpenai.mcpAuthConfigs);
  const toolsEnabled =
    normalizedOpenai.toolsEnabled instanceof Set
      ? new Set(normalizedOpenai.toolsEnabled)
      : undefined;
  let configsChanged = false;
  let toolsEnabledChanged = false;

  await Promise.all(
    Array.from(normalizedOpenai.tools.entries()).map(async ([key, tool]) => {
      if (!isMcpTool(tool)) return;
      const serverUrl = tool.server_url || "";
      if (!serverUrl) return;

      const config = configs.get(key) ?? createDefaultMcpAuthConfig();

      if (config.serverType === "scoped") {
        try {
          const discovery = await discoverMcpServerScopes(serverUrl);
          const updated = mergeDiscoveryIntoConfig(config, discovery);
          if (needsConsent(updated)) {
            updated.mode = "user-data";
            updated.staticToken = "";
          }
          updated.lastCheckedAt = Date.now();
          configs.set(key, updated);
          configsChanged = true;

          if (
            toolsEnabled &&
            (updated.discoveryState === "unreachable" || needsConsent(updated)) &&
            toolsEnabled.delete(key)
          ) {
            toolsEnabledChanged = true;
          }
        } catch (_error) {
          configs.set(key, {
            ...config,
            discoveryState: "unreachable",
            discoveryError: "The server could not be reached. Please check the URL.",
            lastCheckedAt: Date.now(),
          });
          configsChanged = true;
          if (toolsEnabled?.delete(key)) {
            toolsEnabledChanged = true;
          }
        }
        return;
      }

      try {
        const discovery = await discoverMcpServerScopes(serverUrl);
        if (discovery.kind !== "consent-required") return;

        const updated = mergeDiscoveryIntoConfig(config, discovery);
        if (needsConsent(updated)) {
          updated.mode = "user-data";
          updated.staticToken = "";
        }

        configs.set(key, updated);
        configsChanged = true;

        if (
          toolsEnabled &&
          (updated.discoveryState === "unreachable" || needsConsent(updated)) &&
          toolsEnabled.delete(key)
        ) {
          toolsEnabledChanged = true;
        }
      } catch (_error) {
        // Leave config unchanged if discovery fails on login.
      }
    })
  );

  if (!configsChanged && !toolsEnabledChanged) return null;

  return {
    mcpAuthConfigs: configs,
    toolsEnabled: toolsEnabledChanged ? toolsEnabled : undefined,
  };
}

export function fetchAndGetUser(
  dispatch: Dispatch<GlobalAction>,
  options: {
    account?: AccountOptions;
    general: Pick<GeneralOptions, "gravatar">;
    openai: OpenAIOptions | undefined;
  },
  setOptions?: Dispatch<OptionAction>
) {
  const userUrl = import.meta.env.VITE_USER_URL || "/api/user";

  fetch(userUrl, { credentials: "include" })
    .then((res) => {
      console.log("getting user: ", res.status);
      if (res.status === 401) {
        const loginUrl = import.meta.env.VITE_LOGIN_URL || "/api/login";
        console.log("unauthorized, redirecting to login: %s", loginUrl);
        window.location.assign(loginUrl);
        throw new Error("unauthorized");
      }

      if (!res.ok) throw new Error(`failed to fetch user: ${res.status}`);
      return res.json();
    })

    .then(async (user) => {
      user.avatar = null;
      console.log("updating user: ", user);
      dispatch({ type: GlobalActionType.SET_STATE, payload: { user } });

      if (setOptions) {
        // A successful /api/user response is the frontend's source of truth for
        // the active session, so refresh MCP authorizations from that payload.
        const [updatedTools, updatedAuthState] = await Promise.all([
          refreshMcpToolAuthorizations(options.openai, user),
          checkMcpServersOnLogin(options.openai),
        ]);
        const data: Partial<OpenAIOptions> = {};
        if (updatedTools) data.tools = updatedTools;
        if (updatedAuthState) {
          data.mcpAuthConfigs = updatedAuthState.mcpAuthConfigs;
          if (updatedAuthState.toolsEnabled) {
            data.toolsEnabled = updatedAuthState.toolsEnabled;
          }
        }
        if (updatedTools || updatedAuthState) {
          setOptions({
            type: OptionActionType.OPENAI,
            data,
          });
        }
      }

      if (options.general.gravatar) {
        console.log("user uses gravatar");
        sha256Digest(user.email).then((hash) => {
          user.hash = hash;
          fetch(`https://www.gravatar.com/${hash}`, { mode: "no-cors" }).then(
            (res) => {
              if (res.status === 200) {
                console.log("user has gravatar");
                user.avatar = `https://www.gravatar.com/avatar/${hash}`;
              } else {
                console.log("user has no gravatar");
                user.avatar = `https://www.gravatar.com/avatar/${hash}?d=identicon`;
              }
              dispatch({ type: GlobalActionType.SET_STATE, payload: { user } });
            }
          );
        });
      }
    })
    .catch((err) => {
      if (err instanceof Error && err.message === "unauthorized") return;
      console.log("error getting user: ", err);
    });
}
