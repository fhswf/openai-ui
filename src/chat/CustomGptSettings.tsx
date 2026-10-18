import React from "react";
import {
  Button,
  Card,
  Field,
  Heading,
  Input,
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
    <Stack gap="3" paddingBlockStart="2em">
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
