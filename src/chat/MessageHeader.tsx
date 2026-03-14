import React, { useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  Tool,
  App,
  McpAuthConfig,
  OpenAIOptions,
  GlobalActions,
  OptionActionType,
} from "./context/types";
import {
  Avatar,
  HStack,
  Stack,
  Text,
  IconButton,
  Button,
  Menu,
  Popover,
  Dialog,
  CloseButton,
  Heading,
  Portal,
  Field,
  Input,
  Select,
  Checkbox,
  Separator,
  createListCollection,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { IoLogoMarkdown, IoSettingsOutline } from "react-icons/io5";
import { BiSolidFileJson } from "react-icons/bi";
import {
  LuChevronRight,
  LuPanelLeftClose,
  LuPanelLeftOpen,
} from "react-icons/lu";
import { MdDelete, MdEdit, MdOutlineSimCardDownload } from "react-icons/md";
import { CgOptions } from "react-icons/cg";
import { RiChatNewLine } from "react-icons/ri";
import { useGlobal } from "./context";
import { useApps } from "./apps/context";
import { useMessage } from "./hooks";
import { classnames } from "../components/utils";
import styles from "./style/menu.module.less";
import { MessageMenu } from "./MessageMenu";
import { modelOptions, toolOptions } from "./utils/options";
import { GitHubMenu } from "./GitHubMenu";
import { UsageInformationDialog } from "./UsageInformationDialog";
import { McpAuthFields } from "./McpAuthFields";
import {
  DEFAULT_MCP_AUTH_CONFIG,
  isMcpAuthorizationIncomplete,
  normalizeMcpAuthConfig,
  useMcpAuth,
} from "./hooks/useMcpAuth";

import "../assets/icon/style.css";

interface McpToolFormState {
  label: string;
  server_url: string;
  require_approval: "always" | "never";
  allowed_tools_input: string;
  authConfig: McpAuthConfig;
}

type CheckedChange = boolean | { checked: boolean | "indeterminate" };
type McpTextFieldName = "label" | "server_url" | "allowed_tools_input";

interface CategoryItem {
  id: number;
  icon: string;
}

type McpToolMap = Map<string, Tool.Mcp>;

interface EditToolRequest {
  key: string;
  tool: Tool.Mcp;
}

interface ToolChangeRequest {
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

type ApprovalOptions = ReturnType<typeof createListCollection<ApprovalOption>>;

function createEmptyMcpToolForm(): McpToolFormState {
  return {
    label: "",
    server_url: "",
    require_approval: "never",
    allowed_tools_input: "",
    authConfig: DEFAULT_MCP_AUTH_CONFIG,
  };
}

function isMcpTool(tool: Tool): tool is Tool.Mcp {
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

function getApprovalOptions(t: TFunction) {
  return createListCollection({
    items: [
      { label: t("Always"), value: "always" },
      { label: t("Never"), value: "never" },
    ],
  });
}

function getNormalizedTools(
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

function ensureToolCollections(openai: OpenAIOptions): {
  toolsEnabled: Set<string>;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
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

function buildMcpTools(tools: Map<string, Tool>): McpToolMap {
  const mcpTools: McpToolMap = new Map();

  for (const [key, value] of tools) {
    if (isMcpTool(value)) {
      mcpTools.set(key, value);
    }
  }

  return mcpTools;
}

function validateMcpToolForm(form: McpToolFormState, t: TFunction): boolean {
  if (form.label && form.server_url) {
    return true;
  }

  alert(t("Please fill in all required fields"));
  return false;
}

function updateFormField(
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

function openCreateMcpEditor(
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>,
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
): void {
  setEditingKey(null);
  setForm(createEmptyMcpToolForm());
  setOpen(true);
}

function openEditMcpEditor(
  key: string,
  tool: Tool.Mcp,
  mcpAuthConfigs: Map<string, McpAuthConfig>,
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>,
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>,
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
): void {
  setEditingKey(key);
  setForm({
    label: tool.server_label || key,
    server_url: tool.server_url || "",
    require_approval: tool.require_approval === "always" ? "always" : "never",
    allowed_tools_input: getAllowedToolsInput(tool),
    authConfig: mcpAuthConfigs.get(key) ?? DEFAULT_MCP_AUTH_CONFIG,
  });
  setOpen(true);
}

function updateToolSelection(args: {
  checkedChange: CheckedChange;
  key: string;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tool: Tool;
  toolsEnabled: Set<string>;
}): void {
  const checked = getCheckedValue(args.checkedChange);

  if (
    checked &&
    isMcpTool(args.tool) &&
    isMcpAuthorizationIncomplete(args.mcpAuthConfigs.get(args.key))
  ) {
    args.onEditTool({ key: args.key, tool: args.tool });
    return;
  }

  if (checked) {
    args.toolsEnabled.add(args.key);
  } else {
    args.toolsEnabled.delete(args.key);
  }

  args.setOptions({
    type: OptionActionType.OPENAI,
    data: { ...args.openai },
  });
}

function cleanupRenamedTool(
  oldKey: string | null,
  newKey: string,
  tools: Map<string, Tool>,
  toolsEnabled: Set<string>,
  mcpAuthConfigs: Map<string, McpAuthConfig>
): void {
  if (oldKey && oldKey !== newKey) {
    tools.delete(oldKey);
    toolsEnabled.delete(oldKey);
    mcpAuthConfigs.delete(oldKey);
  }
}

async function getAuthorizationResult(args: {
  authConfig: McpAuthConfig;
  getAuthorization: ReturnType<typeof useMcpAuth>["getAuthorization"];
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

async function saveMcpService(args: {
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: ReturnType<typeof useMcpAuth>["getAuthorization"];
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}): Promise<void> {
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
    editingKey: args.editingKey,
    form: args.form,
    mcpAuthConfigs: args.mcpAuthConfigs,
    openai: args.openai,
    resultAuthorization: result.authorization,
    setEditingKey: args.setEditingKey,
    setOptions: args.setOptions,
    tools: args.tools,
    toolsEnabled: args.toolsEnabled,
  });
}

function persistMcpService(args: {
  editingKey: string | null;
  form: McpToolFormState;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  resultAuthorization?: string;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}): void {
  const nextAuthConfig = normalizeMcpAuthConfig(args.form.authConfig);

  cleanupRenamedTool(
    args.editingKey,
    args.form.label,
    args.tools,
    args.toolsEnabled,
    args.mcpAuthConfigs
  );
  args.setEditingKey(null);
  args.tools.set(
    args.form.label,
    createMcpToolDefinition(args.form, args.resultAuthorization)
  );
  args.mcpAuthConfigs.set(args.form.label, nextAuthConfig);

  if (isMcpAuthorizationIncomplete(nextAuthConfig)) {
    args.toolsEnabled.delete(args.form.label);
  }

  args.setOptions({
    type: OptionActionType.OPENAI,
    data: {
      ...args.openai,
      tools: args.tools,
      mcpAuthConfigs: args.mcpAuthConfigs,
    },
  });
}

function deleteMcpService(args: {
  key: string;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}): void {
  if (!args.tools.has(args.key)) {
    console.error(`Tool with key ${args.key} does not exist.`);
    return;
  }

  args.tools.delete(args.key);
  args.toolsEnabled.delete(args.key);
  args.mcpAuthConfigs.delete(args.key);
  args.setOptions({
    type: OptionActionType.OPENAI,
    data: { ...args.openai, tools: args.tools },
  });
}

function logout(): void {
  console.log("Logout");
  globalThis.location.assign(import.meta.env.VITE_LOGOUT_URL || "/");
}

function createEditToolHandler(args: {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}): React.Dispatch<EditToolRequest> {
  return ({ key, tool }) => {
    openEditMcpEditor(
      key,
      tool,
      args.mcpAuthConfigs,
      args.setEditingKey,
      args.setForm,
      args.setDialogOpen
    );
  };
}

function createToolChangeHandler(args: {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  onEditTool: React.Dispatch<EditToolRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  toolsEnabled: Set<string>;
}): React.Dispatch<ToolChangeRequest> {
  return ({ checkedChange, key, tool }) => {
    updateToolSelection({
      checkedChange,
      key,
      mcpAuthConfigs: args.mcpAuthConfigs,
      onEditTool: args.onEditTool,
      openai: args.openai,
      setOptions: args.setOptions,
      tool,
      toolsEnabled: args.toolsEnabled,
    });
  };
}

function createOpenMcpEditorHandler(args: {
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}): VoidFunction {
  return () => {
    openCreateMcpEditor(args.setEditingKey, args.setForm, args.setDialogOpen);
  };
}

interface DeleteMcpServiceHandlerArgs {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

function createDeleteMcpServiceHandler(
  args: DeleteMcpServiceHandlerArgs
): React.Dispatch<string> {
  return (key) => {
    deleteMcpService({
      key,
      mcpAuthConfigs: args.mcpAuthConfigs,
      openai: args.openai,
      setOptions: args.setOptions,
      tools: args.tools,
      toolsEnabled: args.toolsEnabled,
    });
  };
}

interface SaveMcpServiceHandlerArgs {
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: ReturnType<typeof useMcpAuth>["getAuthorization"];
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

function createSaveMcpServiceHandler(
  args: SaveMcpServiceHandlerArgs
): VoidFunction {
  return () => {
    void saveMcpService({
      editingKey: args.editingKey,
      form: args.form,
      getAuthorization: args.getAuthorization,
      mcpAuthConfigs: args.mcpAuthConfigs,
      openai: args.openai,
      setEditingKey: args.setEditingKey,
      setOptions: args.setOptions,
      t: args.t,
      tools: args.tools,
      toolsEnabled: args.toolsEnabled,
    });
  };
}

interface ToolbarToggleButtonProps {
  setIs: GlobalActions["setIs"];
  toolbar: boolean;
}

function ToolbarToggleButton({ setIs, toolbar }: ToolbarToggleButtonProps) {
  const { t } = useTranslation();

  return (
    <IconButton
      hideFrom="md"
      variant="ghost"
      title={toolbar ? t("hide_toolbar") : t("show_toolbar")}
      onClick={() => {
        setIs({ toolbar: !toolbar });
      }}
    >
      {toolbar ? <LuPanelLeftClose /> : <LuPanelLeftOpen />}
    </IconButton>
  );
}

interface HeaderTitleBlockProps {
  messages?: { role: string }[];
  title?: string;
}

function HeaderTitleBlock({ messages, title }: HeaderTitleBlockProps) {
  const { t } = useTranslation();
  const count = messages?.filter((item) => item.role !== "system").length;

  return (
    <Stack
      flexGrow={1}
      gap="1px"
      paddingInlineStart={2}
      className={styles.title}
    >
      <Heading data-testid="HeaderTitle" textStyle="lg">
        {title}
      </Heading>
      <Text textStyle="xs">{t("count_messages", { count })}</Text>
    </Stack>
  );
}

interface ModelOptionsGroupProps {
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
}

function ModelOptionsGroup({ openai, setOptions }: ModelOptionsGroupProps) {
  const { t } = useTranslation();

  return (
    <Menu.RadioItemGroup
      value={openai.model}
      onValueChange={(event) => {
        setOptions({
          type: OptionActionType.OPENAI,
          data: { ...openai, model: event.value },
        });
      }}
    >
      <Menu.ItemGroupLabel>{t("model_options")}</Menu.ItemGroupLabel>
      {modelOptions.map((item) => (
        <Menu.RadioItem key={item.value} value={item.value}>
          {item.label}
          <Menu.ItemIndicator />
        </Menu.RadioItem>
      ))}
    </Menu.RadioItemGroup>
  );
}

interface ToolOptionsGroupProps {
  onToolChange: React.Dispatch<ToolChangeRequest>;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

function ToolOptionsGroup({
  onToolChange,
  tools,
  toolsEnabled,
}: ToolOptionsGroupProps) {
  const { t } = useTranslation();

  return (
    <Menu.ItemGroup>
      <Menu.ItemGroupLabel>{t("tool_options")}</Menu.ItemGroupLabel>
      {Array.from(tools.entries()).map(([key, value]) => (
        <Menu.CheckboxItem
          key={key}
          value={value.type === "mcp" ? value.server_label : value.type}
          checked={toolsEnabled.has(key)}
          onCheckedChange={(event) => {
            onToolChange({ key, tool: value, checkedChange: event });
          }}
        >
          <Menu.ItemIndicator />
          {key}
        </Menu.CheckboxItem>
      ))}
    </Menu.ItemGroup>
  );
}

interface McpServicesMenuProps {
  mcpTools: McpToolMap;
  onEditMcp: VoidFunction;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  toolsEnabled: Set<string>;
}

function McpServicesMenu({
  mcpTools,
  onEditMcp,
  onToolChange,
  toolsEnabled,
}: McpServicesMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root positioning={{ placement: "right-start", gutter: 2 }}>
      <Menu.TriggerItem data-testid="mcp-services-menu-trigger">
        {t("MCP Services")} <LuChevronRight />
      </Menu.TriggerItem>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            {Array.from(mcpTools.entries()).map(([key, tool]) => (
              <Menu.CheckboxItem
                key={tool.server_label}
                value={key}
                checked={toolsEnabled.has(key)}
                onCheckedChange={(event) => {
                  onToolChange({ key, tool, checkedChange: event });
                }}
              >
                <Menu.ItemIndicator />
                {tool.title || key}
              </Menu.CheckboxItem>
            ))}
            <Menu.Item
              value="edit_mcp_services"
              onClick={onEditMcp}
              data-testid="mcp-add-remove-services"
            >
              {t("Add/Remove MCP Services")}
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}

interface McpServiceFormFieldsProps {
  approvalOptions: ApprovalOptions;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

interface McpTextFieldProps {
  field: McpTextFieldName;
  form: McpToolFormState;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  type?: string;
}

function getTextFieldValue(
  form: McpToolFormState,
  field: McpTextFieldName
): string {
  switch (field) {
    case "label":
      return form.label;
    case "server_url":
      return form.server_url;
    case "allowed_tools_input":
      return form.allowed_tools_input;
    default:
      return "";
  }
}

function McpTextField({
  field,
  form,
  id,
  label,
  placeholder,
  required,
  setForm,
  type,
}: McpTextFieldProps) {
  return (
    <Field.Root>
      <Field.Label htmlFor={id}>{label}</Field.Label>
      <Input
        id={id}
        name={id}
        type={type}
        required={required}
        className={styles.input}
        placeholder={placeholder}
        value={getTextFieldValue(form, field)}
        onChange={(event) => {
          updateFormField(setForm, field, event.target.value);
        }}
      />
    </Field.Root>
  );
}

interface McpApprovalFieldProps {
  approvalOptions: ApprovalOptions;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

function McpApprovalField({
  approvalOptions,
  contentRef,
  form,
  setForm,
}: McpApprovalFieldProps) {
  const { t } = useTranslation();

  return (
    <Field.Root>
      <Select.Root
        data-testid="mcp-require-approval-select"
        collection={approvalOptions}
        size="sm"
        width="320px"
        value={[form.require_approval]}
        onValueChange={(event) => {
          updateFormField(setForm, "require_approval", event.value[0]);
        }}
      >
        <Select.HiddenSelect />
        <Select.Label>{t("Require Approval")}</Select.Label>
        <Select.Control>
          <Select.Trigger data-testid="mcp-require-approval-trigger">
            <Select.ValueText placeholder="Select" />
          </Select.Trigger>
          <Select.IndicatorGroup>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal container={contentRef}>
          <Select.Positioner>
            <Select.Content>
              {approvalOptions.items.map((item) => (
                <Select.Item item={item} key={item.value}>
                  {item.label}
                  <Select.ItemIndicator />
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </Field.Root>
  );
}

function McpServiceFormFields({
  approvalOptions,
  contentRef,
  form,
  setForm,
}: McpServiceFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <Stack gap={4}>
      <McpTextField
        field="label"
        form={form}
        id="label"
        label={t("Label")}
        required
        setForm={setForm}
      />
      <McpTextField
        field="server_url"
        form={form}
        id="server_url"
        label={t("Server URL")}
        required
        setForm={setForm}
        type="url"
      />
      <McpApprovalField
        approvalOptions={approvalOptions}
        contentRef={contentRef}
        form={form}
        setForm={setForm}
      />
      <McpTextField
        field="allowed_tools_input"
        form={form}
        id="allowed_tools"
        label={t("Allowed Tools")}
        placeholder={t("Comma separated")}
        setForm={setForm}
      />
    </Stack>
  );
}

interface McpServiceRowProps {
  checked: boolean;
  onDelete: VoidFunction;
  onEdit: VoidFunction;
  onToggle: React.Dispatch<CheckedChange>;
  tool: Tool.Mcp;
  toolKey: string;
}

function McpServiceRow({
  checked,
  onDelete,
  onEdit,
  onToggle,
  tool,
  toolKey,
}: McpServiceRowProps) {
  return (
    <HStack justifyContent="space-between" alignItems="center">
      <HStack>
        <Checkbox.Root
          size="sm"
          variant="outline"
          checked={checked}
          onCheckedChange={onToggle}
        >
          <Checkbox.HiddenInput />
          <Checkbox.Control />
        </Checkbox.Root>
        <Text>{tool.title || toolKey}</Text>
      </HStack>
      <HStack gap={1} alignItems="center">
        <Button
          data-testid={`mcp-edit-${toolKey}`}
          variant="ghost"
          size="sm"
          onClick={onEdit}
        >
          <MdEdit />
        </Button>
        <Button
          data-testid={`mcp-delete-${toolKey}`}
          variant="ghost"
          size="sm"
          onClick={onDelete}
        >
          <MdDelete />
        </Button>
      </HStack>
    </HStack>
  );
}

interface McpServicesListProps {
  mcpTools: McpToolMap;
  onDeleteTool: React.Dispatch<string>;
  onEditTool: React.Dispatch<EditToolRequest>;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  toolsEnabled: Set<string>;
}

function McpServicesList({
  mcpTools,
  onDeleteTool,
  onEditTool,
  onToolChange,
  toolsEnabled,
}: McpServicesListProps) {
  const { t } = useTranslation();

  return (
    <Stack
      padding={2}
      gap={2}
      as="form"
      onSubmit={(event) => event.preventDefault()}
    >
      <Text fontWeight="bold">{t("MCP Services")}</Text>
      <Stack padding={2} gap={2} className={styles.mcpServices}>
        {Array.from(mcpTools.entries()).map(([key, tool]) => (
          <McpServiceRow
            key={key}
            toolKey={key}
            tool={tool}
            checked={toolsEnabled.has(key)}
            onEdit={() => {
              onEditTool({ key, tool });
            }}
            onDelete={() => {
              onDeleteTool(key);
            }}
            onToggle={(checkedChange) => {
              onToolChange({ key, tool, checkedChange });
            }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

interface McpServicesDialogProps {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  mcpTools: McpToolMap;
  onDeleteTool: React.Dispatch<string>;
  onEditTool: React.Dispatch<EditToolRequest>;
  onOpenChange: React.Dispatch<boolean>;
  onSave: VoidFunction;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  open: boolean;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  toolsEnabled: Set<string>;
  user: Record<string, unknown> | null;
}

interface McpServicesDialogBodyProps {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  mcpTools: McpToolMap;
  onDeleteTool: React.Dispatch<string>;
  onEditTool: React.Dispatch<EditToolRequest>;
  onSave: VoidFunction;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  toolsEnabled: Set<string>;
  user: Record<string, unknown> | null;
}

function McpServicesDialogBody(props: McpServicesDialogBodyProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Body overflowY="auto">
      <Stack gap={4}>
        <McpServiceFormFields
          approvalOptions={props.approvalOptions}
          contentRef={props.contentRef}
          form={props.form}
          setForm={props.setForm}
        />
        <McpAuthFields
          config={props.form.authConfig}
          onChange={(authConfig) => {
            updateFormField(props.setForm, "authConfig", authConfig);
          }}
          user={props.user}
        />
        {props.authorizationIncomplete && (
          <Text fontSize="sm" color="orange.600">
            {t("mcp_authorization_required_before_save")}
          </Text>
        )}
        <Button
          data-testid="mcp-add-service-btn"
          onClick={props.onSave}
          colorPalette="blue"
        >
          {t("Add/Save Service")}
        </Button>
      </Stack>

      <Separator marginBlockStart={4} marginBlockEnd={4} />

      <McpServicesList
        mcpTools={props.mcpTools}
        onDeleteTool={props.onDeleteTool}
        onEditTool={props.onEditTool}
        onToolChange={props.onToolChange}
        toolsEnabled={props.toolsEnabled}
      />
    </Dialog.Body>
  );
}

function McpServicesDialog(props: McpServicesDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog.Root
      data-testid="mcp-services-dialog"
      open={props.open}
      onOpenChange={(event) => {
        props.onOpenChange(event.open);
      }}
      lazyMount
      size="cover"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content ref={props.contentRef}>
            <Dialog.Header>
              <Dialog.Title>{t("Edit MCP Services")}</Dialog.Title>
            </Dialog.Header>
            <McpServicesDialogBody
              approvalOptions={props.approvalOptions}
              authorizationIncomplete={props.authorizationIncomplete}
              contentRef={props.contentRef}
              form={props.form}
              mcpTools={props.mcpTools}
              onDeleteTool={props.onDeleteTool}
              onEditTool={props.onEditTool}
              onSave={props.onSave}
              onToolChange={props.onToolChange}
              setForm={props.setForm}
              toolsEnabled={props.toolsEnabled}
              user={props.user}
            />
            <Dialog.Footer />
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

interface ChatOptionsMenuProps {
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  user: Record<string, unknown> | null;
}

interface ChatOptionsMenuStateArgs extends ChatOptionsMenuProps {
  t: TFunction;
}

interface ChatOptionsMenuState {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  dialogOpen: boolean;
  form: McpToolFormState;
  handleDeleteTool: React.Dispatch<string>;
  handleEditTool: React.Dispatch<EditToolRequest>;
  handleOpenMcp: VoidFunction;
  handleSave: VoidFunction;
  handleToolChange: React.Dispatch<ToolChangeRequest>;
  mcpTools: McpToolMap;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

interface ChatOptionsMenuCollections {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  mcpTools: McpToolMap;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

interface ChatOptionsMenuHandlers {
  handleDeleteTool: React.Dispatch<string>;
  handleEditTool: React.Dispatch<EditToolRequest>;
  handleOpenMcp: VoidFunction;
  handleSave: VoidFunction;
  handleToolChange: React.Dispatch<ToolChangeRequest>;
}

interface ChatOptionsMenuHandlersArgs extends ChatOptionsMenuCollections {
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: ReturnType<typeof useMcpAuth>["getAuthorization"];
  openai: OpenAIOptions;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}

interface ChatOptionsMenuStateBuilderArgs {
  collections: ChatOptionsMenuCollections;
  contentRef: React.RefObject<HTMLDivElement | null>;
  dialogOpen: boolean;
  form: McpToolFormState;
  handlers: ChatOptionsMenuHandlers;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

interface ChatOptionsMenuContentProps {
  mcpTools: McpToolMap;
  onEditMcp: VoidFunction;
  onToolChange: React.Dispatch<ToolChangeRequest>;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

function ChatOptionsMenuContent({
  mcpTools,
  onEditMcp,
  onToolChange,
  openai,
  setOptions,
  tools,
  toolsEnabled,
}: ChatOptionsMenuContentProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton
          variant="ghost"
          title={t("chat_options")}
          data-testid="chat-options-btn"
        >
          <CgOptions aria-label={t("chat_options")} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <ModelOptionsGroup openai={openai} setOptions={setOptions} />
          <ToolOptionsGroup
            tools={tools}
            toolsEnabled={toolsEnabled}
            onToolChange={onToolChange}
          />
          <McpServicesMenu
            mcpTools={mcpTools}
            toolsEnabled={toolsEnabled}
            onEditMcp={onEditMcp}
            onToolChange={onToolChange}
          />
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

function getChatOptionsMenuCollections(args: {
  form: McpToolFormState;
  openai: OpenAIOptions;
  setOptions: GlobalActions["setOptions"];
  t: TFunction;
}): ChatOptionsMenuCollections {
  const tools = getNormalizedTools(args.openai, args.setOptions);
  const { toolsEnabled, mcpAuthConfigs } = ensureToolCollections(args.openai);

  return {
    approvalOptions: getApprovalOptions(args.t),
    authorizationIncomplete: isMcpAuthorizationIncomplete(args.form.authConfig),
    mcpAuthConfigs,
    mcpTools: buildMcpTools(tools),
    tools,
    toolsEnabled,
  };
}

function createChatOptionsMenuHandlers(
  args: ChatOptionsMenuHandlersArgs
): ChatOptionsMenuHandlers {
  const handleEditTool = createEditToolHandler({
    mcpAuthConfigs: args.mcpAuthConfigs,
    setDialogOpen: args.setDialogOpen,
    setEditingKey: args.setEditingKey,
    setForm: args.setForm,
  });
  const handleToolChange = createToolChangeHandler({
    mcpAuthConfigs: args.mcpAuthConfigs,
    onEditTool: handleEditTool,
    openai: args.openai,
    setOptions: args.setOptions,
    toolsEnabled: args.toolsEnabled,
  });

  return {
    handleDeleteTool: createDeleteMcpServiceHandler(args),
    handleEditTool,
    handleOpenMcp: createOpenMcpEditorHandler(args),
    handleSave: createSaveMcpServiceHandler(args),
    handleToolChange,
  };
}

function buildChatOptionsMenuState(
  args: ChatOptionsMenuStateBuilderArgs
): ChatOptionsMenuState {
  return {
    approvalOptions: args.collections.approvalOptions,
    authorizationIncomplete: args.collections.authorizationIncomplete,
    contentRef: args.contentRef,
    dialogOpen: args.dialogOpen,
    form: args.form,
    handleDeleteTool: args.handlers.handleDeleteTool,
    handleEditTool: args.handlers.handleEditTool,
    handleOpenMcp: args.handlers.handleOpenMcp,
    handleSave: args.handlers.handleSave,
    handleToolChange: args.handlers.handleToolChange,
    mcpTools: args.collections.mcpTools,
    setDialogOpen: args.setDialogOpen,
    setForm: args.setForm,
    tools: args.collections.tools,
    toolsEnabled: args.collections.toolsEnabled,
  };
}

function useChatOptionsMenuState({
  openai,
  setOptions,
  t,
  user,
}: ChatOptionsMenuStateArgs): ChatOptionsMenuState {
  const { getAuthorization } = useMcpAuth(user);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState(createEmptyMcpToolForm());
  const collections = getChatOptionsMenuCollections({
    form,
    openai,
    setOptions,
    t,
  });
  const handlers = createChatOptionsMenuHandlers({
    ...collections,
    editingKey,
    form,
    getAuthorization,
    openai,
    setEditingKey,
    setOptions,
    setDialogOpen,
    setForm,
    t,
  });

  return buildChatOptionsMenuState({
    collections,
    contentRef,
    dialogOpen,
    form,
    handlers,
    setDialogOpen,
    setForm,
  });
}

function ChatOptionsMenu({ openai, setOptions, user }: ChatOptionsMenuProps) {
  const { t } = useTranslation();
  const menuState = useChatOptionsMenuState({ openai, setOptions, t, user });

  return (
    <>
      <ChatOptionsMenuContent
        mcpTools={menuState.mcpTools}
        onEditMcp={menuState.handleOpenMcp}
        onToolChange={menuState.handleToolChange}
        openai={openai}
        setOptions={setOptions}
        tools={menuState.tools}
        toolsEnabled={menuState.toolsEnabled}
      />

      <McpServicesDialog
        approvalOptions={menuState.approvalOptions}
        authorizationIncomplete={menuState.authorizationIncomplete}
        contentRef={menuState.contentRef}
        form={menuState.form}
        mcpTools={menuState.mcpTools}
        onDeleteTool={menuState.handleDeleteTool}
        onEditTool={menuState.handleEditTool}
        onOpenChange={menuState.setDialogOpen}
        onSave={menuState.handleSave}
        onToolChange={menuState.handleToolChange}
        open={menuState.dialogOpen}
        setForm={menuState.setForm}
        toolsEnabled={menuState.toolsEnabled}
        user={user}
      />
    </>
  );
}

interface NewChatMenuProps {
  apps: App[];
  category: CategoryItem[];
  newChat: GlobalActions["newChat"];
}

function NewChatMenu({ apps, category, newChat }: NewChatMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton variant="ghost" title={t("new_chat")}>
          <RiChatNewLine aria-label={t("new_chat")} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.ItemGroup title={t("new_chat")}>
          {apps.map((app, index) => {
            const cat = category.find((item) => item.id == app.category);

            return (
              <Menu.Item
                key={app.id}
                onClick={() => {
                  newChat(app);
                }}
                value={String(app.id)}
                aria-keyshortcuts={index}
              >
                <span
                  className={classnames(styles.icon, `ico - ${cat?.icon} `)}
                ></span>{" "}
                {app.title}
              </Menu.Item>
            );
          })}
        </Menu.ItemGroup>
      </Menu.Content>
    </Menu.Root>
  );
}

interface AssistantSettingsButtonProps {
  mode: string;
  showSettings: GlobalActions["showSettings"];
}

function AssistantSettingsButton({
  mode,
  showSettings,
}: AssistantSettingsButtonProps) {
  const { t } = useTranslation();

  if (mode !== "assistant") {
    return null;
  }

  return (
    <IconButton
      variant="ghost"
      title={t("chat_settings")}
      onClick={showSettings}
    >
      <IoSettingsOutline />
    </IconButton>
  );
}

interface DownloadThreadMenuProps {
  downloadThread: GlobalActions["downloadThread"];
}

function DownloadThreadMenu({ downloadThread }: DownloadThreadMenuProps) {
  const { t } = useTranslation();

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton variant="ghost" title={t("download_thread")}>
          <MdOutlineSimCardDownload aria-label={t("download_thread")} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Content>
        <Menu.Item
          value="json"
          onClick={() => {
            downloadThread("json");
          }}
        >
          <BiSolidFileJson /> {t("download_json")}
        </Menu.Item>
        <Menu.Item
          value="markdown"
          onClick={() => {
            downloadThread("markdown");
          }}
        >
          <IoLogoMarkdown /> {t("download_markdown")}
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

interface UserInformationPopoverProps {
  user: { avatar?: string | null; email?: string; name?: string } | null;
}

function UserInformationPopover({ user }: UserInformationPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover.Root lazyMount>
      <Popover.Trigger data-testid="UserInformationBtn">
        <Avatar.Root size="sm">
          <Avatar.Fallback name={user?.name} />
          <Avatar.Image src={user?.avatar ?? undefined} />
        </Avatar.Root>
      </Popover.Trigger>
      <Popover.Positioner>
        <Popover.Content data-testid="UserInformation">
          <Popover.Arrow />
          <Popover.Body>
            <Popover.Title fontWeight="bold" paddingBlockEnd="15px">
              {t("User information")}
            </Popover.Title>
            <Stack gap={2}>
              <Text>{user?.name}</Text>
              <Text>{user?.email}</Text>
              <Button colorPalette="blue" onClick={logout}>
                Logout
              </Button>
            </Stack>
          </Popover.Body>
        </Popover.Content>
      </Popover.Positioner>
    </Popover.Root>
  );
}

export function MessageHeader() {
  const {
    is,
    setIs,
    setOptions,
    newChat,
    downloadThread,
    showSettings,
    options,
    user,
  } = useGlobal();
  const { message } = useMessage();
  const { apps, category } = useApps();

  return (
    <HStack
      as="header"
      padding={1}
      borderBottomWidth="1px"
      justifyContent="space-between"
      data-testid="ChatHeader"
    >
      <ToolbarToggleButton toolbar={is.toolbar} setIs={setIs} />
      <HeaderTitleBlock title={message?.title} messages={message?.messages} />
      <ChatOptionsMenu
        openai={options.openai}
        setOptions={setOptions}
        user={user}
      />
      <NewChatMenu apps={apps} category={category} newChat={newChat} />
      <MessageMenu />
      <AssistantSettingsButton
        mode={options.openai.mode}
        showSettings={showSettings}
      />
      <DownloadThreadMenu downloadThread={downloadThread} />
      <GitHubMenu />
      <UsageInformationDialog />
      <UserInformationPopover user={user} />
    </HStack>
  );
}
