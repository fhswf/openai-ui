import type { Chat, Message } from "../context/types";

/**
 * Plain-text search over chat transcripts.
 *
 * Message content is either a string or an array of typed parts. Only the
 * human-readable text of a part is searchable; image and file references are
 * reduced to their file names so a chat can still be found by attachment.
 */
export function messageToPlainText(message: Message): string {
  // `content` is typed as a string, but at runtime it is also an array of
  // typed parts. Read it through `unknown` so both shapes are handled.
  const content = message.content as unknown;
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part: Record<string, any>) => {
      switch (part?.type) {
        case "input_text":
          return part.text ?? "";
        case "input_image":
          return part.name ?? "";
        case "input_file":
          return part.filename ?? "";
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

export function chatToPlainText(chat: Chat): string {
  const parts = [chat.title, ...chat.messages.map(messageToPlainText)];
  return parts.filter(Boolean).join("\n");
}

function normalize(value: string): string {
  return value.toLocaleLowerCase();
}

/**
 * A chat matches when the query occurs in its title or in any message text.
 * Placeholder chats whose transcript is not loaded yet match against their
 * locally stored preview.
 */
export function matchesChatQuery(chat: Chat, query: string): boolean {
  const needle = normalize(query.trim());
  if (!needle) {
    return true;
  }
  if (chat.messages?.length) {
    return normalize(chatToPlainText(chat)).includes(needle);
  }
  return normalize(`${chat.title}\n${chat.vault?.preview ?? ""}`).includes(
    needle
  );
}
