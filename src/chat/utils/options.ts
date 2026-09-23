import { t } from "i18next";
import { Tool } from "openai/resources/responses/responses.mjs";
import { OpenAIOptions } from "../context/types";

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
    description: t("chat_mode_desc"),
  },
  {
    label: "Assistant",
    value: "assistant",
    description: t("assistant_mode_desc"),
  },
];

export const modelOptions = [
  { label: "gpt-6-luna", value: "gpt-6-luna" },
  { label: "gpt-5.6-luna", value: "gpt-5.6-luna" },
  { label: "gpt-5.4-mini", value: "gpt-5.4-mini" },
  { label: "gpt-5.4-nano", value: "gpt-5.4-nano" },
  { label: "gpt-5-mini", value: "gpt-5-mini" },
  { label: "gpt-5-nano", value: "gpt-5-nano" },
  { label: "gpt-4.1-mini", value: "gpt-4.1-mini" },
  { label: "gpt-4.1-nano", value: "gpt-4.1-nano" },
  { label: "gpt-4o-mini", value: "gpt-4o-mini" },
  {
    label: "gpt-4-turbo",
    value: "gpt-4-turbo",
  },
  {
    label: "gpt-4",
    value: "gpt-4",
  },
  {
    label: "gpt-3.5-turbo",
    value: "gpt-3.5-turbo",
  },
];

export interface ModelOption {
  label: string;
  value: string;
  group?: string;
}

const PROVIDER_PATTERNS: readonly { group: string; pattern: RegExp }[] = [
  { group: "Anthropic", pattern: /^(?:anthropic|claude)[/:-]/i },
  { group: "OpenAI", pattern: /^(?:openai|gpt-|o[0-9])[/:.-]/i },
  { group: "Google", pattern: /^(?:google|gemini)[/:-]/i },
];

const PROVIDER_ORDER: Map<string, number> = new Map([
  ["OpenAI",  0],
  ["Anthropic",  1],
  ["Google",  2],
]);

function providerGroupOf(model: string): string {
  for (const entry of PROVIDER_PATTERNS) {
    if (entry.pattern.test(model)) {
      return entry.group;
    }
  }
  if (model.toLowerCase().startsWith("gpt-")) {
    return "OpenAI";
  }
  const fallback = model.split(/[/:.]/)[0];
  return fallback ? fallback[0].toUpperCase() + fallback.slice(1) : "";
}

function gptVersionOf(model: string): number[] | undefined {
  let marker = -1;
  for (let candidate = 0; candidate + 4 < model.length; candidate += 1) {
    const firstDigit = model.charCodeAt(candidate + 4);
    if (
      model.slice(candidate, candidate + 4).toLowerCase() === "gpt-" &&
      firstDigit >= 48 &&
      firstDigit <= 57
    ) {
      marker = candidate;
      break;
    }
  }
  if (marker < 0) {
    return undefined;
  }

  const version: number[] = [];
  let cursor = marker + 4;
  while (cursor < model.length) {
    const componentStart = cursor;
    while (cursor < model.length) {
      const characterCode = model.charCodeAt(cursor);
      if (characterCode < 48 || characterCode > 57) {
        break;
      }
      cursor += 1;
    }

    if (cursor === componentStart) {
      return version.length > 0 ? version : undefined;
    }
    version.push(Number(model.slice(componentStart, cursor)));

    if (
      model.charAt(cursor) !== "." ||
      cursor + 1 >= model.length ||
      model.charCodeAt(cursor + 1) < 48 ||
      model.charCodeAt(cursor + 1) > 57
    ) {
      break;
    }
    cursor += 1;
  }

  return version.length > 0 ? version : undefined;
}

export function supportsReasoningEffort(model: string): boolean {
  const gptVersion = gptVersionOf(model);
  return (
    (gptVersion !== undefined && gptVersion[0] >= 5) ||
    /^(?:openai[/:])?o[1-9]\d*(?:$|[-/:])/i.test(model)
  );
}

interface ModelSortKey {
  providerRank: number;
  version?: number[];
  variantRank: number;
  model: string;
}

function modelSortKey(model: string): ModelSortKey {
  const provider = providerGroupOf(model);
  return {
    providerRank: PROVIDER_ORDER.get(provider) ?? 99,
    version: gptVersionOf(model),
    variantRank: modelTiebreakKey(model),
    model,
  };
}

