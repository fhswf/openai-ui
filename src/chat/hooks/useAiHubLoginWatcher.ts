import { useCallback, useEffect, useRef, useState } from "react";
import { startLoginPolling } from "../utils/aiHubLoginPolling";

interface UseAiHubLoginWatcherProps {
  /** Resolves to true when waiting should end. */
  retry: () => Promise<boolean>;
  onTimeout: () => void;
}

/**
 * Waits for the user to sign in to the AI-Hub in another window by calling
 * `retry` until it succeeds. Polling stops when waiting ends or the
 * component unmounts.
 */
export function useAiHubLoginWatcher({
  retry,
  onTimeout,
}: UseAiHubLoginWatcherProps) {
  const [isWaiting, setIsWaiting] = useState(false);
  // Keep the latest callbacks so polling always uses the current options.
  const retryRef = useRef(retry);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    retryRef.current = retry;
    onTimeoutRef.current = onTimeout;
  });

  useEffect(() => {
    if (!isWaiting) return undefined;

    return startLoginPolling({
      retry: () => retryRef.current(),
      onFinished: () => setIsWaiting(false),
      onTimeout: () => {
        setIsWaiting(false);
        onTimeoutRef.current();
      },
    });
  }, [isWaiting]);

  const startWaiting = useCallback(() => setIsWaiting(true), []);
  const stopWaiting = useCallback(() => setIsWaiting(false), []);

  return { isWaiting, startWaiting, stopWaiting };
}
