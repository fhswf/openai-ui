import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatProvider, useGlobal } from "../index";
import type { GlobalActions, GlobalState } from "../types";
import { saveState } from "../../utils/settings";

vi.mock("../../utils", () => ({
  fetchAndGetUser: vi.fn(),
  toolOptions: new Map(),
}));

vi.mock("../../service/openai", () => ({
  createResponse: vi.fn(),
}));

vi.mock("../../utils/settings", () => ({
  CHAT_HISTORY_KEY: "CHAT_HISTORY",
  SESSION_KEY: "SESSIONS",
  loadState: vi.fn(() => Promise.resolve({})),
  reviver: (_key: string, value: unknown) => value,
  saveState: vi.fn(),
}));

describe("ChatProvider draft persistence", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: GlobalActions & GlobalState;

  function Probe() {
    latest = useGlobal();
    return null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <ChatProvider>
          <Probe />
        </ChatProvider>
      );
    });
    vi.mocked(saveState).mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps the draft current but saves once after typing stops", () => {
    act(() => {
      latest.setMessage("h");
    });
    expect(latest.typeingMessage.content).toBe("h");
    expect(saveState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      latest.setMessage("hello");
    });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(saveState).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveState).mock.lastCall?.[0].typeingMessage.content).toBe(
      "hello"
    );
  });

  it("saves other state changes immediately and cancels a pending draft save", () => {
    act(() => {
      latest.setMessage("hello");
    });
    act(() => {
      latest.clearTypeing();
    });

    expect(saveState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveState).mock.lastCall?.[0].typeingMessage).toEqual({});
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(saveState).toHaveBeenCalledTimes(1);
  });

  it("saves immediately when typing and another action share a render", () => {
    act(() => {
      latest.setMessage("hello");
      latest.clearTypeing();
    });

    expect(saveState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveState).mock.lastCall?.[0].typeingMessage).toEqual({});
  });

  it("flushes a pending draft save when the page closes", () => {
    act(() => {
      latest.setMessage("unfinished");
    });
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(saveState).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveState).mock.lastCall?.[0].typeingMessage.content).toBe(
      "unfinished"
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(saveState).toHaveBeenCalledTimes(1);
  });
});
