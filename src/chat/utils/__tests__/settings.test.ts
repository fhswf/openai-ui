import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat, GlobalState } from "../../context/types";
import { initState } from "../../context/initState";
import { CHAT_HISTORY_KEY, saveState } from "../settings";

vi.mock("../../../components/ui/toaster", () => ({
  toaster: { create: vi.fn() },
}));

function buildState(zkLazyHistory: boolean, chat: Chat[]): GlobalState {
  return {
    ...initState,
    chat,
    options: {
      ...initState.options,
      general: { ...initState.options.general, zkLazyHistory },
    },
  };
}

function makeVaultChat(): Chat {
  return {
    id: "c1",
    title: "Chat",
    app: 0,
    ct: 1,
    messages: [
      { id: "m1", role: "user", content: "hello" },
      { id: "m2", role: "assistant", content: "hi" },
    ],
    vault: {
      rev: 1,
      ownerId: "user-1",
      messageCount: 2,
      preview: "hello",
      updatedAt: 1,
    },
  };
}

describe("saveState with lazy vault history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("drops the transcripts of vault chats from localStorage", () => {
    saveState(buildState(true, [makeVaultChat()]));

    const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
    expect(stored[0].messages).toEqual([]);
    expect(stored[0].vault).toMatchObject({ rev: 1, messageCount: 2 });
  });

  it("keeps transcripts when lazy history is disabled", () => {
    saveState(buildState(false, [makeVaultChat()]));

    const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
    expect(stored[0].messages).toHaveLength(2);
  });

  it("keeps local-only chats untouched", () => {
    const localChat: Chat = {
      id: "local",
      title: "Local",
      app: 0,
      ct: 1,
      messages: [{ id: "m1", role: "user", content: "keep me" }],
    };
    saveState(buildState(true, [localChat]));

    const stored = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY)!);
    expect(stored[0].messages).toHaveLength(1);
  });
});
