import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { v7 as uuidv7 } from "uuid";
import { toaster } from "../components/ui/toaster";
import { useGlobal } from "./context";
import type { Chat } from "./context/types";
import { chatVault, VaultError } from "./service/chatVault";
import { getAttachmentStorageId } from "./utils/attachments";
import { getChatAttachmentReferences } from "./utils/chatAttachments";
import {
  base64UrlToBuffer,
  decryptAttachmentData,
  decryptChatData,
  getAttachmentAdditionalData,
} from "./utils/zeroKnowledgeCrypto";

function restorePendingLinkFragment() {
  try {
    const fragment = sessionStorage.getItem("pending-zk-chat-share");
    sessionStorage.removeItem("pending-zk-chat-share");
    if (new URLSearchParams(window.location.hash.slice(1)).has("zkShare")) {
      return;
    }
    if (!fragment || !new URLSearchParams(fragment.slice(1)).has("zkShare")) {
      return;
    }
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${fragment}`
    );
  } catch (error) {
    console.warn("Unable to restore the chat share link after sign-in:", error);
  }
}

function consumeLinkParams() {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get("zkShare");
  if (!token) return null;
  const key = fragment.get("zkKey");
  url.hash = "";
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}`
  );
  return { token, key };
}

async function restoreSharedAttachments(
  chat: Chat,
  originalChatId: string,
  token: string,
  chatKey: CryptoKey
): Promise<void> {
  const references = getChatAttachmentReferences(chat);
  if (!references.length) return;

  const opfs = await navigator.storage.getDirectory();
  const renamed = new Map<string, string>();
  const unavailable = new Set<string>();

  for (const reference of references) {
    if (renamed.has(reference.opfsName) || unavailable.has(reference.opfsName)) {
      continue;
    }
    const attachmentId = await getAttachmentStorageId(
      reference.attachmentId,
      reference.opfsName
    );
    try {
      const encrypted = await chatVault.redeemShareLinkAttachment(
        token,
        attachmentId
      );
      const plaintext = await decryptAttachmentData(
        encrypted,
        chatKey,
        getAttachmentAdditionalData(originalChatId, attachmentId)
      );
      const extension = reference.opfsName.match(/\.[^./\\]+$/)?.[0] ?? "";
      const newName = `attachment-${uuidv7()}${extension}`;
      const handle = await opfs.getFileHandle(newName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(plaintext);
      await writable.close();
      renamed.set(reference.opfsName, newName);
    } catch (error) {
      if (error instanceof VaultError && error.status === 404) {
        unavailable.add(reference.opfsName);
        continue;
      }
      throw error;
    }
  }

  for (const message of chat.messages ?? []) {
    if (Array.isArray(message.content)) {
      message.content = message.content.filter((item: any) => {
        const imageName = item?.image_url?.startsWith("opfs://")
          ? item.image_url.slice("opfs://".length)
          : null;
        const fileName = item?.opfsName || item?.filename;
        const oldName = imageName ?? (item?.type === "input_file" ? fileName : null);
        if (!oldName) return true;
        if (unavailable.has(oldName)) return false;
        const newName = renamed.get(oldName);
        if (!newName) return true;
        if (imageName) item.image_url = `opfs://${newName}`;
        if (item?.type === "input_file") item.opfsName = newName;
        return true;
      });
    }

    if (message.images && typeof message.images === "object") {
      for (const [key, image] of Object.entries(message.images) as [string, any][]) {
        const oldName = image?.url?.startsWith("opfs://")
          ? image.url.slice("opfs://".length)
          : image?.name;
        if (!oldName) continue;
        if (unavailable.has(oldName)) {
          delete message.images[key];
          continue;
        }
        const newName = renamed.get(oldName);
        if (newName) {
          image.url = `opfs://${newName}`;
        }
      }
    }
  }
}

export function ZkChatShareHandler() {
  const { importSharedChat } = useGlobal();
  const { t } = useTranslation();

  useEffect(() => {
    restorePendingLinkFragment();
    const params = consumeLinkParams();
    if (!params) return;

    const importChat = async () => {
      if (!params.key) throw new Error("This share link has no decryption key");
      const rawKey = base64UrlToBuffer(params.key);
      if (rawKey.byteLength !== 32) throw new Error("Invalid share key");
      const chatKey = await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      const encrypted = await chatVault.redeemShareLink(params.token);
      const shared = await decryptChatData<Chat>(encrypted, chatKey);
      await restoreSharedAttachments(shared, encrypted.id, params.token, chatKey);
      const imported: Chat = {
        ...shared,
        id: uuidv7(),
        ct: Date.now(),
        vault: undefined,
      };
      importSharedChat(imported);
      toaster.create({
        title: t("share_chat_link_loaded"),
        duration: 6000,
        type: "success",
      });
    };

    void importChat().catch((error) => {
      console.error("Could not open the shared encrypted chat:", error);
      toaster.create({
        title: t("share_chat_link_load_error"),
        description: error instanceof Error ? error.message : t("unknown_error"),
        duration: 8000,
        type: "error",
      });
    });
  }, [importSharedChat, t]);

  return null;
}
