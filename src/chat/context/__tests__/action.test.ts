import { describe, it, expect, vi, beforeEach } from "vitest";
import action from "../action";

vi.mock("../../service/openai", () => ({
  createResponse: vi.fn(() => Promise.resolve()),
}));

vi.mock("uuid", () => ({ v7: () => "uuid" }));

vi.mock("i18next", () => ({
  default: { changeLanguage: vi.fn() },
  t: (key: string) => key,
}));

import { createResponse } from "../../service/openai";

function buildState(messages: { role: string; content: string }[]) {
  return {
    chat: [{ id: "chat-1", messages }],
    currentChat: 0,
    options: {
      account: {},
      general: {},
      openai: {},
    },
    is: { thinking: false, tool: null },
    typeingMessage: {},
  };
}

describe("retryPendingMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resends the last user message after login", () => {
    const dispatch = vi.fn();
    const state = buildState([
      { role: "assistant", content: "welcome" },
      { role: "user", content: "hello" },
    ]);

    const actions = action(state, dispatch);
    actions.retryPendingMessage();

    expect(createResponse).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "SET_STATE",
      payload: {
        is: expect.objectContaining({ thinking: true, tool: null }),
      },
    });
  });

  it("does not retry when the assistant already answered", () => {
    const dispatch = vi.fn();
    const state = buildState([
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ]);

    const actions = action(state, dispatch);
    actions.retryPendingMessage();

    expect(createResponse).not.toHaveBeenCalled();
  });
});
