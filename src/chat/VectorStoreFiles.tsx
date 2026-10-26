import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  HStack,
  IconButton,
  Popover,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { VectorStore } from "openai/resources/vector-stores/vector-stores.mjs";
import { useTranslation } from "react-i18next";
import { LuChevronDown } from "react-icons/lu";
import { MdDelete, MdOutlineFileUpload } from "react-icons/md";
import { ChunkingSettings, chunkingChoiceName } from "./ChunkingSettings";
import { Options } from "./context/types";
import {
  VectorStoreFileWithName,
  deleteFile,
  listVectorStoreFiles,
  updateVectorStoreMetadata,
  uploadFileToVectorStore,
} from "./service/vectorStores";
import {
  INPUT_FILE_EXTENSIONS,
  extractFiles,
  isInputFile,
} from "./utils/attachments";
import {
  ChunkingChoice,
  chunkingChoiceFromMetadata,
  chunkingStrategyFor,
  metadataWithChunkingChoice,
} from "./utils/chunking";
import {
  showVectorStoreError,
  withVectorStoreFileMimeType,
} from "./vectorStoreDialogUtils";

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

interface ChunkingSettingRowProps {
  onChange: (choice: ChunkingChoice) => void;
  storeId: string;
  value: ChunkingChoice;
}

function ChunkingSettingRow({
  onChange,
  storeId,
  value,
}: ChunkingSettingRowProps) {
  const { t } = useTranslation();
  const name = chunkingChoiceName(t, value);
  return (
    <HStack gap={2.5} flexWrap="wrap" justifyContent="flex-end">
      <Text fontSize="xs" color="fg.muted">
        {t("vector_store_chunking_title")}
      </Text>
      {/*
       * Not portalled: the dialog's focus trap would otherwise block the
       * inputs in the popover.
       */}
      <Popover.Root
        lazyMount
        unmountOnExit
        positioning={{ placement: "bottom-end", fitViewport: true }}
      >
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            size="xs"
            borderRadius="full"
            gap={1.5}
            // The visible text alone ("Precise") lacks context for screen readers.
            aria-label={`${t("vector_store_chunking_title")}: ${name}`}
            css={{
              "& [data-chevron]": { transition: "transform 0.16s" },
              "&[data-state=open] [data-chevron]": {
                transform: "rotate(180deg)",
              },
            }}
            data-testid={`vector-store-chunking-toggle-${storeId}`}
          >
            <Box
              width="7px"
              height="7px"
              borderRadius="full"
              backgroundColor="blue.solid"
            />
            <span data-testid={`vector-store-chunking-${storeId}`}>{name}</span>
            <Box as="span" data-chevron="" color="fg.muted">
              <LuChevronDown />
            </Box>
          </Button>
        </Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content
            width="340px"
            maxWidth="calc(100vw - 32px)"
            // Scrolls instead of leaving the window once "Advanced" is open.
            maxHeight="var(--available-height)"
            overflowY="auto"
            padding={4}
            borderRadius="xl"
          >
            <ChunkingSettings value={value} onChange={onChange} />
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>
    </HStack>
  );
}

interface VectorStoreFilesProps {
  options: Options;
  onFilesChanged: VoidFunction;
  store: VectorStore;
}

export function VectorStoreFiles({
  options,
  onFilesChanged,
  store,
}: VectorStoreFilesProps) {
  const { t } = useTranslation();
  const [files, setFiles] = useState<VectorStoreFileWithName[] | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // The store's metadata is the source of truth; this copy updates at once.
  const [chunking, setChunking] = useState(() =>
    chunkingChoiceFromMetadata(store.metadata)
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await listVectorStoreFiles(options, store.id));
    } catch (error) {
      showVectorStoreError(t("vector_store_files_load_error"), error);
      setFiles([]);
    }
  }, [options, store.id, t]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleUpload = async (selected: File[]) => {
    for (const file of selected) {
      if (!isInputFile(file)) {
        showVectorStoreError(t("vector_store_file_unsupported"), file.name);
        continue;
      }
      setUploading((current) => [...current, file.name]);
      try {
        const result = await uploadFileToVectorStore(
          options,
          store.id,
          withVectorStoreFileMimeType(file),
          chunkingStrategyFor(chunking)
        );
        if (result.status === "failed") {
          showVectorStoreError(
            t("vector_store_file_processing_failed", { name: file.name }),
            result.last_error?.message ?? ""
          );
        }
      } catch (error) {
        showVectorStoreError(
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

  const handleChunkingChange = async (choice: ChunkingChoice) => {
    const previous = chunking;
    setChunking(choice);
    try {
      // The service replaces the metadata, so send it complete.
      await updateVectorStoreMetadata(
        options,
        store.id,
        metadataWithChunkingChoice(store.metadata, choice)
      );
      // The update response has no metadata, so reload the stores.
      onFilesChanged();
    } catch (error) {
      setChunking(previous);
      showVectorStoreError(t("vector_store_chunking_save_error"), error);
    }
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (event.target.files) void handleUpload(Array.from(event.target.files));
    event.target.value = "";
  };

  const dragHandler = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!event.dataTransfer.types.includes("Files")) return;

    switch (event.type) {
      case "dragenter":
      case "dragover":
        event.preventDefault();
        setDragOver(true);
        break;
      case "dragleave":
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
      showVectorStoreError(t("vector_store_file_delete_error"), error);
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
      <ChunkingSettingRow
        storeId={store.id}
        value={chunking}
        onChange={(choice) => void handleChunkingChange(choice)}
      />
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
