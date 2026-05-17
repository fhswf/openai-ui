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
  normalizeMcpAuthConfig,
} from "../hooks/useMcpAuth";
import {
  deleteMcpService,
  getAllowedToolsInput,
  getAuthorizationResult,
  persistMcpService,
  updateToolSelection,
} from "./mcpServiceHelpers";
import type {
  ApprovalOptions,
  CheckedChange,
  DeleteMcpServiceHandlerArgs,
  EditToolHandlerArgs,
  EditToolRequest,
  McpEditorSetters,
  McpTextFieldName,
  McpToolCollections,
  McpToolFormState,
  McpToolMap,
  OpenEditMcpEditorArgs,
  SaveMcpServiceArgs,
  SaveMcpServiceHandlerArgs,
  ToolChangeHandlerArgs,
  ToolChangeRequest,
} from "./mcpServiceTypes";
import { toolOptions } from "./options";
export type {
  ApprovalOptions,
  CheckedChange,
  DeleteMcpServiceHandlerArgs,
  EditToolRequest,
  McpTextFieldName,
  McpToolFormState,
  SaveMcpServiceHandlerArgs,
  ToolChangeRequest,
};

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

  let migratedLegacyMcpKey = false;
  for (const [key, value] of toolOptions) {
    if (value.type !== "mcp" || !value.server_label || value.server_label === key) {
      continue;
    }

    const legacyKey = value.server_label;
    const legacyTool = openai.tools.get(legacyKey);
    if (!legacyTool || legacyTool.type !== "mcp") {
      continue;
    }

    openai.tools.set(key, legacyTool);
    openai.tools.delete(legacyKey);

    if (openai.toolsEnabled instanceof Set && openai.toolsEnabled.has(legacyKey)) {
      openai.toolsEnabled.add(key);
      openai.toolsEnabled.delete(legacyKey);
    }

    if (openai.mcpAuthConfigs instanceof Map && openai.mcpAuthConfigs.has(legacyKey)) {
      openai.mcpAuthConfigs.set(key, openai.mcpAuthConfigs.get(legacyKey));
      openai.mcpAuthConfigs.delete(legacyKey);
    }

    migratedLegacyMcpKey = true;
  }

  if (migratedLegacyMcpKey) {
    setOptions({ type: OptionActionType.OPENAI, data: { ...openai } });
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
  mcpAuthConfigs: McpToolCollections["mcpAuthConfigs"]
) {
  return mcpAuthConfigs.get(key) ?? DEFAULT_MCP_AUTH_CONFIG;
}

export function openEditMcpEditor(args: OpenEditMcpEditorArgs): void {
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

export function createEditToolHandler(
  args: EditToolHandlerArgs
): React.Dispatch<EditToolRequest> {
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

export function createToolChangeHandler(
  args: ToolChangeHandlerArgs
): React.Dispatch<ToolChangeRequest> {
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

export function createOpenMcpEditorHandler(args: McpEditorSetters): VoidFunction {
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
