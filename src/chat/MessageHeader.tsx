import React, { useRef, useState } from "react";
import type { TFunction } from "i18next";
import {
  Tool,
  App,
  OptionActionType,
  McpAuthConfig,
  OpenAIOptions,
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

type SetOptionsAction = {
  type: OptionActionType;
  data: Partial<OpenAIOptions>;
};

type CategoryItem = {
  id: number;
  icon: string;
};

type McpToolMap = Record<string, Tool.Mcp>;

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
  setOptions: (action: SetOptionsAction) => void
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
  const mcpTools: McpToolMap = {};

  for (const [key, value] of tools) {
    if (isMcpTool(value)) {
      mcpTools[key] = value;
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
  setForm((current) => ({ ...current, [field]: value }));
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
  onEditTool: (key: string, tool: Tool.Mcp) => void;
  openai: OpenAIOptions;
  setOptions: (action: SetOptionsAction) => void;
  tool: Tool;
  toolsEnabled: Set<string>;
}): void {
  const checked = getCheckedValue(args.checkedChange);

  if (
    checked &&
    isMcpTool(args.tool) &&
    isMcpAuthorizationIncomplete(args.mcpAuthConfigs.get(args.key))
  ) {
    args.onEditTool(args.key, args.tool);
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
  getAuthorization: (
    config: McpAuthConfig,
    serverUrl: string
  ) => Promise<string | undefined>;
  serverUrl: string;
  t: TFunction;
}): Promise<{ authorization?: string; ok: boolean }> {
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

function createMcpToolDefinition(
  form: McpToolFormState,
  authorization?: string
): Tool.Mcp {
  const tool: Tool.Mcp = {
    type: "mcp",
    server_label: form.label,
    server_url: form.server_url,
    require_approval: form.require_approval,
  };

  if (authorization) {
    tool.authorization = authorization;
  }

  const allowedTools = getAllowedTools(form.allowed_tools_input);
  if (allowedTools.length > 0) {
    tool.allowed_tools = allowedTools;
  }

  return tool;
}

async function saveMcpService(args: {
  editingKey: string | null;
  form: McpToolFormState;
  getAuthorization: (
    config: McpAuthConfig,
    serverUrl: string
  ) => Promise<string | undefined>;
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  openai: OpenAIOptions;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setOptions: (action: SetOptionsAction) => void;
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
  setOptions: (action: SetOptionsAction) => void;
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
  setOptions: (action: SetOptionsAction) => void;
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
  globalThis.location.href = import.meta.env.VITE_LOGOUT_URL || "/";
}

function createEditToolHandler(args: {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingKey: React.Dispatch<React.SetStateAction<string | null>>;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}) {
  return (key: string, tool: Tool.Mcp) =>
    openEditMcpEditor(
      key,
      tool,
      args.mcpAuthConfigs,
      args.setEditingKey,
      args.setForm,
      args.setDialogOpen
    );
}

function createToolChangeHandler(args: {
  mcpAuthConfigs: Map<string, McpAuthConfig>;
  onEditTool: (key: string, tool: Tool.Mcp) => void;
  openai: OpenAIOptions;
  setOptions: (action: SetOptionsAction) => void;
  toolsEnabled: Set<string>;
}) {
  return (key: string, tool: Tool, checkedChange: CheckedChange) =>
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
}

type ToolbarToggleButtonProps = {
  setIs: (value: { toolbar: boolean }) => void;
  toolbar: boolean;
};

function ToolbarToggleButton({ setIs, toolbar }: ToolbarToggleButtonProps) {
  const { t } = useTranslation();

  return (
    <IconButton
      hideFrom="md"
      variant="ghost"
      title={toolbar ? t("hide_toolbar") : t("show_toolbar")}
      onClick={() => setIs({ toolbar: !toolbar })}
    >
      {toolbar ? <LuPanelLeftClose /> : <LuPanelLeftOpen />}
    </IconButton>
  );
}

type HeaderTitleBlockProps = {
  messages?: Array<{ role: string }>;
  title?: string;
};

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

type ModelOptionsGroupProps = {
  openai: OpenAIOptions;
  setOptions: (action: SetOptionsAction) => void;
};

function ModelOptionsGroup({ openai, setOptions }: ModelOptionsGroupProps) {
  const { t } = useTranslation();

  return (
    <Menu.RadioItemGroup
      value={openai.model}
      onValueChange={(event) =>
        setOptions({
          type: OptionActionType.OPENAI,
          data: { ...openai, model: event.value },
        })
      }
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

type ToolOptionsGroupProps = {
  onToolChange: (key: string, tool: Tool, checkedChange: CheckedChange) => void;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
};

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
          onCheckedChange={(event) => onToolChange(key, value, event)}
        >
          <Menu.ItemIndicator />
          {key}
        </Menu.CheckboxItem>
      ))}
    </Menu.ItemGroup>
  );
}

