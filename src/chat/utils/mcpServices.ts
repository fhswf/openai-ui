import React from "react";
import { createListCollection } from "@chakra-ui/react";
import type { TFunction } from "i18next";
import {
  GlobalActions,
  McpAuthConfig,
  OpenAIOptions,
  OptionActionType,
  Tool,
} from "../context/types";
import {
  DEFAULT_MCP_AUTH_CONFIG,
  hasBeenConsentPrompted,
  isMcpAuthorizationIncomplete,
  normalizeMcpAuthConfig,
  useMcpAuth,
} from "../hooks/useMcpAuth";
import { toolOptions } from "./options";

export interface McpToolFormState {
  label: string;
  server_url: string;
  require_approval: "always" | "never";
  allowed_tools_input: string;
  authConfig: McpAuthConfig;
}

export type CheckedChange = boolean | { checked: boolean | "indeterminate" };
export type McpTextFieldName = "label" | "server_url" | "allowed_tools_input";
export type McpToolMap = Map<string, Tool.Mcp>;
type McpAuthorizationGetter = ReturnType<typeof useMcpAuth>["getAuthorization"];

export interface EditToolRequest {
  key: string;
  tool: Tool.Mcp;
  consentPrompt?: boolean;
}

export interface ToolChangeRequest {
  checkedChange: CheckedChange;
  key: string;
  tool: Tool;
}

interface AuthorizationResult {
  authorization?: string;
  ok: boolean;
}

interface ApprovalOption {
  label: string;
  value: "always" | "never";
}

export type ApprovalOptions = ReturnType<
  typeof createListCollection<ApprovalOption>
>;

