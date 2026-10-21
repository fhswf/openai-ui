import { useRef } from "react";
import { useGlobal } from "../context";
import { OptionActionType } from "../context/types";
import { ToolRegistry, findFileSearchToolKey } from "../utils/fileSearch";

export type RegistryUpdate = (registry: ToolRegistry) => ToolRegistry;

/**
 * Access to the vector stores that are active in the chat. They are stored
 * as `file_search` entries in the tool registry of the OpenAI options.
 */
export function useFileSearchRegistry() {
  const { options, setOptions } = useGlobal();
  const { tools, toolsEnabled } = options.openai;
  const registry: ToolRegistry = {
    tools: tools instanceof Map ? tools : new Map(),
    toolsEnabled: toolsEnabled instanceof Set ? toolsEnabled : new Set(),
  };

  // Callers may update after an await (e.g. rename, menu reload); read the
  // latest state then, so concurrent toggles are not overwritten.
  const latest = useRef({ registry, setOptions });
  latest.current = { registry, setOptions };

  const updateRegistry = (update: RegistryUpdate) => {
    const current = latest.current.registry;
    const next = update(current);
    if (next !== current) {
      latest.current.setOptions({ type: OptionActionType.OPENAI, data: next });
    }
  };

  const isInChat = (vectorStoreId: string) => {
    const key = findFileSearchToolKey(registry.tools, vectorStoreId);
    return key !== undefined && registry.toolsEnabled.has(key);
  };

  return { registry, updateRegistry, isInChat };
}
