import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CloseButton,
  Dialog,
  Portal,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { VectorStore } from "openai/resources/vector-stores/vector-stores.mjs";
import { useTranslation } from "react-i18next";
import { useGlobal } from "./context";
import { Options } from "./context/types";
import {
  RegistryUpdate,
  useFileSearchRegistry,
} from "./hooks/useFileSearchRegistry";
import { listVectorStores } from "./service/vectorStores";
import { showVectorStoreError } from "./vectorStoreDialogUtils";
import { CreateVectorStoreForm } from "./CreateVectorStoreForm";
import { VectorStoreRow } from "./VectorStoreRow";

function useVectorStores(options: Options, open: boolean) {
  const { t } = useTranslation();
  const [stores, setStores] = useState<VectorStore[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStores(await listVectorStores(options));
    } catch (error) {
      showVectorStoreError(t("vector_store_load_error"), error);
      setStores([]);
    }
  }, [options, t]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return { stores, refresh };
}

interface VectorStoresListProps {
  isInChat: (storeId: string) => boolean;
  onChanged: VoidFunction;
  onRegistryChange: React.Dispatch<RegistryUpdate>;
  options: Options;
  stores: VectorStore[] | null;
}

function VectorStoresList({
  isInChat,
  onChanged,
  onRegistryChange,
  options,
  stores,
}: VectorStoresListProps) {
  return (
    <Stack gap={1}>
      {stores?.map((store) => (
        <VectorStoreRow
          key={store.id}
          store={store}
          options={options}
          onChanged={onChanged}
          inChat={isInChat(store.id)}
          onRegistryChange={onRegistryChange}
        />
      ))}
    </Stack>
  );
}

function VectorStoresDialogBody({ open }: { open: boolean }) {
  const { t } = useTranslation();
  const { options: globalOptions } = useGlobal();
  const { updateRegistry, isInChat } = useFileSearchRegistry();
  const { apiKey, organizationId, vectorStoreBaseUrl } = globalOptions.openai;
  // Only reload when the connection settings change, not on every state update.
  const options = useMemo(
    () => globalOptions,
    [apiKey, organizationId, vectorStoreBaseUrl]
  );
  const { stores, refresh } = useVectorStores(options, open);
  const handleChanged = useCallback(() => void refresh(), [refresh]);

  return (
    <Dialog.Body
      overflowY="auto"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
    >
      <CreateVectorStoreForm options={options} onCreated={handleChanged} />
      <Separator marginBlock={4} />
      <Text fontWeight="bold" marginBlockEnd={2}>
        {t("vector_stores")}
      </Text>
      {stores === null && <Spinner />}
      {stores?.length === 0 && (
        <Text color="fg.muted">{t("vector_store_none")}</Text>
      )}
      <VectorStoresList
        stores={stores}
        options={options}
        onChanged={handleChanged}
        isInChat={isInChat}
        onRegistryChange={updateRegistry}
      />
    </Dialog.Body>
  );
}

interface VectorStoresDialogProps {
  onOpenChange: React.Dispatch<boolean>;
  open: boolean;
}

export function VectorStoresDialog({
  onOpenChange,
  open,
}: VectorStoresDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root
      data-testid="vector-stores-dialog"
      open={open}
      onOpenChange={(event) => onOpenChange(event.open)}
      lazyMount
      size="cover"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{t("vector_stores_manage")}</Dialog.Title>
            </Dialog.Header>
            <VectorStoresDialogBody open={open} />
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
