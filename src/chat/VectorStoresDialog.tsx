import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Badge,
  Button,
  Checkbox,
  CloseButton,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  Portal,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { VectorStore } from "openai/resources/vector-stores/vector-stores.mjs";
import { useTranslation } from "react-i18next";
import { LuChevronDown, LuChevronRight } from "react-icons/lu";
import {
  MdCheck,
  MdClose,
  MdDelete,
  MdEdit,
  MdOutlineFileUpload,
} from "react-icons/md";
import { useGlobal } from "./context";
import { Options } from "./context/types";
import {
  RegistryUpdate,
  useFileSearchRegistry,
} from "./hooks/useFileSearchRegistry";
import { toaster } from "../components/ui/toaster";
import {
  INPUT_FILE_EXTENSIONS,
  extractFiles,
  getInputFileMimeType,
  isInputFile,
} from "./utils/attachments";
import {
  VectorStoreFileWithName,
  createVectorStore,
  deleteFile,
  deleteVectorStore,
  listVectorStoreFiles,
  listVectorStores,
  renameVectorStore,
  uploadFileToVectorStore,
} from "./service/vectorStores";
import {
  renameVectorStoreInChat,
  setVectorStoreInChat,
} from "./utils/fileSearch";

function showError(title: string, error: unknown) {
  console.error(title, error);
  toaster.create({
    title,
    description: error instanceof Error ? error.message : String(error),
    type: "error",
    duration: 5000,
  });
}

/*
 * Browsers often report an empty MIME type for e.g. Markdown files, which the
 * vector store service then cannot parse. Fall back to the type derived from
 * the file extension.
 */
function withMimeType(file: File): File {
  if (file.type) {
    return file;
  }
  return new File([file], file.name, { type: getInputFileMimeType(file.name) });
}

const FILE_STATUS_COLORS: Record<string, string> = {
  completed: "green",
  in_progress: "blue",
  failed: "red",
  cancelled: "gray",
};

function FileStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge colorPalette={FILE_STATUS_COLORS[status] ?? "gray"} size="sm">
      {t(`vector_store_file_status_${status}`)}
    </Badge>
  );
}

interface VectorStoreFilesProps {
  options: Options;
  onFilesChanged: VoidFunction;
  store: VectorStore;
}

function VectorStoreFiles({
  options,
  onFilesChanged,
  store,
}: VectorStoreFilesProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<VectorStoreFileWithName[] | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await listVectorStoreFiles(options, store.id));
    } catch (error) {
      showError(t("vector_store_files_load_error"), error);
      setFiles([]);
    }
  }, [options, store.id, t]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleUpload = async (selected: File[]) => {
    for (const file of selected) {
      if (!isInputFile(file)) {
        showError(t("vector_store_file_unsupported"), file.name);
        continue;
      }
      setUploading((current) => [...current, file.name]);
      try {
        const result = await uploadFileToVectorStore(
          options,
          store.id,
          withMimeType(file)
        );
        if (result.status === "failed") {
          showError(
            t("vector_store_file_processing_failed", { name: file.name }),
            result.last_error?.message ?? ""
          );
        }
      } catch (error) {
        showError(
          t("vector_store_file_upload_error", { name: file.name }),
          error
        );
      } finally {
        setUploading((current) => current.filter((name) => name !== file.name));
      }
      await loadFiles();
      onFilesChanged();
    }
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) {
      void handleUpload(Array.from(event.target.files));
    }
    // Reset the input value so the same file can be selected again
    event.target.value = "";
  };

  // Same drag & drop behaviour as the chat input (MessageInput.tsx).
  const dragHandler = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!event.dataTransfer.types.includes("Files")) {
      return;
    }

    switch (event.type) {
      case "dragenter":
      case "dragover":
        event.preventDefault();
        setDragOver(true);
        break;

      case "dragleave":
        // Ignore leave events fired when moving onto a child element.
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragOver(false);
        }
        break;

      case "drop":
        event.preventDefault();
        setDragOver(false);
        void handleUpload(extractFiles(event.dataTransfer));
        break;
    }
  };

  const handleDelete = async (fileId: string) => {
    setConfirmDeleteId(null);
    try {
      await deleteFile(options, fileId);
    } catch (error) {
      showError(t("vector_store_file_delete_error"), error);
    }
    await loadFiles();
    onFilesChanged();
  };

  return (
    <Stack
      gap={2}
      marginInlineStart={8}
      marginBlock={2}
      padding={2}
      borderWidth="2px"
      borderStyle="dashed"
      borderRadius="md"
      borderColor={dragOver ? "var(--primary)" : "transparent"}
      backgroundColor={dragOver ? "hsla(210, 100%, 50%, 0.1)" : undefined}
      onDragEnter={dragHandler}
      onDragOver={dragHandler}
      onDragLeave={dragHandler}
      onDrop={dragHandler}
      data-testid={`vector-store-dropzone-${store.id}`}
    >
      {files === null && <Spinner size="sm" />}
      {files?.length === 0 && uploading.length === 0 && (
        <Text fontSize="sm" color="fg.muted">
          {t("vector_store_no_files")}
        </Text>
      )}
      {files?.map((file) => (
        <HStack key={file.id} justifyContent="space-between">
          <HStack minWidth={0}>
            <Text fontSize="sm" truncate>
              {file.filename ?? file.id}
            </Text>
            <FileStatusBadge status={file.status} />
          </HStack>
          {confirmDeleteId === file.id ? (
            <HStack gap={1} flexShrink={0}>
              <Button
                colorPalette="red"
                size="xs"
                data-testid={`vector-store-file-confirm-delete-${file.id}`}
                onClick={() => void handleDelete(file.id)}
              >
                {t("vector_store_confirm_delete")}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setConfirmDeleteId(null)}
              >
                {t("cancel")}
              </Button>
            </HStack>
          ) : (
            <IconButton
              aria-label={t("vector_store_file_delete")}
              title={t("vector_store_file_delete")}
              data-testid={`vector-store-file-delete-${file.id}`}
              variant="ghost"
              size="xs"
              onClick={() => setConfirmDeleteId(file.id)}
            >
              <MdDelete />
            </IconButton>
          )}
        </HStack>
      ))}
      {uploading.map((name) => (
        <HStack key={name}>
          <Text fontSize="sm" truncate>
            {name}
          </Text>
          <FileStatusBadge status="in_progress" />
        </HStack>
      ))}
      <HStack>
        <input
          type="file"
          multiple
          hidden
          accept={INPUT_FILE_EXTENSIONS.join(",")}
          ref={fileInputRef}
          onChange={handleFileInputChange}
          data-testid={`vector-store-upload-${store.id}`}
        />
        <IconButton
          variant="outline"
          size="sm"
          aria-label={t("vector_store_upload")}
          title={t("vector_store_upload")}
          onClick={() => fileInputRef.current?.click()}
          data-testid={`vector-store-upload-btn-${store.id}`}
        >
          <MdOutlineFileUpload />
        </IconButton>
        <Text fontSize="xs" color="fg.muted">
          {t("vector_store_upload_hint")}
        </Text>
      </HStack>
    </Stack>
  );
}