export interface McpToolCollections {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

interface McpEditorSetters {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

interface SaveMcpServiceArgs {
  collections: McpToolCollections;
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: McpAuthorizationGetter;
  openai: OpenAIOptions;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}

interface PersistMcpServiceArgs {
  collections: McpToolCollections;
  editingKey: string | null;
  form: McpToolFormState;
  openai: OpenAIOptions;
  resultAuthorization?: string;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
}

interface DeleteMcpServiceArgs {
  collections: McpToolCollections;
  key: string;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
}

export interface DeleteMcpServiceHandlerArgs extends McpToolCollections {
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
}

export interface SaveMcpServiceHandlerArgs extends McpToolCollections {
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: McpAuthorizationGetter;
  openai: OpenAIOptions;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}

export function createEmptyMcpToolForm(): McpToolFormState {
  return {
    label: "",
    server_url: "",
    require_approval: "never",
    allowed_tools_input: "",
    authConfig: DEFAULT_MCP_AUTH_CONFIG,
  };
}

export function isMcpTool(tool: Tool): tool is Tool.Mcp {
  return tool.type === "mcp";
}

function getCheckedValue(checked: CheckedChange): boolean {
  return typeof checked === "boolean" ? checked : checked.checked === true;
}

function getAllowedToolsInput(tool: Tool.Mcp): string {
  return Array.isArray(tool.allowed_tools) ? tool.allowed_tools.join(",") : "";
}

function getAllowedTools(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getApprovalOptions(t: TFunction): ApprovalOptions {
  return createListCollection({
    items: [
      { label: t("Always"), value: "always" },
      { label: t("Never"), value: "never" },
    ],
  });
}

export function getNormalizedTools(
  openai: OpenAIOptions,
  setOptions: GlobalActions["setOptions"]
): Map<string, Tool> {
  if (!(openai.tools instanceof Map)) {
    const tools = new Map(toolOptions.entries());
    setOptions({ type: OptionActionType.OPENAI, data: { ...openai, tools } });
    return tools;
  }

  for (const [key, value] of toolOptions) {
    if (!openai.tools.has(key)) {
      openai.tools.set(key, value);
    }
  }

  return openai.tools;
}

export function ensureToolCollections(openai: OpenAIOptions): {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  toolsEnabled: Set<string>;
} {
  if (!(openai.toolsEnabled instanceof Set)) {
    openai.toolsEnabled = new Set<string>();
  }
  if (!(openai.mcpAuthConfigs instanceof Map)) {
    openai.mcpAuthConfigs = new Map<string, McpAuthConfig>();
  }

  return {
    toolsEnabled: openai.toolsEnabled,
    mcpAuthConfigs: openai.mcpAuthConfigs,
  };
}

export function buildMcpTools(tools: Map<string, Tool>): McpToolMap {
  const mcpTools: McpToolMap = new Map();

  for (const [key, value] of tools) {
    if (isMcpTool(value)) {
      mcpTools.set(key, value);
    }
  }

  return mcpTools;
}

export function validateMcpToolForm(
  form: McpToolFormState,
  t: TFunction
): boolean {
  if (form.label && form.server_url) {
    return true;
  }

  alert(t("Please fill in all required fields"));
  return false;
}

export function updateFormField(
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>,
  field: keyof McpToolFormState,
  value: McpToolFormState[keyof McpToolFormState]
): void {
  setForm((current) => {
    switch (field) {
      case "label":
        return { ...current, label: String(value) };
      case "server_url":
        return { ...current, server_url: String(value) };
      case "require_approval":
        return {
          ...current,
          require_approval: value as McpToolFormState["require_approval"],
        };
      case "allowed_tools_input":
        return { ...current, allowed_tools_input: String(value) };
      case "authConfig":
        return { ...current, authConfig: value as McpAuthConfig };
      default:
        return current;
    }
  });
}

export function openCreateMcpEditor({
  setDialogOpen,
  setEditingKey,
  setForm,
}: McpEditorSetters): void {
  setEditingKey(null);
  setForm(createEmptyMcpToolForm());
  setDialogOpen(true);
}

function getStoredMcpAuthConfig(
  key: string,
  mcpAuthConfigs: Map<string, McpAuthConfig>
): McpAuthConfig {
  return mcpAuthConfigs.get(key) ?? DEFAULT_MCP_AUTH_CONFIG;
}

export function openEditMcpEditor(args: {
  key: string;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  tool: Tool.Mcp;
}): void {
  args.setEditingKey(args.key);
  args.setForm({
    label: args.tool.server_label || args.key,
    server_url: args.tool.server_url || "",
    require_approval:
      args.tool.require_approval === "always" ? "always" : "never",
    allowed_tools_input: getAllowedToolsInput(args.tool),
    authConfig: getStoredMcpAuthConfig(args.key, args.mcpAuthConfigs),
  });
  args.setDialogOpen(true);
}

export function updateToolSelection(args: {
  checkedChange: CheckedChange;
  collections: McpToolCollections;
  key: string;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tool: Tool;
}): void {
  const checked = getCheckedValue(args.checkedChange);
  const mcpAuthConfig = args.collections.mcpAuthConfigs.get(args.key);

  if (
    checked &&
    isMcpTool(args.tool) &&
    isMcpAuthorizationIncomplete(mcpAuthConfig) &&
    !hasBeenConsentPrompted(mcpAuthConfig)
  ) {
    // First time: enable the tool, mark as prompted, persist, then open edit dialog
    args.collections.toolsEnabled.add(args.key);
    if (mcpAuthConfig?.mode === "user-data") {
      args.collections.mcpAuthConfigs.set(args.key, {
        mode: "user-data",
        userData: {
          ...mcpAuthConfig.userData,
          consentPrompted: true,
        },
      });
      args.setOptions({
        type: OptionActionType.OPENAI,
        data: { ...args.openai },
      });
    }
    args.onEditTool({ key: args.key, tool: args.tool, consentPrompt: true });
    return;
  }

  // Already prompted or consent granted: allow normal toggle
  if (checked) {
    args.collections.toolsEnabled.add(args.key);
  } else {
    args.collections.toolsEnabled.delete(args.key);
  }

  args.setOptions({
    type: OptionActionType.OPENAI,
    data: { ...args.openai },
  });
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

async function getAuthorizationResult(args: {
  authConfig: McpAuthConfig;
  getAuthorization: McpAuthorizationGetter;
  serverUrl: string;
  t: TFunction;
}): Promise<AuthorizationResult> {
  try {
    return {
      ok: true,
      authorization: await args.getAuthorization(
        args.authConfig,
        args.serverUrl
      ),
    };
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : args.t("mcp_authorization_failed")
    );
    return { ok: false };
  }
}

function createBaseMcpToolDefinition(form: McpToolFormState): Tool.Mcp {
  return {
    type: "mcp",
    server_label: form.label,
    server_url: form.server_url,
    require_approval: form.require_approval,
  };
}

function applyMcpAuthorization(tool: Tool.Mcp, authorization?: string): void {
  if (authorization) {
    tool.authorization = authorization;
  }
}

function applyAllowedToolList(tool: Tool.Mcp, allowedToolsInput: string): void {
  const allowedTools = getAllowedTools(allowedToolsInput);
  if (allowedTools.length > 0) {
    tool.allowed_tools = allowedTools;
  }
}

function createMcpToolDefinition(
  form: McpToolFormState,
  authorization?: string
): Tool.Mcp {
  const tool = createBaseMcpToolDefinition(form);

  applyMcpAuthorization(tool, authorization);
  applyAllowedToolList(tool, form.allowed_tools_input);

  return tool;
}

function persistMcpService(args: PersistMcpServiceArgs): void {
  const nextAuthConfig = normalizeMcpAuthConfig(args.form.authConfig);

  // Mark as prompted when saving without consent (user has seen the dialog)
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

  args.setOptions({
    type: OptionActionType.OPENAI,
    data: {
      ...args.openai,
      tools: args.collections.tools,
      mcpAuthConfigs: args.collections.mcpAuthConfigs,
    },
  });
}

export async function saveMcpService(args: SaveMcpServiceArgs): Promise<void> {
  if (!validateMcpToolForm(args.form, args.t)) {
    return;
  }

  const nextAuthConfig = normalizeMcpAuthConfig(args.form.authConfig);
  const result = await getAuthorizationResult({
    authConfig: nextAuthConfig,
    getAuthorization: args.getAuthorization,
    serverUrl: args.form.server_url,
    t: args.t,
  });

  if (!result.ok) {
    return;
  }

  persistMcpService({
    collections: args.collections,
    editingKey: args.editingKey,
    form: args.form,
    openai: args.openai,
    resultAuthorization: result.authorization,
    setEditingKey: args.setEditingKey,
    setOptions: args.setOptions,
  });
}

function deleteMcpService(args: DeleteMcpServiceArgs): void {
  if (!args.collections.tools.has(args.key)) {
    console.error(`Tool with key ${args.key} does not exist.`);
    return;
  }

  args.collections.tools.delete(args.key);
  args.collections.toolsEnabled.delete(args.key);
  args.collections.mcpAuthConfigs.delete(args.key);
  args.setOptions({
    type: OptionActionType.OPENAI,
    data: { ...args.openai, tools: args.collections.tools },
  });
}

export function createEditToolHandler(args: {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  setConsentPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}): React.Dispatch<EditToolRequest> {
  return ({ key, tool, consentPrompt }) => {
    args.setConsentPromptOpen(consentPrompt === true);
    openEditMcpEditor({
      key,
      tool,
      mcpAuthConfigs: args.mcpAuthConfigs,
      setDialogOpen: args.setDialogOpen,
      setEditingKey: args.setEditingKey,
      setForm: args.setForm,
    });
  };
}

export function createToolChangeHandler(args: {
  collections: McpToolCollections;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
}): React.Dispatch<ToolChangeRequest> {
  return ({ checkedChange, key, tool }) => {
    updateToolSelection({
      checkedChange,
      collections: args.collections,
      key,
      onEditTool: args.onEditTool,
      openai: args.openai,
      setOptions: args.setOptions,
      tool,
    });
  };
}

export function createOpenMcpEditorHandler(args: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}): VoidFunction {
  return () => {
    openCreateMcpEditor(args);
  };
}

export function createDeleteMcpServiceHandler(
  args: DeleteMcpServiceHandlerArgs
): React.Dispatch<string> {
  return (key) => {
    deleteMcpService({
      collections: args,
      key,
      openai: args.openai,
      setOptions: args.setOptions,
    });
  };
}

export function createSaveMcpServiceHandler(
  args: SaveMcpServiceHandlerArgs
): VoidFunction {
  return () => {
    void saveMcpService({
      collections: args,
      editingKey: args.editingKey,
      form: args.form,
      getAuthorization: args.getAuthorization,
      openai: args.openai,
      setEditingKey: args.setEditingKey,
      setOptions: args.setOptions,
      t: args.t,
    });
  };
}
