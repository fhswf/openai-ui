import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock() is hoisted above all imports, so anything it references must be
// created with vi.hoisted() to exist at that point.
const { create } = vi.hoisted(() => ({
  // Never resolves: we only want the request, not the streaming response.
  create: vi.fn((_request: unknown) => new Promise(() => {})),
}));

vi.mock("openai", () => {
  class OpenAI {
    responses = { create };
  }
  class APIError extends Error {}
  return { default: OpenAI, APIError };
});

vi.mock("../../../components/ui/toaster", () => ({
  toaster: { create: vi.fn() },
}));
vi.mock("../../component/McpToast", () => ({ showMcpApprovalToast: vi.fn() }));
vi.mock("@sentry/react", () => ({ captureException: vi.fn() }));

import { createResponse } from "../openai";

const customGpt = {
  id: "gpt-1",
  name: "Tutor",
  systemPrompt: "Current GPT prompt",
};

function buildGlobal(app: number | string) {
  return {
    options: {
      account: {},
      general: { customGpts: [customGpt] },
      openai: {
        apiKey: "test-key",
        baseUrl: "https://api.example.test/v1",
        model: "gpt-5.4-mini",
        reasoningEffort: "medium",
        tools: new Map([
          ["Web Search", { type: "web_search_preview" }],
          ["Code Interpreter", { type: "code_interpreter" }],
        ]),
        toolsEnabled: new Set(["Web Search"]),
      },
    },
    chat: [
      {
        id: "chat-1",
        app,
        messages: [
          { id: "m1", role: "system", content: "Stored prompt copy" },
          { id: "m2", role: "user", content: "Hello" },
        ],
      },
    ],
    currentChat: 0,
    setState: vi.fn(),
    setIs: vi.fn(),
    setOptions: vi.fn(),
  } as any;
}

// The request every chat without a custom GPT sends today. Later changes for
// per-GPT settings must not alter it.
const globalRequest = {
  model: "gpt-5.4-mini",
  tools: [{ type: "web_search_preview" }],
  tool_choice: "auto",
  input: [
    { role: "system", content: "Stored prompt copy" },
    { role: "user", content: "Hello" },
  ],
  stream: true,
  include: ["web_search_call.action.sources", "code_interpreter_call.outputs"],
  reasoning: { effort: "medium", summary: "detailed" },
};

describe("createResponse request for chats without a custom GPT", () => {
  beforeEach(() => {
    create.mockClear();
  });

  it.each([
    ["the default chatbot", 0],
    ["a built-in app", 2],
    ["an unknown app id", "deleted-gpt"],
  ])("sends the global settings for %s", async (_label, app) => {
    await createResponse(buildGlobal(app), null);

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toEqual(globalRequest);
  });
});
