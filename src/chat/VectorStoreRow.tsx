import React, { useState } from "react";
import {
  Button,
  Checkbox,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { VectorStore } from "openai/resources/vector-stores/vector-stores.mjs";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import { MdCheck, MdClose, MdDelete, MdEdit } from "react-icons/md";
import { Options } from "./context/types";
import { RegistryUpdate } from "./hooks/useFileSearchRegistry";
import {
  deleteVectorStore,
  renameVectorStore,
} from "./service/vectorStores";
import {
  renameVectorStoreInChat,
  setVectorStoreInChat,
} from "./utils/fileSearch";
import { showVectorStoreError } from "./vectorStoreDialogUtils";
import { VectorStoreFiles } from "./VectorStoreFiles";

interface VectorStoreRowProps {
  inChat: boolean;
  onChanged: VoidFunction;
  onRegistryChange: React.Dispatch<RegistryUpdate>;
  options: Options;
  store: VectorStore;
}

export function VectorStoreRow({
  inChat,
  onChanged,
  onRegistryChange,
  options,
  store,
}: VectorStoreRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === store.name) {
      setEditing(false);
      return;
    }
    try {
      await renameVectorStore(options, store.id, trimmed);
      onRegistryChange((registry) =>
        renameVectorStoreInChat(registry, { id: store.id, name: trimmed })
      );
      setEditing(false);
      onChanged();
    } catch (error) {
      showVectorStoreError(t("vector_store_rename_error"), error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteVectorStore(options, store.id);
      onRegistryChange((registry) =>
        setVectorStoreInChat(registry, store, false)
      );
      onChanged();
    } catch (error) {
      showVectorStoreError(t("vector_store_delete_error"), error);
    }
    setConfirmDelete(false);
  };

  const cancelRename = () => {
    setName(store.name);
    setEditing(false);
  };

  return (
    <Stack gap={0} data-testid={`vector-store-${store.id}`}>
      <HStack justifyContent="space-between">
        <HStack flexGrow={1} minWidth={0}>
          <IconButton
            aria-label={t("vector_store_show_files")}
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <LuChevronDown /> : <LuChevronRight />}
          </IconButton>
          {editing ? (
            <Input
              size="sm"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleRename();
                if (event.key === "Escape") cancelRename();
              }}
            />
          ) : (
            <Text truncate>{store.name}</Text>
          )}
          <Text fontSize="xs" color="fg.muted" flexShrink={0}>
            {t("vector_store_file_count", { count: store.file_counts.total })}
          </Text>
        </HStack>
        <HStack gap={1}>
          <Checkbox.Root
            size="sm"
            variant="outline"
            marginInlineEnd={2}
            checked={inChat}
            onCheckedChange={(event) =>
              onRegistryChange((registry) =>
                setVectorStoreInChat(registry, store, event.checked === true)
              )
            }
            data-testid={`vector-store-in-chat-${store.id}`}
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control />
            <Checkbox.Label fontSize="sm" whiteSpace="nowrap">
              {t("vector_store_use_in_chat")}
            </Checkbox.Label>
          </Checkbox.Root>
          {editing ? (
            <RenameActions onSave={handleRename} onCancel={cancelRename} />
          ) : confirmDelete ? (
            <ConfirmDeleteActions
              storeId={store.id}
              onDelete={handleDelete}
              onCancel={() => setConfirmDelete(false)}
            />
          ) : (
            <RowActions
              storeId={store.id}
              onRename={() => setEditing(true)}
              onDelete={() => setConfirmDelete(true)}
            />
          )}
        </HStack>
      </HStack>
      {expanded && (
        <VectorStoreFiles
          options={options}
          store={store}
          onFilesChanged={onChanged}
        />
      )}
    </Stack>
  );
}

function RenameActions({
  onSave,
  onCancel,
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <IconButton
        aria-label={t("save")}
        variant="ghost"
        size="sm"
        onClick={() => void onSave()}
      >
        <MdCheck />
      </IconButton>
      <IconButton
        aria-label={t("cancel")}
        variant="ghost"
        size="sm"
        onClick={onCancel}
      >
        <MdClose />
      </IconButton>
    </>
  );
}

function ConfirmDeleteActions({
  storeId,
  onDelete,
  onCancel,
}: {
  storeId: string;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Button
        colorPalette="red"
        size="xs"
        data-testid={`vector-store-confirm-delete-${storeId}`}
        onClick={() => void onDelete()}
      >
        {t("vector_store_confirm_delete")}
      </Button>
      <Button variant="ghost" size="xs" onClick={onCancel}>
        {t("cancel")}
      </Button>
    </>
  );
}

function RowActions({
  storeId,
  onRename,
  onDelete,
}: {
  storeId: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <IconButton
        aria-label={t("vector_store_rename")}
        title={t("vector_store_rename")}
        data-testid={`vector-store-rename-${storeId}`}
        variant="ghost"
        size="sm"
        onClick={onRename}
      >
        <MdEdit />
      </IconButton>
      <IconButton
        aria-label={t("vector_store_delete")}
        title={t("vector_store_delete")}
        data-testid={`vector-store-delete-${storeId}`}
        variant="ghost"
        size="sm"
        onClick={onDelete}
      >
        <MdDelete />
      </IconButton>
    </>
  );
}
