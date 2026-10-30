type FocusTarget = Pick<Window, "addEventListener" | "removeEventListener">;

export interface LoginPollingOptions {
  /** Resolves to true when waiting should end. */
  retry: () => Promise<boolean>;
  onFinished: () => void;
  onTimeout: () => void;
  intervalMs?: number;
  timeoutMs?: number;
  focusTarget?: FocusTarget;
}

/**
 * Calls `retry` every few seconds and whenever the window gets the focus
 * back, until `retry` resolves to true or the timeout is reached. Only one
 * attempt runs at a time, so a slow attempt never overlaps with the next one.
 * Returns a function that stops the polling.
 */
export function startLoginPolling({
  retry,
  onFinished,
  onTimeout,
  intervalMs = 3_000,
  timeoutMs = 5 * 60_000,
  focusTarget = window,
}: LoginPollingOptions) {
  let stopped = false;
  let inFlight = false;

  async function attempt() {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      if ((await retry()) && !stopped) {
        stop();
        onFinished();
      }
    } catch (error) {
      console.warn("AI-Hub login retry failed:", error);
    } finally {
      inFlight = false;
    }
  }

  const onFocus = () => void attempt();
  const interval = setInterval(onFocus, intervalMs);
  const timeout = setTimeout(() => {
    stop();
    onTimeout();
  }, timeoutMs);
  focusTarget.addEventListener("focus", onFocus);

  function stop() {
    stopped = true;
    clearInterval(interval);
    clearTimeout(timeout);
    focusTarget.removeEventListener("focus", onFocus);
  }

  return stop;
}
