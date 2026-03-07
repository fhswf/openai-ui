import { GlobalState, McpAuthConfig, OpenAIOptions, Tool } from "../context/types";
import { normalizeMcpAuthConfig } from "./mcp";
import { toolOptions } from "./options";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function readSerializedMap(value: unknown): [string, unknown][] | null {
  if (value instanceof Map) {
    return Array.from(value.entries()).filter(
      (entry): entry is [string, unknown] =>
        Array.isArray(entry) && typeof entry[0] === "string"
    );
  }

  if (
    isObject(value) &&
    value.dataType === "Map" &&
    Array.isArray(value.value)
  ) {
    return value.value.filter(
      (entry): entry is [string, unknown] =>
        Array.isArray(entry) && typeof entry[0] === "string"
    );
  }

  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is [string, unknown] =>
        Array.isArray(entry) && typeof entry[0] === "string"
    );
  }

  if (isObject(value)) {
    return Object.entries(value);
  }

  return null;
}

function readSerializedSet(value: unknown): string[] | null {
  if (value instanceof Set) {
    return Array.from(value).filter(
      (entry): entry is string => typeof entry === "string"
    );
  }

  if (
    isObject(value) &&
    value.dataType === "Set" &&
    Array.isArray(value.value)
  ) {
    return value.value.filter(
      (entry): entry is string => typeof entry === "string"
    );
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  return null;
}

function normalizeToolValue(value: unknown): Tool {
  if (!isObject(value)) return value as Tool;
  return { ...value } as Tool;
}

export function normalizeMcpAuthConfigs(
  value: unknown
): Map<string, McpAuthConfig> {
  const entries = readSerializedMap(value);
  if (!entries) return new Map<string, McpAuthConfig>();

  return new Map(
    entries.map(([key, config]) => [key, normalizeMcpAuthConfig(config)])
  );
}

export function normalizeToolMap(value: unknown): Map<string, Tool> {
  const normalized = new Map<string, Tool>(toolOptions.entries());
  const entries = readSerializedMap(value);

  if (!entries) return normalized;

  for (const [key, tool] of entries) {
    normalized.set(key, normalizeToolValue(tool));
  }

  return normalized;
}

export function normalizeToolEnabledSet(value: unknown): Set<string> {
  const entries = readSerializedSet(value);
  if (!entries) return new Set<string>();
  return new Set(entries);
}

export function normalizeOpenAIOptions(
  openai: Partial<OpenAIOptions> | undefined
): OpenAIOptions {
  const normalized = {
    baseUrl: "",
    organizationId: "",
    temperature: 1,
    top_p: 1,
    mode: "chat",
    model: "gpt-4o-mini",
    assistant: "",
    apiKey: "unused",
    max_tokens: 2048,
    n: 1,
    stream: true,
    tools: new Map<string, Tool>(toolOptions.entries()),
    toolsEnabled: new Set<string>(),
    mcpAuthConfigs: new Map<string, McpAuthConfig>(),
  } as OpenAIOptions;

  if (!isObject(openai)) return normalized;

  return {
    ...normalized,
    ...openai,
    tools: normalizeToolMap(openai.tools),
    toolsEnabled: normalizeToolEnabledSet(openai.toolsEnabled),
    mcpAuthConfigs: normalizeMcpAuthConfigs(openai.mcpAuthConfigs),
  };
}

export function normalizePersistedState<T extends Partial<GlobalState>>(
  state: T
): T {
  if (!isObject(state) || !isObject(state.options)) {
    return state;
  }

  return {
    ...state,
    options: {
      ...state.options,
      openai: normalizeOpenAIOptions(
        isObject(state.options.openai)
          ? (state.options.openai as Partial<OpenAIOptions>)
          : undefined
      ),
    },
  } as T;
}
