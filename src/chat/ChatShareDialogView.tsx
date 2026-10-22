import React from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Button,
  Dialog,
  Field,
  HStack,
  IconButton,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { LuShare, LuX } from "react-icons/lu";
import { useTranslation } from "react-i18next";
import { toaster } from "../components/ui/toaster";
import type { VaultSharingActions } from "./context/types";

export type GeneratedLink = {
  url: string;
  token: string;
  expiresAt: string;
};

type ShareActions = Pick<
  VaultSharingActions,
  "shareChatWithUser" | "createChatShareLink" | "revokeChatShareLink"
>;

type BusySetter = Dispatch<SetStateAction<boolean>>;

function notifyShareError(
  error: unknown,
  errorTitle: string,
  unknownError: string,
  duration: number
) {
  toaster.create({
    title: errorTitle,
    description: error instanceof Error ? error.message : unknownError,
    duration,
    type: "error",
  });
}

function notifyShareSuccess(title: string, duration: number) {
  toaster.create({ title, duration, type: "success" });
}

async function runShareAction(
  action: () => Promise<void>,
  onError: (error: unknown) => void,
  setBusy?: BusySetter
) {
  setBusy?.(true);
  try {
    await action();
  } catch (error) {
    onError(error);
  } finally {
    setBusy?.(false);
  }
}

async function shareWithUser(
  chatId: string,
  email: string,
  actions: ShareActions,
  setEmail: Dispatch<SetStateAction<string>>,
  setBusy: BusySetter,
  successTitle: string,
  errorTitle: string,
  unknownError: string
) {
  const recipientEmail = email.trim();
  if (!recipientEmail || !chatId) return;
  await runShareAction(
    async () => {
      await actions.shareChatWithUser(chatId, recipientEmail);
      setEmail("");
      notifyShareSuccess(successTitle, 5000);
    },
    (error) => {
      console.error("Could not share the chat with this user:", error);
      notifyShareError(error, errorTitle, unknownError, 8000);
    },
    setBusy
  );
}

async function createShareLink(
  chatId: string,
  actions: ShareActions,
  setGeneratedLink: Dispatch<SetStateAction<GeneratedLink | null>>,
  setBusy: BusySetter,
  errorTitle: string,
  unknownError: string
) {
  if (!chatId) return;
  await runShareAction(
    async () => {
      setGeneratedLink(await actions.createChatShareLink(chatId));
    },
    (error) => {
      console.error("Could not create a chat share link:", error);
      notifyShareError(error, errorTitle, unknownError, 8000);
    },
    setBusy
  );
}

async function copyShareLink(
  link: GeneratedLink | null,
  successTitle: string,
  errorTitle: string,
  unknownError: string
) {
  if (!link) return;
  await runShareAction(
    async () => {
      await navigator.clipboard.writeText(link.url);
      notifyShareSuccess(successTitle, 4000);
    },
    (error) => {
      notifyShareError(error, errorTitle, unknownError, 6000);
    }
  );
}

async function revokeShareLink(
  chatId: string,
  link: GeneratedLink | null,
  actions: ShareActions,
  setGeneratedLink: Dispatch<SetStateAction<GeneratedLink | null>>,
  setBusy: BusySetter,
  successTitle: string,
  errorTitle: string,
  unknownError: string
) {
  if (!link || !chatId) return;
  await runShareAction(
    async () => {
      await actions.revokeChatShareLink(chatId, link.token);
      setGeneratedLink(null);
      notifyShareSuccess(successTitle, 4000);
    },
    (error) => {
      notifyShareError(error, errorTitle, unknownError, 6000);
    },
    setBusy
  );
}

type LinkSectionProps = {
  generatedLink: GeneratedLink | null;
  busy: boolean;
  onCreate: () => void;
  onCopy: () => void;
  onRevoke: () => void;
};

function GeneratedShareLink({
  link,
  busy,
  onCopy,
  onRevoke,
}: {
  link: GeneratedLink;
  busy: boolean;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="2">
      <Input
        value={link.url}
        readOnly
        aria-label={t("share_chat_link_label")}
      />
      <Text fontSize="sm" color="fg.muted">
        {t("share_chat_link_expires", {
          date: new Date(link.expiresAt).toLocaleString(),
        })}
      </Text>
      <HStack>
        <Button variant="outline" onClick={onCopy}>
          {t("share_chat_copy_link")}
        </Button>
        <Button
          colorPalette="red"
          variant="outline"
          disabled={busy}
          loading={busy}
          onClick={onRevoke}
        >
          {t("share_chat_revoke_link")}
        </Button>
      </HStack>
    </Stack>
  );
}

function ChatShareLinkSection({
  generatedLink,
  busy,
  onCreate,
  onCopy,
  onRevoke,
}: LinkSectionProps) {
  const { t } = useTranslation();
  return (
    <Stack gap="2">
      <Text fontWeight="semibold">{t("share_chat_link_title")}</Text>
      <Text color="fg.muted" fontSize="sm">
        {t("share_chat_link_help")}
      </Text>
      {generatedLink ? (
        <GeneratedShareLink
          link={generatedLink}
          busy={busy}
          onCopy={onCopy}
          onRevoke={onRevoke}
        />
      ) : (
        <Button disabled={busy} loading={busy} onClick={onCreate}>
          {t("share_chat_create_link")}
        </Button>
      )}
    </Stack>
  );
}

