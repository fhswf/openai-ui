import type { Chat } from "../context/types";
import { v7 as uuidv7 } from "uuid";

export type ChatAttachmentReference = {
  filename: string;
  opfsName: string;
  attachmentId?: string;
  kind: "image" | "file";
  size?: number;
  type?: string;
};

function addReference(
  references: Map<string, ChatAttachmentReference>,
  reference: ChatAttachmentReference
) {
  const key = `${reference.attachmentId ?? ""}\u0000${reference.opfsName}`;
  if (!references.has(key)) references.set(key, reference);
}

/** Collect the OPFS-backed files referenced by a chat, keeping one row per file. */
export function getChatAttachmentReferences(
  chat: Chat | null | undefined
): ChatAttachmentReference[] {
  const references = new Map<string, ChatAttachmentReference>();
  for (const message of chat?.messages ?? []) {
    if (Array.isArray(message.content)) {
      for (const item of message.content as any[]) {
        if (item?.type === "input_image" && item.image_url?.startsWith("opfs://")) {
          addReference(references, {
            filename: item.name || item.image_url.slice("opfs://".length),
            opfsName: item.image_url.slice("opfs://".length),
            attachmentId: item.attachmentId,
            kind: "image",
            size: item.size,
            type: item.mimeType,
          });
        } else if (item?.type === "input_file" && item.filename) {
          addReference(references, {
            filename: item.filename,
            opfsName: item.opfsName || item.filename,
            attachmentId: item.attachmentId,
            kind: "file",
            size: item.size,
            type: item.mimeType,
          });
        }
      }
    }

    if (message.images && typeof message.images === "object") {
      for (const image of Object.values(message.images) as any[]) {
        const isOpfsImage =
          image?.url?.startsWith("opfs://") ||
          image?.file_id ||
          (!image?.url && image?.name);
        if (!isOpfsImage) continue;
        const filename = image?.url?.startsWith("opfs://")
          ? image.url.slice("opfs://".length)
          : image?.name;
        if (!filename) continue;
        addReference(references, {
          filename: image?.name || filename,
          opfsName: filename,
          attachmentId: image.id ?? image.file_id,
          kind: "image",
          size: image.size,
          type: image.type?.startsWith("image/") ? image.type : undefined,
        });
      }
    }
  }
  return Array.from(references.values());
}

/** Add opaque IDs to legacy OPFS references before they enter vault storage. */
export function ensureChatAttachmentIds(chat: Chat): void {
  const idByOpfsName = new Map<string, string>();
  const remember = (opfsName: string, attachmentId?: string): string => {
    const existing = idByOpfsName.get(opfsName);
    if (existing) return existing;
    const id = attachmentId || uuidv7();
    idByOpfsName.set(opfsName, id);
    return id;
  };

  for (const message of chat.messages ?? []) {
    if (Array.isArray(message.content)) {
      for (const item of message.content as any[]) {
        if (item?.type === "input_image" && item.image_url?.startsWith("opfs://")) {
          const opfsName = item.image_url.slice("opfs://".length);
          item.attachmentId = remember(opfsName, item.attachmentId);
        } else if (item?.type === "input_file" && item.filename) {
          const opfsName = item.opfsName || item.filename;
          item.attachmentId = remember(opfsName, item.attachmentId);
        }
      }
    }

    if (message.images && typeof message.images === "object") {
      for (const image of Object.values(message.images) as any[]) {
        const isOpfsImage =
          image?.url?.startsWith("opfs://") ||
          image?.file_id ||
          (!image?.url && image?.name);
        if (!isOpfsImage) continue;
        const opfsName = image?.url?.startsWith("opfs://")
          ? image.url.slice("opfs://".length)
          : image?.name;
        if (!opfsName) continue;
        image.id = remember(opfsName, image.id || image.file_id);
      }
    }
  }
}