function modelTiebreakKey(model: string): number {
  const value = model.toLowerCase();
  if (value.includes("luna")) return 0;
  if (value.includes("turbo")) return 1;
  if (value.includes("o-mini") || value.includes("o-nano")) return 2;
  if (value.includes("mini")) return 3;
  if (value.includes("nano")) return 4;
  return 5;
}

function compareVersionsDescending(left: number[], right: number[]): number {
  const componentCount = Math.max(left.length, right.length);
  const leftComponents = left.values();
  const rightComponents = right.values();
  for (let index = 0; index < componentCount; index += 1) {
    const leftComponent = leftComponents.next();
    const rightComponent = rightComponents.next();
    const difference =
      (rightComponent.done ? 0 : rightComponent.value) -
      (leftComponent.done ? 0 : leftComponent.value);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function compareModelSortKeys(left: ModelSortKey, right: ModelSortKey): number {
  const providerDifference = left.providerRank - right.providerRank;
  if (providerDifference !== 0) {
    return providerDifference;
  }

  if (left.version && right.version) {
    const versionDifference = compareVersionsDescending(left.version, right.version);
    if (versionDifference !== 0) {
      return versionDifference;
    }
    return left.variantRank - right.variantRank;
  }

  if (left.version) return -1;
  if (right.version) return 1;
  return left.model.localeCompare(right.model);
}

export function getNewerModelIds(
  options: ModelOption[],
  activeModel: string,
): Set<string> {
  const activeVersion = gptVersionOf(activeModel);
  if (!activeVersion) {
    return new Set();
  }

  const activeProvider = providerGroupOf(activeModel);
  return new Set(
    options
      .filter((option) => {
        const version = gptVersionOf(option.value);
        return (
          providerGroupOf(option.value) === activeProvider &&
          version !== undefined &&
          compareVersionsDescending(activeVersion, version) > 0
        );
      })
      .map((option) => option.value),
  );
}

function groupModelsByIds(ids: string[]): ModelOption[] {
  const sorted = [...ids];
  sorted.sort((left, right) =>
    compareModelSortKeys(modelSortKey(left), modelSortKey(right)),
  );
  return sorted.map((entry) => ({ label: entry, value: entry }));
}

export function groupModelOptions(options: ModelOption[]): [string, ModelOption[]][] {
  const groups = new Map<string, ModelOption[]>();
  for (const option of options) {
    const group = option.group ?? "";
    const items = groups.get(group) ?? [];
    items.push(option);
    groups.set(group, items);
  }
  return [...groups.entries()];
}

function withGroupInfo(options: ModelOption[]): ModelOption[] {
  return options.map((option) => ({
    ...option,
    group: providerGroupOf(option.value),
  }));
}
export function getModelOptions(openai?: Pick<OpenAIOptions, "aiHubModels" | "model">): ModelOption[] {
  const seen = new Set<string>();
  const recommended: string[] = [];
  for (const model of modelOptions.map((option) => option.value)) {
    if (!seen.has(model)) {
      seen.add(model);
      recommended.push(model);
    }
  }
  const aiHub: string[] = [];
  for (const model of openai?.aiHubModels ?? []) {
    if (!seen.has(model)) {
      seen.add(model);
      aiHub.push(model);
    }
  }
  const extra: string[] = [];
  if (openai?.model && !seen.has(openai.model)) {
    seen.add(openai.model);
    extra.push(openai.model);
  }
  const allModels = [...recommended, ...aiHub, ...extra];
  const sorted = groupModelsByIds(allModels);
  const showProviders = new Set(allModels.map(providerGroupOf)).size > 1;
  if (showProviders) {
    return withGroupInfo(sorted);
  }
  return sorted;
}

export const toolOptions: Map<string, Tool> = new Map([
  [
    "Web Search",
    {
      type: "web_search_preview",
    },
  ],
  [
    "Image Generation",
    {
      type: "image_generation",
      model: "gpt-image-2.5-sunburst"
    },
  ],
  [
    "Code Interpreter",
    {
      type: "code_interpreter",
      container: { type: "auto" },
    },
  ],
  [
    "FH SWF (beta)",
    {
      type: "mcp",
      server_label: "FH_SWF",
      server_url: "https://mcp.fh-swf.cloud/mcp",
      require_approval: "never",
    },
  ],
]);

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