type UserSectionProps = {
  email: string;
  busy: boolean;
  setEmail: Dispatch<SetStateAction<string>>;
  onShare: () => void;
};

function ChatShareUserSection({
  email,
  busy,
  setEmail,
  onShare,
}: UserSectionProps) {
  const { t } = useTranslation();
  return (
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
            if (event.key === "Enter") onShare();
          }}
        />
      </Field.Root>
      <Button
        alignSelf="start"
        disabled={busy || !email.trim()}
        loading={busy}
        onClick={onShare}
      >
        {t("share_chat_send")}
      </Button>
    </Stack>
  );
}

export type ShareDialogViewProps = {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  chatId: string;
  actions: ShareActions;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  busy: boolean;
  setBusy: BusySetter;
  generatedLink: GeneratedLink | null;
  setGeneratedLink: Dispatch<SetStateAction<GeneratedLink | null>>;
};

type ShareDialogHandlers = {
  onCreate: () => void;
  onCopy: () => void;
  onRevoke: () => void;
  onShare: () => void;
};

type ShareLinkHandlerInputs = Pick<
  ShareDialogViewProps,
  "chatId" | "actions" | "setBusy" | "generatedLink" | "setGeneratedLink"
>;

type RecipientHandlerInputs = Pick<
  ShareDialogViewProps,
  "chatId" | "actions" | "email" | "setEmail" | "setBusy"
>;

function useShareLinkHandlers({
  chatId,
  actions,
  setBusy,
  generatedLink,
  setGeneratedLink,
}: ShareLinkHandlerInputs): Pick<
  ShareDialogHandlers,
  "onCreate" | "onCopy" | "onRevoke"
> {
  const { t } = useTranslation();
  const errorTitle = t("share_chat_error");
  const unknownError = t("unknown_error");
  return {
    onCreate: () => {
      void createShareLink(
        chatId,
        actions,
        setGeneratedLink,
        setBusy,
        errorTitle,
        unknownError
      );
    },
    onCopy: () => {
      void copyShareLink(
        generatedLink,
        t("share_chat_link_copied"),
        errorTitle,
        unknownError
      );
    },
    onRevoke: () => {
      void revokeShareLink(
        chatId,
        generatedLink,
        actions,
        setGeneratedLink,
        setBusy,
        t("share_chat_link_revoked"),
        errorTitle,
        unknownError
      );
    },
  };
}

function useRecipientShareHandler({
  chatId,
  actions,
  email,
  setEmail,
  setBusy,
}: RecipientHandlerInputs): () => void {
  const { t } = useTranslation();
  return () => {
    void shareWithUser(
      chatId,
      email,
      actions,
      setEmail,
      setBusy,
      t("share_chat_user_success"),
      t("share_chat_error"),
      t("unknown_error")
    );
  };
}

function useShareDialogHandlers(
  inputs: ShareDialogViewProps
): ShareDialogHandlers {
  const linkHandlers = useShareLinkHandlers(inputs);
  const onShare = useRecipientShareHandler(inputs);
  return { ...linkHandlers, onShare };
}

function ChatShareDialogBody({
  generatedLink,
  busy,
  email,
  setEmail,
  handlers,
}: {
  generatedLink: GeneratedLink | null;
  busy: boolean;
  email: string;
  setEmail: Dispatch<SetStateAction<string>>;
  handlers: ShareDialogHandlers;
}) {
  return (
    <Dialog.Body>
      <Stack gap="5">
        <ChatShareLinkSection
          generatedLink={generatedLink}
          busy={busy}
          onCreate={handlers.onCreate}
          onCopy={handlers.onCopy}
          onRevoke={handlers.onRevoke}
        />
        <ChatShareUserSection
          email={email}
          busy={busy}
          setEmail={setEmail}
          onShare={handlers.onShare}
        />
      </Stack>
    </Dialog.Body>
  );
}

function ShareDialogTrigger({
  setOpen,
}: {
  setOpen: ShareDialogViewProps["setOpen"];
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Trigger asChild>
      <IconButton
        aria-label={t("share_chat")}
        title={t("share_chat")}
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <LuShare />
      </IconButton>
    </Dialog.Trigger>
  );
}

function ShareDialogHeader() {
  const { t } = useTranslation();
  return (
    <Dialog.Header>
      <Dialog.Title>{t("share_chat")}</Dialog.Title>
    </Dialog.Header>
  );
}

export function ChatShareDialogView(props: ShareDialogViewProps) {
  const {
    open,
    setOpen,
    chatId,
    actions,
    email,
    setEmail,
    busy,
    setBusy,
    generatedLink,
    setGeneratedLink,
  } = props;
  const { t } = useTranslation();
  const handlers = useShareDialogHandlers(props);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(event) => setOpen(event.open)}
      size="md"
    >
      <ShareDialogTrigger setOpen={setOpen} />
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger asChild>
            <IconButton aria-label={t("close")} variant="ghost">
              <LuX />
            </IconButton>
          </Dialog.CloseTrigger>
          <ShareDialogHeader />
          <ChatShareDialogBody
            generatedLink={generatedLink}
            busy={busy}
            email={email}
            setEmail={setEmail}
            handlers={handlers}
          />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
