import React, { useEffect, useState } from "react";
import { useGlobal } from "./context";
import { ChatShareDialogView, type GeneratedLink } from "./ChatShareDialogView";

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
  const selectedChat = chat?.[currentChat];
  const chatId = selectedChat ? String(selectedChat.id) : "";
  const canShare = Boolean(options.general.zkStorage && vaultReady && chatId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(
    null
  );

  useEffect(() => {
    setGeneratedLink(null);
    setEmail("");
  }, [chatId]);

  if (!canShare) return null;
  return (
    <ChatShareDialogView
      open={open}
      setOpen={setOpen}
      chatId={chatId}
      actions={{ shareChatWithUser, createChatShareLink, revokeChatShareLink }}
      email={email}
      setEmail={setEmail}
      busy={busy}
      setBusy={setBusy}
      generatedLink={generatedLink}
      setGeneratedLink={setGeneratedLink}
    />
  );
}
