import React, { useEffect, useState } from "react";
import { Button, Dialog, Field, HStack, IconButton, Input, Stack, Text } from "@chakra-ui/react";
import { IoCloseOutline, IoShareOutline } from "react-icons/io5";
import { useTranslation } from "react-i18next";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";

type GeneratedLink = {
  url: string;
  token: string;
  expiresAt: string;
};

export function ChatShareDialog() {
  const {
    chat,
    currentChat,
    options,
    vaultReady,
    shareChatWithUser,
    createChatShareLink,
    revokeChatShareLink,
  } = useGlobal();
  const { t } = useTranslation();
  const selectedChat = chat?.[currentChat];
  const chatId = selectedChat ? String(selectedChat.id) : "";
  const canShare = Boolean(options.general.zkStorage && vaultReady && chatId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);

  useEffect(() => {
    setGeneratedLink(null);
    setEmail("");
  }, [chatId]);

  const shareWithUser = async () => {
    const recipientEmail = email.trim();
    if (!recipientEmail || !chatId) return;
    setBusy(true);
    try {
      await shareChatWithUser(chatId, recipientEmail);
      setEmail("");
      toaster.create({
        title: t("share_chat_user_success"),
        duration: 5000,
        type: "success",
      });
    } catch (error) {
      console.error("Could not share the chat with this user:", error);
      toaster.create({
        title: t("share_chat_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const createLink = async () => {
    if (!chatId) return;
    setBusy(true);
    try {
      setGeneratedLink(await createChatShareLink(chatId));
    } catch (error) {
      console.error("Could not create a chat share link:", error);
      toaster.create({
        title: t("share_chat_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink.url);
      toaster.create({
        title: t("share_chat_link_copied"),
        duration: 4000,
        type: "success",
      });
    } catch (error) {
      toaster.create({
        title: t("share_chat_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 6000,
        type: "error",
      });
    }
  };

  const revokeLink = async () => {
    if (!generatedLink || !chatId) return;
    setBusy(true);
    try {
      await revokeChatShareLink(chatId, generatedLink.token);
      setGeneratedLink(null);
      toaster.create({
        title: t("share_chat_link_revoked"),
        duration: 4000,
        type: "success",
      });
    } catch (error) {
      toaster.create({
        title: t("share_chat_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 6000,
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!canShare) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(event) => setOpen(event.open)} size="md">
      <Dialog.Trigger asChild>
        <IconButton
          aria-label={t("share_chat")}
          title={t("share_chat")}
          variant="ghost"
          onClick={() => setOpen(true)}
        >
          <IoShareOutline />
        </IconButton>
      </Dialog.Trigger>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger asChild>
            <IconButton aria-label={t("close")} variant="ghost">
              <IoCloseOutline />
            </IconButton>
          </Dialog.CloseTrigger>
          <Dialog.Header>
            <Dialog.Title>{t("share_chat")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="5">
              <Stack gap="2">
                <Text fontWeight="semibold">{t("share_chat_link_title")}</Text>
                <Text color="fg.muted" fontSize="sm">
                  {t("share_chat_link_help")}
                </Text>
                {generatedLink ? (
                  <Stack gap="2">
                    <Input value={generatedLink.url} readOnly aria-label={t("share_chat_link_label")} />
                    <Text fontSize="sm" color="fg.muted">
                      {t("share_chat_link_expires", {
                        date: new Date(generatedLink.expiresAt).toLocaleString(),
                      })}
                    </Text>
                    <HStack>
                      <Button variant="outline" onClick={() => void copyLink()}>
                        {t("share_chat_copy_link")}
                      </Button>
                      <Button
                        colorPalette="red"
                        variant="outline"
                        disabled={busy}
                        loading={busy}
                        onClick={() => void revokeLink()}
                      >
                        {t("share_chat_revoke_link")}
                      </Button>
                    </HStack>
                  </Stack>
                ) : (
                  <Button disabled={busy} loading={busy} onClick={() => void createLink()}>
                    {t("share_chat_create_link")}
                  </Button>
                )}
              </Stack>

              <Stack gap="2">
                <Text fontWeight="semibold">{t("share_chat_user_title")}</Text>
                <Text color="fg.muted" fontSize="sm">
                  {t("share_chat_user_help")}
                </Text>
                <Field.Root>
                  <Field.Label>{t("share_chat_email_label")}</Field.Label>
                  <Input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("share_chat_email_placeholder")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void shareWithUser();
                    }}
                  />
                </Field.Root>
                <Button
                  alignSelf="start"
                  disabled={busy || !email.trim()}
                  loading={busy}
                  onClick={() => void shareWithUser()}
                >
                  {t("share_chat_send")}
                </Button>
              </Stack>
            </Stack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
