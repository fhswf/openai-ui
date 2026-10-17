import React from "react";
import {
  Alert,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  HStack,
  Portal,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { MdDelete, MdEdit } from "react-icons/md";
import { McpAuthFields } from "./McpAuthFields";
import { McpServiceFormFields } from "./McpServiceFormFields";
import type {
  ApprovalOptions,
  CheckedChange,
  EditToolRequest,
  McpToolFormState,
  McpToolMap,
  ToolChangeRequest,
} from "./utils/mcpServices";
import { updateFormField } from "./utils/mcpServices";
import styles from "./style/menu.module.less";

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
            onEdit={() => onEditTool({ key, tool })}
            onDelete={() => onDeleteTool(key)}
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

interface McpServicesDialogBodyProps
  extends Omit<McpServicesDialogProps, "onOpenChange" | "open"> {}

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
            <McpServicesDialogBody {...props} />
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