interface VectorStoreRowProps {
  inChat: boolean;
  onChanged: VoidFunction;
  onRegistryChange: React.Dispatch<RegistryUpdate>;
  options: Options;
  store: VectorStore;
}

function VectorStoreRow({
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
      showError(t("vector_store_rename_error"), error);
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
      showError(t("vector_store_delete_error"), error);
    }
    setConfirmDelete(false);
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
                if (event.key === "Escape") {
                  setName(store.name);
                  setEditing(false);
                }
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
            <>
              <IconButton
                aria-label={t("save")}
                variant="ghost"
                size="sm"
                onClick={() => void handleRename()}
              >
                <MdCheck />
              </IconButton>
              <IconButton
                aria-label={t("cancel")}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setName(store.name);
                  setEditing(false);
                }}
              >
                <MdClose />
              </IconButton>
            </>
          ) : confirmDelete ? (
            <>
              <Button
                colorPalette="red"
                size="xs"
                data-testid={`vector-store-confirm-delete-${store.id}`}
                onClick={() => void handleDelete()}
              >
                {t("vector_store_confirm_delete")}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setConfirmDelete(false)}
              >
                {t("cancel")}
              </Button>
            </>
          ) : (
            <>
              <IconButton
                aria-label={t("vector_store_rename")}
                title={t("vector_store_rename")}
                data-testid={`vector-store-rename-${store.id}`}
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <MdEdit />
              </IconButton>
              <IconButton
                aria-label={t("vector_store_delete")}
                title={t("vector_store_delete")}
                data-testid={`vector-store-delete-${store.id}`}
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
              >
                <MdDelete />
              </IconButton>
            </>
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

interface CreateVectorStoreFormProps {
  onCreated: VoidFunction;
  options: Options;
}

function CreateVectorStoreForm({
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
      await createVectorStore(options, trimmed);
      setName("");
      onCreated();
    } catch (error) {
      showError(t("vector_store_create_error"), error);
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
            placeholder={t("vector_store_name_placeholder")}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            type="submit"
            colorPalette="blue"
            loading={saving}
            disabled={!name.trim()}
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

function useVectorStores(options: Options, open: boolean) {
  const { t } = useTranslation();
  const [stores, setStores] = useState<VectorStore[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStores(await listVectorStores(options));
    } catch (error) {
      showError(t("vector_store_load_error"), error);
      setStores([]);
    }
  }, [options, t]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  return { stores, refresh };
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
  const { options: globalOptions } = useGlobal();
  const { updateRegistry, isInChat } = useFileSearchRegistry();
  const { apiKey, organizationId, vectorStoreBaseUrl } = globalOptions.openai;
  // Only reload when the connection settings change, not on every state update.
  const options = useMemo(
    () => globalOptions,
    [apiKey, organizationId, vectorStoreBaseUrl]
  );
  const { stores, refresh } = useVectorStores(options, open);
  const handleChanged = () => void refresh();

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
            <Dialog.Body
              overflowY="auto"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => event.preventDefault()}
            >
              <CreateVectorStoreForm
                options={options}
                onCreated={handleChanged}
              />
              <Separator marginBlock={4} />
              <Text fontWeight="bold" marginBlockEnd={2}>
                {t("vector_stores")}
              </Text>
              {stores === null && <Spinner />}
              {stores?.length === 0 && (
                <Text color="fg.muted">{t("vector_store_none")}</Text>
              )}
              <Stack gap={1}>
                {stores?.map((store) => (
                  <VectorStoreRow
                    key={store.id}
                    store={store}
                    options={options}
                    onChanged={handleChanged}
                    inChat={isInChat(store.id)}
                    onRegistryChange={updateRegistry}
                  />
                ))}
              </Stack>
            </Dialog.Body>
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
