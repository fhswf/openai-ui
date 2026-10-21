import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  HStack,
  IconButton,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { VectorStore } from "openai/resources/vector-stores/vector-stores.mjs";
import { useTranslation } from "react-i18next";
import { MdDelete, MdOutlineFileUpload } from "react-icons/md";
import { Options } from "./context/types";
import {
  VectorStoreFileWithName,
  deleteFile,
  listVectorStoreFiles,
  uploadFileToVectorStore,
} from "./service/vectorStores";
import {
  INPUT_FILE_EXTENSIONS,
  extractFiles,
  isInputFile,
} from "./utils/attachments";
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
          withVectorStoreFileMimeType(file)
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
