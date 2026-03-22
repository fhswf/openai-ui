import React from "react";
import { createListCollection } from "@chakra-ui/react";
import type { TFunction } from "i18next";
import {
  GlobalActions,
  McpAuthConfig,
  OpenAIOptions,
  Tool,
} from "../context/types";

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
export type McpAuthorizationGetter = (
  ...args: [McpAuthConfig, string]
) => Promise<string | undefined>;

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

export interface McpEditorSetters {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

export interface SaveMcpServiceArgs {
  collections: McpToolCollections;
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: McpAuthorizationGetter;
  openai: OpenAIOptions;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}

export interface PersistMcpServiceArgs {
  collections: McpToolCollections;
  editingKey: string | null;
  form: McpToolFormState;
  openai: OpenAIOptions;
  resultAuthorization?: string;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
}

export interface DeleteMcpServiceArgs {
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

export interface OpenEditMcpEditorArgs extends McpEditorSetters {
  key: string;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  tool: Tool.Mcp;
}

export interface ToolSelectionArgs {
  checkedChange: CheckedChange;
  collections: McpToolCollections;
  key: string;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tool: Tool;
}

export interface EditToolHandlerArgs extends McpEditorSetters {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  setConsentPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface ToolChangeHandlerArgs {
  collections: McpToolCollections;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
}
