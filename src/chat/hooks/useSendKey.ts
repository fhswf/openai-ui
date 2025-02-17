import { useEffect } from "react";

export function useSendKey(callback, key) {

  const handleCtrlEnter = (event) => {
    if (event.ctrlKey && event.keyCode === 13) {
      event.preventDefault();
      callback && callback();
    }
  };

  const handleAltEnter = (event) => {
    if (event.altKey && event.keyCode === 13) {
      event.preventDefault();
      callback && callback();
    }
  };
  const handleEnter = (event) => {
    if (event.keyCode === 13) {
      event.preventDefault();
      callback && callback();
    }
  };

  const HANDLER = {
    ENTER: handleEnter,
    COMMAND_ENTER: handleCtrlEnter,
    ALT_ENTER: handleAltEnter,
  };

  useEffect(() => {
    document.removeEventListener("keydown", handleCtrlEnter);
    document.removeEventListener("keydown", handleAltEnter);
    document.removeEventListener("keydown", handleEnter);
    document.addEventListener("keydown", HANDLER[key]);
    return () => {
      document.removeEventListener("keydown", HANDLER[key]);
    };
  }, [callback, key]);
}