type McpServicesMenuProps = {
  mcpTools: McpToolMap;
  onEditMcp: () => void;
  onToolChange: (key: string, tool: Tool, checkedChange: CheckedChange) => void;
  toolsEnabled: Set<string>;
};

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
            {Object.entries(mcpTools).map(([key, tool]) => (
              <Menu.CheckboxItem
                key={tool.server_label}
                value={key}
                checked={toolsEnabled.has(key)}
                onCheckedChange={(event) => onToolChange(key, tool, event)}
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

type McpServiceFormFieldsProps = {
  approvalOptions: any;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
};

type McpTextFieldProps = {
  field: keyof McpToolFormState;
  form: McpToolFormState;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  type?: string;
};

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
        value={String(form[field] ?? "")}
        onChange={(event) =>
          updateFormField(setForm, field, event.target.value)
        }
      />
    </Field.Root>
  );
}

type McpApprovalFieldProps = {
  approvalOptions: any;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
};

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
        onValueChange={(event) =>
          updateFormField(setForm, "require_approval", event.value[0])
        }
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

type McpServiceRowProps = {
  checked: boolean;
  onDelete: () => void;
  onEdit: () => void;
  onToggle: (checkedChange: CheckedChange) => void;
  tool: Tool.Mcp;
  toolKey: string;
};

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

type McpServicesListProps = {
  mcpTools: McpToolMap;
  onDeleteTool: (key: string) => void;
  onEditTool: (key: string, tool: Tool.Mcp) => void;
  onToolChange: (key: string, tool: Tool, checkedChange: CheckedChange) => void;
  toolsEnabled: Set<string>;
};

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
        {Object.entries(mcpTools).map(([key, tool]) => (
          <McpServiceRow
            key={key}
            toolKey={key}
            tool={tool}
            checked={toolsEnabled.has(key)}
            onEdit={() => onEditTool(key, tool)}
            onDelete={() => onDeleteTool(key)}
            onToggle={(checkedChange) => onToolChange(key, tool, checkedChange)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

type McpServicesDialogProps = {
  approvalOptions: any;
  authorizationIncomplete: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  mcpTools: McpToolMap;
  onDeleteTool: (key: string) => void;
  onEditTool: (key: string, tool: Tool.Mcp) => void;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onToolChange: (key: string, tool: Tool, checkedChange: CheckedChange) => void;
  open: boolean;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  toolsEnabled: Set<string>;
  user: Record<string, unknown> | null;
};

type McpServicesDialogBodyProps = {
  approvalOptions: any;
  authorizationIncomplete: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  mcpTools: McpToolMap;
  onDeleteTool: (key: string) => void;
  onEditTool: (key: string, tool: Tool.Mcp) => void;
  onSave: () => void;
  onToolChange: (key: string, tool: Tool, checkedChange: CheckedChange) => void;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
  toolsEnabled: Set<string>;
  user: Record<string, unknown> | null;
};

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
          onChange={(authConfig) =>
            updateFormField(props.setForm, "authConfig", authConfig)
          }
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
      onOpenChange={(event) => props.onOpenChange(event.open)}
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

type ChatOptionsMenuProps = {
  openai: OpenAIOptions;
  setOptions: (action: SetOptionsAction) => void;
  user: Record<string, unknown> | null;
};

type ChatOptionsMenuContentProps = {
  mcpTools: McpToolMap;
  onEditMcp: () => void;
  onToolChange: (key: string, tool: Tool, checkedChange: CheckedChange) => void;
  openai: OpenAIOptions;
  setOptions: (action: SetOptionsAction) => void;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
};

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

function ChatOptionsMenu({ openai, setOptions, user }: ChatOptionsMenuProps) {
  const { t } = useTranslation();
  const { getAuthorization } = useMcpAuth(user);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState(createEmptyMcpToolForm());
  const tools = getNormalizedTools(openai, setOptions);
  const { toolsEnabled, mcpAuthConfigs } = ensureToolCollections(openai);
  const mcpTools = buildMcpTools(tools);
  const approvalOptions = getApprovalOptions(t);
  const authorizationIncomplete = isMcpAuthorizationIncomplete(form.authConfig);
  const handleEditTool = createEditToolHandler({
    mcpAuthConfigs,
    setDialogOpen,
    setEditingKey,
    setForm,
  });
  const handleToolChange = createToolChangeHandler({
    mcpAuthConfigs,
    onEditTool: handleEditTool,
    openai,
    setOptions,
    toolsEnabled,
  });

  return (
    <>
      <ChatOptionsMenuContent
        mcpTools={mcpTools}
        onEditMcp={() =>
          openCreateMcpEditor(setEditingKey, setForm, setDialogOpen)
        }
        onToolChange={handleToolChange}
        openai={openai}
        setOptions={setOptions}
        tools={tools}
        toolsEnabled={toolsEnabled}
      />

      <McpServicesDialog
        approvalOptions={approvalOptions}
        authorizationIncomplete={authorizationIncomplete}
        contentRef={contentRef}
        form={form}
        mcpTools={mcpTools}
        onDeleteTool={(key) =>
          deleteMcpService({
            key,
            mcpAuthConfigs,
            openai,
            setOptions,
            tools,
            toolsEnabled,
          })
        }
        onEditTool={handleEditTool}
        onOpenChange={setDialogOpen}
        onSave={() =>
          void saveMcpService({
            editingKey,
            form,
            getAuthorization,
            mcpAuthConfigs,
            openai,
            setEditingKey,
            setOptions,
            t,
            tools,
            toolsEnabled,
          })
        }
        onToolChange={handleToolChange}
        open={dialogOpen}
        setForm={setForm}
        toolsEnabled={toolsEnabled}
        user={user}
      />
    </>
  );
}

type NewChatMenuProps = {
  apps: App[];
  category: CategoryItem[];
  newChat: (app: App) => void;
};

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
                onClick={() => newChat(app)}
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

type AssistantSettingsButtonProps = {
  mode: string;
  showSettings: () => void;
};

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

type DownloadThreadMenuProps = {
  downloadThread: (format?: string) => void;
};

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
        <Menu.Item value="json" onClick={() => downloadThread("json")}>
          <BiSolidFileJson /> {t("download_json")}
        </Menu.Item>
        <Menu.Item value="markdown" onClick={() => downloadThread("markdown")}>
          <IoLogoMarkdown /> {t("download_markdown")}
        </Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}

type UserInformationPopoverProps = {
  user: { avatar?: string | null; email?: string; name?: string } | null;
};

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
