import i18next from "i18next";
import { AccountOptions, GlobalAction, OpenAIOptions, OptionAction, OptionActionType, Tool} from "../context/types";
import {getAuthorizationForMcpConfig} from "../hooks/useMcpAuth";

import avatar from "../../assets/images/avatar.png";

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

async function refreshMcpToolAuthorizations(
    openai: OpenAIOptions | undefined,
    user: Record<string, unknown> | null
): Promise<Map<string, Tool> | null> {
  if (!openai) return null;
  if (!(openai.tools instanceof Map)) return null;
  if (!(openai.mcpAuthConfigs instanceof Map)) return null;
  if (openai.mcpAuthConfigs.size === 0) return null;

  const tools = new Map(openai.tools);
  const updates = await Promise.all(
      Array.from(openai.mcpAuthConfigs.entries()).map(async ([key, config]) => {
        const tool = tools.get(key);
        if (!tool || tool.type !== "mcp") return null;
        const serverUrl = (tool as Tool.Mcp).server_url || "";
        try {
          const authorization = await getAuthorizationForMcpConfig(
              config,
              serverUrl,
              user
          );
          return {key, authorization};
        } catch (error) {
          console.warn(
              "Unable to refresh MCP authorization for %s: %o",
              key,
              error
          );
          return {key, authorization: undefined};
        }
      })
  );

  let changed = false;
  for (const update of updates) {
    if (!update) continue;
    const tool = tools.get(update.key);
    if (!tool || tool.type !== "mcp") continue;
    const previousAuthorization = (tool as Tool.Mcp).authorization;
    const nextAuthorization = update.authorization;
    if (previousAuthorization === nextAuthorization) {
      continue;
    }
    const nextTool = {...tool} as Tool.Mcp;
    if (nextAuthorization) {
      nextTool.authorization = nextAuthorization;
    } else {
      delete nextTool.authorization;
    }
    tools.set(update.key, nextTool);
    changed = true;
  }

  return changed ? tools : null;
}

export function fetchAndGetUser(dispatch: {
  (action: GlobalAction): void;
  (arg0: { type: string; payload: { user: any; } | { user: any; }; }): void;
}, options: { account?: AccountOptions; general: any; openai: any; }, setOptions?: { (arg: OptionAction): void; (arg0: { type: OptionActionType; data: { tools: Map<string, Tool>; }; }): void; }) {
  fetch(import.meta.env.VITE_USER_URL, { credentials: "include" })
    .then((res) => {
      console.log("getting user: ", res.status);
      if (res.status === 401) {
        console.log(
          "unauthorized, redirecting to login: %s",
          import.meta.env.VITE_LOGIN_URL
        );
        window.location.href = import.meta.env.VITE_LOGIN_URL;
        return Promise.resolve(Error("unauthorized"));
      }

      return res.json();
    })

    .then(async (user) => {
      user.avatar = null;
      console.log("updating user: ", user);
      dispatch({ type: "SET_STATE", payload: { user } });

      if (setOptions) {
        const updatedTools = await refreshMcpToolAuthorizations(
          options?.openai,
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
      console.log("error getting user: ", err);
    });
}
