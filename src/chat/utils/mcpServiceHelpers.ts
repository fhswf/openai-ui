import React from "react";
import type { TFunction } from "i18next";
import {
  GlobalActions,
  McpAuthConfig,
  OpenAIOptions,
  OptionActionType,
  Tool,
} from "../context/types";
import {
  hasBeenConsentPrompted,
  isMcpAuthorizationIncomplete,
  normalizeMcpAuthConfig,
} from "../hooks/useMcpAuth";
import type {
  EditToolRequest,
  McpAuthorizationGetter,
  McpToolCollections,
  McpToolFormState,
  PersistMcpServiceArgs,
  ToolSelectionArgs,
} from "./mcpServiceTypes";

interface AuthorizationResult {
  authorization?: string;
  ok: boolean;
}

interface UpdateOpenAiOptionsArgs {
  mcpAuthConfigs?: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tools?: Map<string, Tool>;
}

interface OpenConsentPromptArgs {
  collections: McpToolCollections;
  key: string;
  mcpAuthConfig: McpAuthConfig | undefined;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tool: Tool.Mcp;
}

function updateOpenAiOptions(args: UpdateOpenAiOptionsArgs): void {
  const nextData: Partial<OpenAIOptions> = { ...args.openai };

  if (args.tools) {
    nextData.tools = args.tools;
  }
  if (args.mcpAuthConfigs) {
    nextData.mcpAuthConfigs = args.mcpAuthConfigs;
  }

  args.setOptions({
    type: OptionActionType.OPENAI,
    data: nextData,
  });
}

function setToolEnabled(
  collections: McpToolCollections,
  key: string,
  checked: boolean
): void {
  if (checked) {
    collections.toolsEnabled.add(key);
    return;
  }

  collections.toolsEnabled.delete(key);
}

function shouldPromptForConsent(
  checked: boolean,
  tool: Tool,
  mcpAuthConfig: McpAuthConfig | undefined
): tool is Tool.Mcp {
  return (
    checked &&
    tool.type === "mcp" &&
    isMcpAuthorizationIncomplete(mcpAuthConfig) &&
    !hasBeenConsentPrompted(mcpAuthConfig)
  );
}

function markConsentPrompted(
  mcpAuthConfig: McpAuthConfig | undefined
): McpAuthConfig | undefined {
  if (mcpAuthConfig?.mode !== "user-data") {
    return mcpAuthConfig;
  }

  return {
    mode: "user-data",
    userData: {
      ...mcpAuthConfig.userData,
      consentPrompted: true,
    },
  };
}

function openConsentPrompt(args: OpenConsentPromptArgs): void {
  setToolEnabled(args.collections, args.key, true);

  const nextAuthConfig = markConsentPrompted(args.mcpAuthConfig);
  if (nextAuthConfig) {
    args.collections.mcpAuthConfigs.set(args.key, nextAuthConfig);
  }

  updateOpenAiOptions({
    mcpAuthConfigs: args.collections.mcpAuthConfigs,
    openai: args.openai,
    setOptions: args.setOptions,
  });
  args.onEditTool({ key: args.key, tool: args.tool, consentPrompt: true });
}

function getAllowedTools(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanupRenamedTool(
  collections: McpToolCollections,
  oldKey: string | null,
  newKey: string
): void {
  if (oldKey && oldKey !== newKey) {
    collections.tools.delete(oldKey);
    collections.toolsEnabled.delete(oldKey);
    collections.mcpAuthConfigs.delete(oldKey);
  }
}

function createMcpToolDefinition(
  form: McpToolFormState,
  authorization?: string
): Tool.Mcp {
  const allowedTools = getAllowedTools(form.allowed_tools_input);

  return {
    type: "mcp",
    server_label: form.label,
    server_url: form.server_url,
    require_approval: form.require_approval,
    ...(authorization ? { authorization } : {}),
    ...(allowedTools.length > 0 ? { allowed_tools: allowedTools } : {}),
  };
}

export function getAllowedToolsInput(tool: Tool.Mcp): string {
  return Array.isArray(tool.allowed_tools) ? tool.allowed_tools.join(",") : "";
}

export function getAuthorizationResult(args: {
  authConfig: McpAuthConfig;
  getAuthorization: McpAuthorizationGetter;
  serverUrl: string;
  t: TFunction;
}): Promise<AuthorizationResult> {
  return args
    .getAuthorization(args.authConfig, args.serverUrl)
    .then((authorization) => ({ ok: true, authorization }))
    .catch((error) => {
      alert(
        error instanceof Error
          ? error.message
          : args.t("mcp_authorization_failed")
      );
      return { ok: false };
    });
}

export function persistMcpService(args: PersistMcpServiceArgs): void {
  const nextAuthConfig = normalizeMcpAuthConfig(args.form.authConfig);

  if (
    nextAuthConfig.mode === "user-data" &&
    nextAuthConfig.userData.scopes.length > 0 &&
    !nextAuthConfig.userData.consentGranted
  ) {
    nextAuthConfig.userData.consentPrompted = true;
  }

  cleanupRenamedTool(args.collections, args.editingKey, args.form.label);
  args.setEditingKey(null);
  args.collections.tools.set(
    args.form.label,
    createMcpToolDefinition(args.form, args.resultAuthorization)
  );
  args.collections.mcpAuthConfigs.set(args.form.label, nextAuthConfig);

  updateOpenAiOptions({
    mcpAuthConfigs: args.collections.mcpAuthConfigs,
    openai: args.openai,
    setOptions: args.setOptions,
    tools: args.collections.tools,
  });
}

export function deleteMcpService(args: {
  collections: McpToolCollections;
  key: string;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
}): void {
  if (!args.collections.tools.has(args.key)) {
    console.error(`Tool with key ${args.key} does not exist.`);
    return;
  }

  args.collections.tools.delete(args.key);
  args.collections.toolsEnabled.delete(args.key);
  args.collections.mcpAuthConfigs.delete(args.key);
  updateOpenAiOptions({
    openai: args.openai,
    setOptions: args.setOptions,
    tools: args.collections.tools,
  });
}

export function updateToolSelection(args: ToolSelectionArgs): void {
  const checked =
    typeof args.checkedChange === "boolean"
      ? args.checkedChange
      : args.checkedChange.checked === true;
  const mcpAuthConfig = args.collections.mcpAuthConfigs.get(args.key);

  if (shouldPromptForConsent(checked, args.tool, mcpAuthConfig)) {
    openConsentPrompt({
      collections: args.collections,
      key: args.key,
      mcpAuthConfig,
      onEditTool: args.onEditTool,
      openai: args.openai,
      setOptions: args.setOptions,
      tool: args.tool,
    });
    return;
  }

  setToolEnabled(args.collections, args.key, checked);
  updateOpenAiOptions({
    openai: args.openai,
    setOptions: args.setOptions,
  });
}
