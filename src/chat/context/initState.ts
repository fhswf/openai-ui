import {GlobalState, McpAuthConfig} from "./types";
import { v7 as uuidv7 } from "uuid";
import { initApps } from "../apps/context/initState";

import i18n from "../../i18n/config";
import { toolOptions } from "../utils";
const { t } = i18n;

export const defaultOpenAIBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.API_BASE_URL ||
  "https://api.openai.com/v1";

export const defaultOpenAIModel = "gpt-4o-mini";

export const initState: GlobalState = {
  current: 0,
  chat: [
    {
      title: t("chatbot_title"),
      id: 1,
      ct: Date.now(),
      thread: "",
      botStarts: false,
      messages: [
        {
          content: t("system_welcome"),
          // use only seconds here
          sentTime: Math.floor(Date.now() / 1000),
          role: "assistant",
          id: uuidv7(),
        },
      ],
      app: 0,
    },
  ],
  currentChat: 0,
  currentApp: initApps.apps[0],
  options: {
    account: {
      name: "Anonymus",
      avatar: "",
      terms: false,
    },
    general: {
      language: "de",
      theme: "light",
      sendCommand: "COMMAND_ENTER",
      size: "normal",
      codeEditor: false,
      gravatar: false,
    },
    openai: {
      baseUrl: defaultOpenAIBaseUrl,
      organizationId: "",
      temperature: 1,
      mode: "chat",
      model: defaultOpenAIModel,
      apiKey: "unused",
      max_tokens: 2048,
      n: 1,
      tools: toolOptions,
      toolsEnabled: new Set(),
      top_p: 1,
      stream: true,
      assistant: "",
      mcpAuthConfigs: new Map<string, McpAuthConfig>(),
      aiHubEnabled: false,
      aiHubApiKey: "",
      aiHubKeyAlias: "kimpuls",
      aiHubModels: [],
      aiHubPreviousApiKey: "",
      aiHubPreviousBaseUrl: "",
      aiHubPreviousModel: "",
    },
  },
  is: {
    typeing: false,
    config: false,
    fullScreen: true,
    sidebar: false,
    toolbar: false,
    inputing: false,
    thinking: false,
    apps: true,
    tool: "",
  },
  typeingMessage: {},
  user: null,
  version: "0.1.0",
};
