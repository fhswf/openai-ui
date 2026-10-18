import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  HStack,
  IconButton,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { MdDeleteOutline, MdDownload, MdVisibility } from "react-icons/md";
import { useTranslation } from "react-i18next";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import {
  canDeleteVaultAttachment,
  deleteOpfsFile,
  deleteVaultAttachment,
  getAttachmentStorageId,
  getInputFileMimeType,
  getOpfsFile,
} from "./utils/attachments";
import { getChatAttachmentReferences } from "./utils/chatAttachments";

function formatSize(size?: number): string {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatAttachmentManager() {
  const { chat, currentChat, options, setState } = useGlobal();
  const { t } = useTranslation();
  const selectedChat = chat?.[currentChat];
  const chatId = selectedChat ? String(selectedChat.id) : "";
  const references = useMemo(
    () => getChatAttachmentReferences(selectedChat),
    [selectedChat]
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!preview) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  const getFile = async (reference: (typeof references)[number]) => {
    const attachmentId = await getAttachmentStorageId(
      reference.attachmentId,
      reference.opfsName
    );
    const file = await getOpfsFile(reference.opfsName, chatId, attachmentId);
    return new File([file], reference.filename, {
      type: file.type || getInputFileMimeType(reference.filename),
      lastModified: file.lastModified,
    });
  };

  const view = async (reference: (typeof references)[number], key: string) => {
    setBusyKey(key);
    try {
      const file = await getFile(reference);
      setPreview(file);
      const type = file.type || getInputFileMimeType(reference.filename);
      if (
        type.startsWith("text/") ||
        ["application/json", "application/xml"].includes(type)
      ) {
        setPreviewText(await file.text());
      } else {
        setPreviewText(null);
      }
      setDialogOpen(true);
    } catch (error) {
      console.error("Could not open attachment:", error);
      toaster.create({
        title: t("attachment_unavailable"),
        description: error instanceof Error ? error.message : String(error),
        duration: 6000,
        type: "error",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const download = async (
    reference: (typeof references)[number],
    key: string
  ) => {
    setBusyKey(key);
    try {
      const file = await getFile(reference);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = reference.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Could not download attachment:", error);
      toaster.create({
        title: t("attachment_unavailable"),
        description: error instanceof Error ? error.message : String(error),
        duration: 6000,
        type: "error",
      });
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (
    reference: (typeof references)[number],
    key: string
  ) => {
    setBusyKey(key);
    try {
      const attachmentId = await getAttachmentStorageId(
        reference.attachmentId,
        reference.opfsName
      );
      if (options.general.zkStorage && canDeleteVaultAttachment(chatId)) {
        await deleteVaultAttachment(chatId, attachmentId);
      }
      await deleteOpfsFile(reference.opfsName).catch(() => undefined);

      const matchesReference = (item: any, filename: string) => {
        if (reference.attachmentId && item.attachmentId) {
          return item.attachmentId === reference.attachmentId;
        }
        return filename === reference.opfsName;
      };
      const nextChat = [...chat];
      const current = { ...nextChat[currentChat] };
      current.messages = current.messages.map((message) => {
        const updated: any = { ...message };
        if (Array.isArray(message.content)) {
          updated.content = message.content.filter((item: any) => {
            if (item.type === "input_image" && item.image_url?.startsWith("opfs://")) {
              const opfsName = item.image_url.slice("opfs://".length);
              return !matchesReference(item, opfsName);
            }
            if (item.type === "input_file") {
              return !matchesReference(item, item.opfsName || item.filename);
            }
            return true;
          });
        }
        if (message.images && typeof message.images === "object") {
          updated.images = Object.fromEntries(
            Object.entries(message.images).filter(([key, image]: [string, any]) => {
              const filename = image?.url?.startsWith("opfs://")
                ? image.url.slice("opfs://".length)
                : image?.name;
              if (reference.attachmentId && (image?.id || image?.file_id)) {
                return (image.id || image.file_id) !== reference.attachmentId;
              }
              return filename !== reference.opfsName && key !== reference.opfsName;
            })
          );
        }
        return updated;
      });
      nextChat[currentChat] = current;
      setState({ chat: nextChat });
    } catch (error) {
      console.error("Could not delete attachment:", error);
      toaster.create({
        title: t("error_occurred"),
        description: error instanceof Error ? error.message : String(error),
        duration: 6000,
        type: "error",
      });
    } finally {
      setBusyKey(null);
    }
  };

  if (references.length === 0) return null;

  const previewType = preview?.type || getInputFileMimeType(preview?.name || "");

  return (
    <>
      <Stack gap="2" align="stretch">
        <Text fontWeight="semibold">{t("chat_attachments")}</Text>
        <Text fontSize="sm" color="fg.muted">
          {t("chat_attachments_help")}
        </Text>
        {references.map((reference, index) => {
          const key = `${reference.attachmentId ?? reference.opfsName}-${index}`;
          const canDelete =
            !options.general.zkStorage || canDeleteVaultAttachment(chatId);
          return (
            <HStack key={key} justify="space-between" wrap="wrap">
              <Text minW="0" overflowWrap="anywhere">
                {reference.filename}
                {reference.size != null ? ` · ${formatSize(reference.size)}` : ""}
              </Text>
              <HStack>
                <IconButton
                  aria-label={t("view_attachment")}
                  title={t("view_attachment")}
                  size="sm"
                  variant="outline"
                  loading={busyKey === `view-${key}`}
                  disabled={busyKey !== null}
                  onClick={() => void view(reference, `view-${key}`)}
                >
                  <MdVisibility />
                </IconButton>
                <IconButton
                  aria-label={t("download_attachment")}
                  title={t("download_attachment")}
                  size="sm"
                  variant="outline"
                  loading={busyKey === `download-${key}`}
                  disabled={busyKey !== null}
                  onClick={() => void download(reference, `download-${key}`)}
                >
                  <MdDownload />
                </IconButton>
                {canDelete && (
                  <IconButton
                    aria-label={t("delete_attachment")}
                    title={t("delete_attachment")}
                    size="sm"
                    variant="outline"
                    colorPalette="red"
                    loading={busyKey === `delete-${key}`}
                    disabled={busyKey !== null}
                    onClick={() => void remove(reference, `delete-${key}`)}
                  >
                    <MdDeleteOutline />
                  </IconButton>
                )}
              </HStack>
            </HStack>
          );
        })}
      </Stack>

      <Dialog.Root
        open={dialogOpen}
        onOpenChange={(event) => {
          setDialogOpen(event.open);
          if (!event.open) {
            setPreview(null);
            setPreviewText(null);
          }
        }}
        size="xl"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content maxH="90vh">
              <Dialog.Header>
                <Dialog.Title>{preview?.name}</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body overflow="auto">
                {previewUrl && previewType.startsWith("image/") ? (
                  <img
                    src={previewUrl}
                    alt={preview?.name}
                    style={{ maxWidth: "100%", maxHeight: "70vh" }}
                  />
                ) : previewUrl && previewType === "application/pdf" ? (
                  <iframe
                    src={previewUrl}
                    title={preview?.name}
                    style={{ width: "100%", height: "70vh", border: 0 }}
                  />
                ) : previewText != null ? (
                  <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {previewText}
                  </pre>
                ) : (
                  <Text>{t("attachment_no_preview")}</Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setPreview(null);
                    setPreviewText(null);
                  }}
                >
                  {t("close")}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
