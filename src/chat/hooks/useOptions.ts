import { useEffect } from "react";
import { useGlobal } from "../context";
import { GlobalActionType, OpenAIOptions, OptionActionType } from "../context/types";

export function useOptions() {
  const { options, setOptions } = useGlobal();
  const { size, theme } = options.general;
  useEffect(() => {
    const body = document.querySelector("html");
    //body.classList = [];
    body.setAttribute("data-theme", theme);
    body.setAttribute("data-size", size);
    console.log("theme: %o, size: %o", theme, size);
    body.classList.add(theme);
    body.classList.add(size);
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

  const setAPIMode = (val => {
    console.log("setAPIMode: %o", val);
    const openai: OpenAIOptions = { ...options.openai, mode: val };
    setOptions({
      type: OptionActionType.OPENAI,
      data: openai,
    });
  })

  const setModel = (data = {}) => {
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
  }

  return { setAccount, setAPIMode, setModel, setAssistant, setGeneral };
}
