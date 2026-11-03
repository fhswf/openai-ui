import React, { useState } from "react";
import { Button, Field, HStack, Input, Stack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Options } from "./context/types";
import { createVectorStore } from "./service/vectorStores";
import { showVectorStoreError } from "./vectorStoreDialogUtils";

interface CreateVectorStoreFormProps {
  disabled?: boolean;
  onCreated: (store: { id: string; name: string }) => void;
  options: Options;
}

export function CreateVectorStoreForm({
  disabled = false,
  onCreated,
  options,
}: CreateVectorStoreFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const store = await createVectorStore(options, trimmed);
      setName("");
      onCreated({ id: store.id, name: store.name || trimmed });
    } catch (error) {
      showVectorStoreError(t("vector_store_create_error"), error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack
      as="form"
      gap={2}
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreate();
      }}
    >
      <Field.Root>
        <Field.Label>{t("vector_store_new")}</Field.Label>
        <HStack width="100%">
          <Input
            data-testid="vector-store-name-input"
            value={name}
            disabled={disabled}
            placeholder={t("vector_store_name_placeholder")}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            colorPalette="blue"
            loading={saving}
            disabled={disabled || !name.trim()}
            data-testid="vector-store-create-btn"
          >
            {t("vector_store_create")}
          </Button>
        </HStack>
        <Field.HelperText>{t("vector_store_help")}</Field.HelperText>
      </Field.Root>
    </Stack>
  );
}
