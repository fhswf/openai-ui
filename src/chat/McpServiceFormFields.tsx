import React from "react";
import { Field, Input, Portal, Select, Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import type {
  ApprovalOptions,
  McpTextFieldName,
  McpToolFormState,
} from "./utils/mcpServices";
import { updateFormField } from "./utils/mcpServices";
import { isValidMcpToolName } from "./utils/mcpToolName";
import styles from "./style/menu.module.less";

interface McpServiceFormFieldsProps {
  approvalOptions: ApprovalOptions;
  contentRef: React.RefObject<HTMLDivElement | null>;
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

interface McpTextFieldDefinition {
  errorText?: string;
  field: McpTextFieldName;
  helperText?: string;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

interface McpTextFieldProps {
  definition: McpTextFieldDefinition;
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
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

function McpTextField({ definition, form, setForm }: McpTextFieldProps) {
  return (
    <Field.Root invalid={Boolean(definition.errorText)}>
      <Field.Label htmlFor={definition.id}>{definition.label}</Field.Label>
      <Input
        id={definition.id}
        name={definition.id}
        type={definition.type}
        required={definition.required}
        className={styles.input}
        placeholder={definition.placeholder}
        value={getTextFieldValue(form, definition.field)}
        onChange={(event) => {
          updateFormField(setForm, definition.field, event.target.value);
        }}
      />
      {definition.helperText && !definition.errorText && (
        <Field.HelperText>{definition.helperText}</Field.HelperText>
      )}
      {definition.errorText && (
        <Field.ErrorText>{definition.errorText}</Field.ErrorText>
      )}
    </Field.Root>
  );
}

interface McpServiceIdentityFieldsProps {
  form: McpToolFormState;
  setForm: React.Dispatch<React.SetStateAction<McpToolFormState>>;
}

function McpServiceIdentityFields({
  form,
  setForm,
}: McpServiceIdentityFieldsProps) {
  const { t } = useTranslation();
  const serverLabelError =
    form.server_label && !isValidMcpToolName(form.server_label)
      ? t("mcp_invalid_tool_name")
      : undefined;
  const fields: McpTextFieldDefinition[] = [
    { field: "label", id: "label", label: t("Label"), required: true },
    {
      field: "server_label",
      id: "server_label",
      label: t("Server Label"),
      helperText: t("mcp_server_label_helper"),
      errorText: serverLabelError,
      required: true,
    },
    {
      field: "server_url",
      id: "server_url",
      label: t("Server URL"),
      required: true,
      type: "url",
    },
  ];

  return (
    <>
      {fields.map((definition) => (
        <McpTextField
          key={definition.field}
          definition={definition}
          form={form}
          setForm={setForm}
        />
      ))}
    </>
  );
}

function McpApprovalField({
  approvalOptions,
  contentRef,
  form,
  setForm,
}: McpServiceFormFieldsProps) {
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

function McpAllowedToolsField({ form, setForm }: McpServiceIdentityFieldsProps) {
  const { t } = useTranslation();

  return (
    <McpTextField
      definition={{
        field: "allowed_tools_input",
        id: "allowed_tools",
        label: t("Allowed Tools"),
        placeholder: t("Comma separated"),
      }}
      form={form}
      setForm={setForm}
    />
  );
}

export function McpServiceFormFields({
  approvalOptions,
  contentRef,
  form,
  setForm,
}: McpServiceFormFieldsProps) {
  return (
    <Stack gap={4}>
      <McpServiceIdentityFields form={form} setForm={setForm} />
      <McpApprovalField
        approvalOptions={approvalOptions}
        contentRef={contentRef}
        form={form}
        setForm={setForm}
      />
      <McpAllowedToolsField form={form} setForm={setForm} />
    </Stack>
  );
}
