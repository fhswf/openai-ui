import { useCallback, useEffect, useRef } from "react";

/** Debounce a callback, with explicit controls for pending work. */
export function useDebounce<TArgs extends unknown[]>(
  callback: (..._args: TArgs) => void,
  delay: number,
  flushOnUnmount = false
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<TArgs | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingArgsRef.current = null;
  }, []);

  const flush = useCallback(() => {
    if (timeoutRef.current === null) {
      return;
    }
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const args = pendingArgsRef.current;
    pendingArgsRef.current = null;
    if (args !== null) {
      callbackRef.current(...args);
    }
  }, []);

  const run = useCallback(
    (...args: TArgs) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      pendingArgsRef.current = args;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        const pendingArgs = pendingArgsRef.current;
        pendingArgsRef.current = null;
        if (pendingArgs !== null) {
          callbackRef.current(...pendingArgs);
        }
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (flushOnUnmount) {
        flush();
      } else {
        cancel();
      }
    };
  }, [cancel, flush, flushOnUnmount]);

  return { run, cancel, flush };
}
