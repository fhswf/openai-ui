import { useEffect } from "react";
import { useGlobal } from "../context";
import {
  OpenAIOptions,
  OptionActionType,
} from "../context/types";

function applyDocumentAppearance(theme: string, size: string) {
  const root = document.documentElement;
  root.className = "";
  root.dataset.theme = theme;
  root.dataset.size = size;
  root.classList.add(theme, size);
}

export function useOptions() {
  const { options, setOptions } = useGlobal();
  const { size, theme } = options.general;
  useEffect(() => {
    applyDocumentAppearance(theme, size);
  }, [theme, size]);

  const setAccount = (data = {}) => {
    setOptions({
      type: OptionActionType.ACCOUNT,
      data,
    });
  };

  const setGeneral = (data = {}) => {
    console.log("setGeneral: %o", data);
    const nextTheme = "theme" in data ? data.theme : options.general.theme;
    const nextSize = "size" in data ? data.size : options.general.size;

    if (
      typeof nextTheme === "string" &&
      typeof nextSize === "string" &&
      ("theme" in data || "size" in data)
    ) {
      applyDocumentAppearance(nextTheme, nextSize);
    }

    setOptions({
      type: OptionActionType.GENERAL,
      data,
    });
  };

  const setAPIMode = (val) => {
    console.log("setAPIMode: %o", val);
    const openai: OpenAIOptions = { ...options.openai, mode: val };
    setOptions({
      type: OptionActionType.OPENAI,
      data: openai,
    });
  };

  const setModel = (data) => {
    setOptions({
      type: OptionActionType.OPENAI,
      data,
    });
  };

  const setAssistant = (data: string) => {
    console.log("setAssistant: %o", data);
    const openai: OpenAIOptions = { ...options.openai, assistant: data };
    setOptions({
      type: OptionActionType.OPENAI,
      data: openai,
    });
  };

  return { setAccount, setAPIMode, setModel, setAssistant, setGeneral };
}
