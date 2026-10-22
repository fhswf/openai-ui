import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollView } from "../ScrollView";

// `useGlobal` is replaced with a mutable object so a test can simulate new
// chat content arriving (a streaming answer) between renders.
const mockGlobal = vi.hoisted(() => ({
  current: {
    is: { thinking: false },
    chat: [{ messages: [] }],
    currentChat: 0,
  } as any,
}));

vi.mock("../../context", () => ({
  useGlobal: () => mockGlobal.current,
}));

describe("ScrollView", () => {
  let container: HTMLDivElement;
  let root: Root;
  let triggerRerender: () => void;

  function Harness() {
    const [, setTick] = React.useState(0);
    triggerRerender = () => setTick((tick) => tick + 1);
    return (
      <ScrollView data-testid="scroll">
        <div data-testid="content" />
      </ScrollView>
    );
  }

  function scrollEl() {
    return container.querySelector('[data-testid="scroll"]') as HTMLElement;
  }

  function stubMetrics(
    el: HTMLElement,
    state: { height: number; client: number }
  ) {
    Object.defineProperty(el, "scrollHeight", {
      configurable: true,
      get: () => state.height,
    });
    Object.defineProperty(el, "clientHeight", {
      configurable: true,
      get: () => state.client,
    });
  }

  function renderWith(chat: any, currentChat = 0) {
    mockGlobal.current = { ...mockGlobal.current, chat, currentChat };
    act(() => {
      triggerRerender();
    });
  }

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mockGlobal.current = {
      is: { thinking: false },
      chat: [{ messages: [] }],
      currentChat: 0,
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Harness />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it("scrolls to the bottom when an answer is appended", () => {
    const el = scrollEl();
    const metrics = { height: 100, client: 100 };
    stubMetrics(el, metrics);
    el.scrollTop = 0;

    metrics.height = 500;
    renderWith([{ messages: [{ role: "assistant", content: "answer" }] }]);

    expect(el.scrollTop).toBe(500);
  });

  it("keeps following in-place growth while the user is at the bottom", () => {
    const el = scrollEl();
    const metrics = { height: 200, client: 100 };
    stubMetrics(el, metrics);
    renderWith([{ messages: [{ role: "assistant", content: "stream" }] }]);
    // Simulate the view already scrolled to the bottom.
    el.scrollTop = 100;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });

    metrics.height = 300;
    renderWith([
      { messages: [{ role: "assistant", content: "streaming..." }] },
    ]);

    expect(el.scrollTop).toBe(300);
  });

  it("does not yank the view down when the user scrolled up to read history", () => {
    const el = scrollEl();
    const metrics = { height: 2000, client: 100 };
    stubMetrics(el, metrics);
    renderWith([{ messages: [{ role: "assistant", content: "stream" }] }]);
    // User is far from the bottom.
    el.scrollTop = 0;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });

    metrics.height = 2400;
    renderWith([
      { messages: [{ role: "assistant", content: "streaming..." }] },
    ]);

    expect(el.scrollTop).toBe(0);
  });

  it("scrolls down for a newly appended message even if the user scrolled up", () => {
    const el = scrollEl();
    const metrics = { height: 2000, client: 100 };
    stubMetrics(el, metrics);
    el.scrollTop = 0;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });

    metrics.height = 2600;
    renderWith([
      { messages: [{ role: "assistant", content: "answer" }] },
      { messages: [] },
    ]);

    expect(el.scrollTop).toBe(2600);
  });

  it("jumps to the bottom when the active chat changes", () => {
    const el = scrollEl();
    const metrics = { height: 2000, client: 100 };
    stubMetrics(el, metrics);
    el.scrollTop = 0;
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });

    renderWith(
      [{ messages: [] }, { messages: [{ role: "assistant", content: "hi" }] }],
      1
    );

    expect(el.scrollTop).toBe(2000);
  });
});
