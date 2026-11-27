import type { Chat, CustomGpt, Messages, Options } from "../context/types";

export type ResolvedCustomGptRequest = {
  options: Options;
  messages: Messages;
  customGpt?: CustomGpt;
};

export function findCustomGptForChat(
  options: Options,
  chat: Chat,
): CustomGpt | undefined {
  const customGpts = Array.isArray(options.general.customGpts)
    ? options.general.customGpts
    : [];
  return customGpts.find((customGpt) => customGpt.id === chat.app);
}

function applyCustomGptPrompt(
  messages: Messages,
  customGpt: CustomGpt,
): Messages {
  const currentPrompt = customGpt.systemPrompt.trim();
  if (!currentPrompt) {
    return messages;
  }
  const systemIndex = messages.findIndex(
    (message) => message.role === "system",
  );
  return messages.map((message, index) =>
    index === systemIndex ? { ...message, content: currentPrompt } : message,
  );
}

export function resolveCustomGptRequest(
  options: Options,
  chat: Chat,
): ResolvedCustomGptRequest {
  const customGpt = findCustomGptForChat(options, chat);
  if (!customGpt) {
    return { options, messages: chat.messages };
  }
  return {
    options,
    messages: applyCustomGptPrompt(chat.messages, customGpt),
    customGpt,
  };
}
