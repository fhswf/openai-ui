import { describe, expect, it, vi } from "vitest";
import {
  OptionActionType,
  type GlobalActions,
  type Tool,
} from "../../context/types";
import { updateToolSelection } from "../mcpServiceHelpers";

const serverKey = "Example MCP";
const tool: Tool.Mcp = {
  type: "mcp",
  server_label: "example",
  server_url: "https://example.com/mcp",
  require_approval: "never",
};

describe("updateToolSelection", () => {
  it("enables a tool in a new Set without mutating the current settings", () => {
    const toolsEnabled = new Set(["Web Search"]);
    const setOptions = vi.fn<GlobalActions["setOptions"]>();
    const onEditTool = vi.fn();

    updateToolSelection({
      checkedChange: true,
      collections: {
        mcpAuthConfigs: new Map(),
        tools: new Map([[serverKey, tool]]),
        toolsEnabled,
      },
      key: serverKey,
      onEditTool,
      setOptions,
      tool,
    });

    expect(toolsEnabled).toEqual(new Set(["Web Search"]));
    expect(setOptions).toHaveBeenCalledWith({
      type: OptionActionType.OPENAI,
      data: { toolsEnabled: new Set(["Web Search", serverKey]) },
    });
    expect(setOptions.mock.lastCall?.[0].data.toolsEnabled).not.toBe(
      toolsEnabled
    );
    expect(onEditTool).not.toHaveBeenCalled();
  });

  it("disables a tool in a new Set without mutating the current settings", () => {
    const toolsEnabled = new Set([serverKey, "Web Search"]);
    const setOptions = vi.fn<GlobalActions["setOptions"]>();

    updateToolSelection({
      checkedChange: false,
      collections: {
        mcpAuthConfigs: new Map(),
        tools: new Map([[serverKey, tool]]),
        toolsEnabled,
      },
      key: serverKey,
      onEditTool: vi.fn(),
      setOptions,
      tool,
    });

    expect(toolsEnabled).toEqual(new Set([serverKey, "Web Search"]));
    expect(setOptions).toHaveBeenCalledWith({
      type: OptionActionType.OPENAI,
      data: { toolsEnabled: new Set(["Web Search"]) },
    });
  });

  it("preserves an enabled selection while prompting for consent", () => {
    const authConfig = {
      mode: "user-data" as const,
      userData: {
        scopes: [{ scope: "email" }],
        consentGranted: false,
        consentPrompted: false,
      },
    };
    const mcpAuthConfigs = new Map([[serverKey, authConfig]]);
    const toolsEnabled = new Set<string>();
    const setOptions = vi.fn<GlobalActions["setOptions"]>();
    const onEditTool = vi.fn();

    updateToolSelection({
      checkedChange: true,
      collections: {
        mcpAuthConfigs,
        tools: new Map([[serverKey, tool]]),
        toolsEnabled,
      },
      key: serverKey,
      onEditTool,
      setOptions,
      tool,
    });

    expect(toolsEnabled.size).toBe(0);
    expect(mcpAuthConfigs.get(serverKey)?.mode).toBe("user-data");
    if (mcpAuthConfigs.get(serverKey)?.mode === "user-data") {
      expect(mcpAuthConfigs.get(serverKey)?.userData.consentPrompted).toBe(
        false
      );
    }
    expect(setOptions).toHaveBeenCalledWith({
      type: OptionActionType.OPENAI,
      data: {
        mcpAuthConfigs: new Map([
          [
            serverKey,
            {
              ...authConfig,
              userData: { ...authConfig.userData, consentPrompted: true },
            },
          ],
        ]),
        toolsEnabled: new Set([serverKey]),
      },
    });
    expect(onEditTool).toHaveBeenCalledWith({
      key: serverKey,
      tool,
      consentPrompt: true,
    });
  });
});
