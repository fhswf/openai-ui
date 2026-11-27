import React from "react";
import {
  Button,
  Card,
  Field,
  Heading,
  Input,
  NativeSelect,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { v7 as uuidv7 } from "uuid";
import { useTranslation } from "react-i18next";
import { MdAdd, MdDeleteOutline } from "react-icons/md";
import { Switch } from "../components/ui/switch";
import { useGlobal } from "./context";
import { useOptions } from "./hooks";
import type { CustomGpt } from "./context/types";
import {
  getModelOptions,
  reasoningEfforts,
  supportsReasoningEffort,
} from "./utils/options";

type CustomGptCardProps = {
  customGpt: CustomGpt;
  updateCustomGpt: (id: string, update: Partial<CustomGpt>) => void;
  removeCustomGpt: (id: string) => void;
};

type CustomGptFieldProps = Pick<
  CustomGptCardProps,
  "customGpt" | "updateCustomGpt"
>;

function CustomGptNameField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("custom_gpt_name")}</Field.Label>
      <Input
        value={customGpt.name}
        onChange={(event) =>
          updateCustomGpt(customGpt.id, { name: event.target.value })
        }
      />
    </Field.Root>
  );
}

function CustomGptPromptField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("custom_gpt_system_prompt")}</Field.Label>
      <Textarea
        minH="10rem"
        resize="vertical"
        value={customGpt.systemPrompt}
        onChange={(event) =>
          updateCustomGpt(customGpt.id, {
            systemPrompt: event.target.value,
          })
        }
      />
      <Field.HelperText>{t("custom_gpt_system_prompt_help")}</Field.HelperText>
    </Field.Root>
  );
}

function CustomGptModelField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  const { options } = useGlobal();
  return (
    <Field.Root>
      <Field.Label>{t("custom_gpt_model")}</Field.Label>
      <NativeSelect.Root>
        <NativeSelect.Field
          value={customGpt.model ?? ""}
          onChange={(event) =>
            updateCustomGpt(customGpt.id, {
              model: event.target.value || undefined,
            })
          }
        >
          <option value="">
            {t("custom_gpt_use_global", { value: options.openai.model })}
          </option>
          {getModelOptions(options.openai).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
      <Field.HelperText>{t("custom_gpt_model_help")}</Field.HelperText>
    </Field.Root>
  );
}

function CustomGptReasoningField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  const { options } = useGlobal();
  const model = customGpt.model || options.openai.model;
  if (!supportsReasoningEffort(model)) {
    return null;
  }
  return (
    <Field.Root>
      <Field.Label>{t("custom_gpt_reasoning_effort")}</Field.Label>
      <NativeSelect.Root>
        <NativeSelect.Field
          value={customGpt.reasoningEffort ?? ""}
          onChange={(event) =>
            updateCustomGpt(customGpt.id, {
              reasoningEffort: (event.target.value || undefined) as
                | CustomGpt["reasoningEffort"]
                | undefined,
            })
          }
        >
          <option value="">
            {t("custom_gpt_use_global", {
              value: t("reasoning_effort_" + options.openai.reasoningEffort),
            })}
          </option>
          {reasoningEfforts.map((effort) => (
            <option key={effort} value={effort}>
              {t("reasoning_effort_" + effort)}
            </option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  );
}

function CustomGptSharePurposeField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("custom_gpt_share_purpose")}</Field.Label>
      <Textarea
        resize="vertical"
        value={customGpt.sharePurpose ?? ""}
        onChange={(event) =>
          updateCustomGpt(customGpt.id, { sharePurpose: event.target.value })
        }
      />
      <Field.HelperText>
        {t("custom_gpt_share_purpose_help")}
      </Field.HelperText>
    </Field.Root>
  );
}

function CustomGptShareTitleField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Field.Label>{t("custom_gpt_share_title")}</Field.Label>
      <Input
        value={customGpt.shareTitle ?? ""}
        onChange={(event) =>
          updateCustomGpt(customGpt.id, { shareTitle: event.target.value })
        }
      />
      <Field.HelperText>{t("custom_gpt_share_title_help")}</Field.HelperText>
    </Field.Root>
  );
}

function CustomGptBotStartsField({
  customGpt,
  updateCustomGpt,
}: CustomGptFieldProps) {
  const { t } = useTranslation();
  return (
    <Field.Root>
      <Switch
        checked={customGpt.botStarts ?? false}
        onChange={(event) =>
          updateCustomGpt(customGpt.id, {
            botStarts: event.target.checked,
          })
        }
      >
        {t("custom_gpt_bot_starts")}
      </Switch>
      <Field.HelperText>{t("custom_gpt_bot_starts_help")}</Field.HelperText>
    </Field.Root>
  );
}

function CustomGptCard({
  customGpt,
  updateCustomGpt,
  removeCustomGpt,
}: CustomGptCardProps) {
  const { t } = useTranslation();
  return (
    <Card.Root variant="outline">
      <Card.Body>
        <Stack gap="4">
          <CustomGptNameField {...{ customGpt, updateCustomGpt }} />
          <CustomGptPromptField {...{ customGpt, updateCustomGpt }} />
          <CustomGptModelField {...{ customGpt, updateCustomGpt }} />
          <CustomGptReasoningField {...{ customGpt, updateCustomGpt }} />
          <CustomGptSharePurposeField {...{ customGpt, updateCustomGpt }} />
          <CustomGptShareTitleField {...{ customGpt, updateCustomGpt }} />
          <CustomGptBotStartsField {...{ customGpt, updateCustomGpt }} />
          <Button
            alignSelf="flex-end"
            variant="outline"
            colorPalette="red"
            onClick={() => removeCustomGpt(customGpt.id)}
          >
            <MdDeleteOutline /> {t("custom_gpt_delete")}
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
}

export function CustomGptSettings() {
  const { options } = useGlobal();
  const { setGeneral } = useOptions();
  const { t } = useTranslation();
  const customGpts = Array.isArray(options.general.customGpts)
    ? options.general.customGpts
    : [];

  const updateCustomGpt = (id: string, update: Partial<CustomGpt>) => {
    setGeneral({
      customGpts: customGpts.map((customGpt) =>
        customGpt.id === id ? { ...customGpt, ...update } : customGpt
      ),
    });
  };

  const addCustomGpt = () => {
    setGeneral({
      customGpts: [
        ...customGpts,
        {
          id: uuidv7(),
          name: t("custom_gpt_default_name"),
          systemPrompt: "",
          sharePurpose: "",
          shareTitle: "",
        },
      ],
    });
  };

  const removeCustomGpt = (id: string) => {
    setGeneral({
      customGpts: customGpts.filter((customGpt) => customGpt.id !== id),
    });
  };

  return (
    <Stack gap="3" paddingBlockStart="2em" data-tour="custom-gpt-settings">
      <Heading size="md">{t("custom_gpts")}</Heading>
      <Text>{t("custom_gpts_help")}</Text>

      {customGpts.map((customGpt) => (
        <CustomGptCard
          key={customGpt.id}
          customGpt={customGpt}
          updateCustomGpt={updateCustomGpt}
          removeCustomGpt={removeCustomGpt}
        />
      ))}

      <Button variant="outline" alignSelf="flex-start" onClick={addCustomGpt}>
        <MdAdd /> {t("custom_gpt_add")}
      </Button>
    </Stack>
  );
}
