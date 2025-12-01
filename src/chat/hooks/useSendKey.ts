import { useEffect } from "react";

export function useSendKey(callback, key) {
  useEffect(() => {
    const handleEnter = (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        callback?.();
      }
    };

    const handleCtrlEnter = (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        callback?.();
      }
    };

    const handleAltEnter = (event) => {
      if (event.key === "Enter" && event.altKey) {
        event.preventDefault();
        callback?.();
      }
    };

    const HANDLER = {
      ENTER: handleEnter,
      COMMAND_ENTER: handleCtrlEnter,
      ALT_ENTER: handleAltEnter,
    };

    const handler = HANDLER[key];
    if (handler) {
      document.addEventListener("keydown", handler);
      return () => {
        document.removeEventListener("keydown", handler);
      };
    }
  }, [callback, key]);
}
