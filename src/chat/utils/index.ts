import i18next from "i18next";
import type { Dispatch } from "react";
import {
  AccountOptions,
  GeneralOptions,
  GlobalAction,
  McpAuthConfig,
  OpenAIOptions,
  OptionAction,
  OptionActionType,
  Tool,
} from "../context/types";
import { getAuthorizationForMcpConfig } from "../hooks/useMcpAuth";

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
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
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
  if (!isRefreshableMcpAuth(openai)) return null;

  const tools = new Map(openai.tools);
  const updates = await buildMcpAuthorizationUpdates(
    tools,
    openai.mcpAuthConfigs,
    user
  );
  const changed = applyMcpAuthorizationUpdates(tools, updates);

  return changed ? tools : null;
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
        console.log(
          "unauthorized, redirecting to login: %s",
          loginUrl
        );
        window.location.href = escape(loginUrl);
        throw new Error("unauthorized");
      }

      if (!res.ok) throw new Error(`failed to fetch user: ${res.status}`);
      return res.json();
    })

    .then(async (user) => {
      user.avatar = null;
      console.log("updating user: ", user);
      dispatch({ type: "SET_STATE", payload: { user } });

      if (setOptions) {
        const updatedTools = await refreshMcpToolAuthorizations(
          options.openai,
          user
        );
        if (updatedTools) {
          setOptions({
            type: OptionActionType.OPENAI,
            data: { tools: updatedTools },
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
              dispatch({ type: "SET_STATE", payload: { user } });
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
