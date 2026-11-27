import { describe, it, expect } from "vitest";
import { resolveCustomGptRequest } from "../customGptSettings";

const customGpt = {
  id: "gpt-1",
  name: "Tutor",
  systemPrompt: "Current prompt",
};

function buildOptions(customGpts: unknown[] = [customGpt]) {
  return {
    general: { customGpts },
    openai: {},
    account: {},
  } as any;
}

function buildChat(app: number | string) {
  return {
    id: "chat-1",
    app,
    title: "Chat",
    ct: 0,
    messages: [
      { id: "m1", role: "system", content: "Stored copy" },
      { id: "m2", role: "user", content: "Hello" },
    ],
  } as any;
}

describe("resolveCustomGptRequest", () => {
  it("returns the same objects for a chat without custom GPT", () => {
    const options = buildOptions();
    const chat = buildChat(1);

    const result = resolveCustomGptRequest(options, chat);

    expect(result.options).toBe(options);
    expect(result.messages).toBe(chat.messages);
    expect(result.customGpt).toBeUndefined();
  });

  it("uses the current GPT prompt in a GPT chat", () => {
    const chat = buildChat("gpt-1");

    const result = resolveCustomGptRequest(buildOptions(), chat);

    expect(result.customGpt).toBe(customGpt);
    expect(result.messages[0].content).toBe("Current prompt");
    expect(result.messages[1]).toBe(chat.messages[1]);
  });

  it("does not change the stored chat messages", () => {
    const chat = buildChat("gpt-1");

    resolveCustomGptRequest(buildOptions(), chat);

    expect(chat.messages[0].content).toBe("Stored copy");
  });

  it("keeps the stored copy when the GPT was deleted", () => {
    const chat = buildChat("gpt-1");

    const result = resolveCustomGptRequest(buildOptions([]), chat);

    expect(result.customGpt).toBeUndefined();
    expect(result.messages).toBe(chat.messages);
  });

  it("keeps the stored copy when the GPT prompt is empty", () => {
    const options = buildOptions([{ ...customGpt, systemPrompt: "   " }]);
    const chat = buildChat("gpt-1");

    const result = resolveCustomGptRequest(options, chat);

    expect(result.customGpt?.id).toBe("gpt-1");
    expect(result.messages).toBe(chat.messages);
  });
});
