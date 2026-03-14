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
import {
  DEFAULT_MCP_AUTH_CONFIG,
  discoverMcpAuthForServer,
  getAuthorizationForMcpConfig,
  isMcpAuthorizationIncomplete,
  normalizeMcpAuthConfig,
} from "../hooks/useMcpAuth";

export * from "./options";

export function formatNumber(n) {
  return n < 10 ? `0${n}` : n;
}

export function dateFormat(secs) {
  const activeLocale = i18next.resolvedLanguage;

  const date = new Date(1000 * secs);
  //console.log("dateFormat: ", date, "activeLocale: ", activeLocale, "ms: ", ms, "date: ", date);
  return new Intl.DateTimeFormat(activeLocale, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export async function sha256Digest(message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  // convert bytes to hex string
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isMcpTool(tool: unknown): tool is Tool.Mcp {
  return Boolean(
    tool &&
      typeof tool === "object" &&
      "type" in tool &&
      (tool as { type?: unknown }).type === "mcp"
  );
}

async function refreshMcpConfigs(
  tools: Map<string, Tool>,
  configs: Map<string, McpAuthConfig>
): Promise<void> {
  await Promise.all(
    Array.from(tools.entries()).map(async ([key, tool]) => {
      if (!isMcpTool(tool)) return;
      try {
        const discovered = await discoverMcpAuthForServer(
          tool.server_url || "",
          configs.get(key)
        );
        configs.set(key, discovered);
      } catch (error) {
        console.warn("Unable to discover MCP auth for %s: %o", key, error);
      }
    })
  );
}

async function refreshMcpAuthorizations(
  tools: Map<string, Tool>,
  configs: Map<string, McpAuthConfig>,
  user: Record<string, unknown> | null
): Promise<void> {
  await Promise.all(
    Array.from(tools.entries()).map(async ([key, tool]) => {
      if (!isMcpTool(tool)) return;
      const config = normalizeMcpAuthConfig(
        configs.get(key) ?? DEFAULT_MCP_AUTH_CONFIG
      );
      try {
        const authorization = await getAuthorizationForMcpConfig(
          config,
          tool.server_url || "",
          user
        );
        const nextTool = { ...tool } as Tool.Mcp;
        if (authorization) {
          nextTool.authorization = authorization;
        } else {
          delete nextTool.authorization;
        }
        tools.set(key, nextTool);
      } catch (error) {
        console.warn(
          "Unable to refresh MCP authorization for %s: %o",
          key,
          error
        );
      }
    })
  );
}

export function fetchAndGetUser(
  dispatch: Dispatch<GlobalAction>,
  getOptions: () => {
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
      const currentOptions = getOptions();

      user.avatar = null;
      console.log("updating user: ", user);
      dispatch({ type: GlobalActionType.SET_STATE, payload: { user } });

      // Discover MCP auth configs for all configured servers
      if (setOptions && currentOptions.openai?.tools instanceof Map) {
        const tools = new Map(currentOptions.openai.tools);
        const configs =
          currentOptions.openai.mcpAuthConfigs instanceof Map
            ? new Map(currentOptions.openai.mcpAuthConfigs)
            : new Map<string, McpAuthConfig>();
        const toolsEnabled =
          currentOptions.openai.toolsEnabled instanceof Set
            ? new Set(currentOptions.openai.toolsEnabled)
            : new Set<string>();

        await refreshMcpConfigs(tools, configs);
        await refreshMcpAuthorizations(tools, configs, user);

        Array.from(tools.entries()).forEach(([key, tool]) => {
          if (!isMcpTool(tool)) return;

          const config = normalizeMcpAuthConfig(
            configs.get(key) ?? DEFAULT_MCP_AUTH_CONFIG
          );

          if (isMcpAuthorizationIncomplete(config)) {
            toolsEnabled.delete(key);
          }
        });

        setOptions({
          type: OptionActionType.OPENAI,
          data: {
            mcpAuthConfigs: configs,
            tools,
            toolsEnabled,
          },
        });
      }

      if (currentOptions.general.gravatar) {
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
              dispatch({
                type: GlobalActionType.SET_STATE,
                payload: { user },
              });
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
