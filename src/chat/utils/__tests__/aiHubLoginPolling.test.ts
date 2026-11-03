import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startLoginPolling } from "../aiHubLoginPolling";

function createFocusTarget() {
  const target = new EventTarget();
  return {
    target: target as unknown as Window,
    focus: () => target.dispatchEvent(new Event("focus")),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("startLoginPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries on every interval until retry succeeds", async () => {
    const retry = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const onFinished = vi.fn();
    const { target } = createFocusTarget();

    startLoginPolling({
      retry,
      onFinished,
      onTimeout: vi.fn(),
      focusTarget: target,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    expect(onFinished).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(onFinished).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("retries right away when the window gets the focus back", async () => {
    const retry = vi.fn().mockResolvedValue(true);
    const { target, focus } = createFocusTarget();

    startLoginPolling({
      retry,
      onFinished: vi.fn(),
      onTimeout: vi.fn(),
      focusTarget: target,
    });

    focus();
    await vi.advanceTimersByTimeAsync(0);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("never runs two attempts at the same time", async () => {
    const slowAttempt = deferred<boolean>();
    const retry = vi.fn().mockReturnValue(slowAttempt.promise);
    const { target, focus } = createFocusTarget();

    startLoginPolling({
      retry,
      onFinished: vi.fn(),
      onTimeout: vi.fn(),
      focusTarget: target,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    focus();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(retry).toHaveBeenCalledTimes(1);

    slowAttempt.resolve(true);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("gives up after the timeout", async () => {
    const retry = vi.fn().mockResolvedValue(false);
    const onTimeout = vi.fn();
    const { target } = createFocusTarget();

    startLoginPolling({
      retry,
      onFinished: vi.fn(),
      onTimeout,
      timeoutMs: 10_000,
      focusTarget: target,
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    const callsAtTimeout = retry.mock.calls.length;

    await vi.advanceTimersByTimeAsync(30_000);
    expect(retry).toHaveBeenCalledTimes(callsAtTimeout);
  });

  it("stops retrying when stop is called", async () => {
    const retry = vi.fn().mockResolvedValue(false);
    const { target, focus } = createFocusTarget();

    const stop = startLoginPolling({
      retry,
      onFinished: vi.fn(),
      onTimeout: vi.fn(),
      focusTarget: target,
    });
    stop();

    focus();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(retry).not.toHaveBeenCalled();
  });
});
