import { t } from "i18next";

export const shortcutKey = "Ctrl+Enter";
export const keyboard = {
  Command: "Window",
  Option: "Alt",
  Control: "Ctrl",
  Shift: "Shift",
};

export const keyboardArray = Object.values(keyboard);
export const themeOptions = [
  {
    label: "Auto",
    value: "auto",
  },
  {
    label: "Light",
    value: "light",
  },
  {
    label: "Dark",
    value: "dark",
  },
];

export const sendCommandOptions = [
  {
    label: "Enter",
    value: "ENTER",
  },
  {
    label: shortcutKey,
    value: "COMMAND_ENTER",
  },
  {
    label: "Alt+Enter",
    value: "ALT_ENTER",
  },
];

export const modeOptions = [
  {
    label: "Chat",
    value: "chat",
    description: t('chat_mode_desc'),
  },
  {
    label: "Assistant",
    value: "assistant",
    description: t('assistant_mode_desc'),
  }
]


export const modelOptions = [
  { label: "gpt-4o-mini", value: "gpt-4o-mini" },
  {
    label: "gpt-4-turbo", value: "gpt-4-turbo",
  },
  {
    label: "gpt-4", value: "gpt-4",
  },
  {
    label: "gpt-3.5-turbo", value: "gpt-3.5-turbo",
  },
];

export const languageOptions = [
  {
    label: "English",
    value: "en",
  },
  {
    label: "Deutsch",
    value: "de",
  },
];

export const sizeOptions = [
  {
    label: "Small",
    value: "small",
  },
  {
    label: "Default",
    value: "default",
  },
  {
    label: "Middle",
    value: "middle",
  },
  {
    label: "Large",
    value: "large",
  },
];
