import { useEffect } from "react";
import { useGlobal } from "../context";
import {
  OpenAIOptions,
  OptionActionType,
} from "../context/types";

export function useOptions() {
  const { options, setOptions } = useGlobal();
  const { size, theme } = options.general;
  useEffect(() => {
    const body = document.querySelector("html");
    if (!body) return;
    body.className = "";
    body.dataset.theme = theme;
    body.dataset.size = size;
    body.classList.add(theme, size);
  }, [theme, size]);

  const setAccount = (data = {}) => {
    setOptions({
      type: OptionActionType.ACCOUNT,
      data,
    });
  };

  const setGeneral = (data = {}) => {
    console.log("setGeneral: %o", data);
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
