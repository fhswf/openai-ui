import React from "react";
import type { Tool } from "openai/resources/responses/responses.mjs";
import {
  Alert,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Field,
  HStack,
  Input,
  Menu,
  Portal,
  Select,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { LuChevronRight } from "react-icons/lu";
import { MdDelete, MdEdit } from "react-icons/md";
import { McpAuthFields } from "./McpAuthFields";
import {
  ApprovalOptions,
  CheckedChange,
  EditToolRequest,
  McpTextFieldName,
  McpToolFormState,
  McpToolMap,
  ToolChangeRequest,
  updateFormField,
} from "./utils/mcpServices";
import { isValidMcpToolName } from "./utils/mcpToolName";
import styles from "./style/menu.module.less";

interface ToolOptionsGroupProps {
  onToolChange: React.Dispatch<ToolChangeRequest>;
  tools: Map<string, Tool>;
  toolsEnabled: Set<string>;
}

export function ToolOptionsGroup({
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
          value={value.type === "mcp" ? key : value.type}
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

export function McpServicesMenu({
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
                key={key}
                value={key}
                checked={toolsEnabled.has(key)}
                onCheckedChange={(event) => {
                  onToolChange({ key, tool, checkedChange: event });
                }}
              >
                <Menu.ItemIndicator />
                {key}
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
  errorText?: string;
  field: McpTextFieldName;
  form: McpToolFormState;
  helperText?: string;
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
    case "server_label":
      return form.server_label;
    case "server_url":
      return form.server_url;
    case "allowed_tools_input":
      return form.allowed_tools_input;
    default:
      return "";
  }
}

function McpTextField({
  errorText,
  field,
  form,
  helperText,
  id,
  label,
  placeholder,
  required,
  setForm,
  type,
}: McpTextFieldProps) {
  return (
    <Field.Root invalid={Boolean(errorText)}>
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
      {helperText && !errorText && (
        <Field.HelperText>{helperText}</Field.HelperText>
      )}
      {errorText && <Field.ErrorText>{errorText}</Field.ErrorText>}
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
  const serverLabelError =
    form.server_label && !isValidMcpToolName(form.server_label)
      ? t("mcp_invalid_tool_name")
      : undefined;

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
        errorText={serverLabelError}
        field="server_label"
        form={form}
        id="server_label"
        label={t("Server Label")}
        helperText={t("mcp_server_label_helper")}
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
  toolKey: string;
}

function McpServiceRow({
  checked,
  onDelete,
  onEdit,
  onToggle,
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
        <Text>{toolKey}</Text>
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

export interface McpServicesDialogProps {
  approvalOptions: ApprovalOptions;
  authorizationIncomplete: boolean;
  consentPromptOpen: boolean;
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
  consentPromptOpen: boolean;
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
        {props.consentPromptOpen && (
          <Alert.Root status="info" variant="subtle" size="sm">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description fontSize="sm">
                {t("mcp_consent_prompt_info")}
              </Alert.Description>
            </Alert.Content>
          </Alert.Root>
        )}
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
          serverUrl={props.form.server_url}
          user={props.user}
        />
        {props.authorizationIncomplete && (
          <Text fontSize="sm" color="orange.600">
            {t("mcp_save_without_consent_info")}
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

export function McpServicesDialog(props: McpServicesDialogProps) {
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
              consentPromptOpen={props.consentPromptOpen}
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
