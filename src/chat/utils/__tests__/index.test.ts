import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initState } from "../../context/initState";
import {
  OptionActionType,
  type OpenAIOptions,
  type OptionAction,
  type Tool,
} from "../../context/types";

const authMocks = vi.hoisted(() => ({
  discoverMcpAuthForServer: vi.fn(),
  getAuthorizationForMcpConfig: vi.fn(),
}));

vi.mock("../../hooks/useMcpAuth", () => ({
  DEFAULT_MCP_AUTH_CONFIG: { mode: "none" },
  discoverMcpAuthForServer: authMocks.discoverMcpAuthForServer,
  getAuthorizationForMcpConfig: authMocks.getAuthorizationForMcpConfig,
  hasBeenConsentPrompted: vi.fn(() => false),
  isMcpAuthorizationIncomplete: vi.fn(() => false),
  normalizeMcpAuthConfig: vi.fn((config) => config ?? { mode: "none" }),
}));

import { fetchAndGetUser } from "../index";

describe("fetchAndGetUser MCP refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves tool selections changed while auth discovery is in flight", async () => {
    const key = "Example MCP";
    const tool: Tool.Mcp = {
      type: "mcp",
      server_label: "example",
      server_url: "https://example.com/mcp",
      require_approval: "never",
    };
    let resolveDiscovery: ((value: { mode: "none" }) => void) | undefined;
    authMocks.discoverMcpAuthForServer.mockReturnValue(
      new Promise<{ mode: "none" }>((resolve) => {
        resolveDiscovery = resolve;
      })
    );
    authMocks.getAuthorizationForMcpConfig.mockResolvedValue("refreshed-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ sub: "user-1" }),
      })
    );

    let openai: OpenAIOptions = {
      ...initState.options.openai,
      tools: new Map([[key, tool]]),
      toolsEnabled: new Set(),
      mcpAuthConfigs: new Map(),
    };
    const getOptions = () => ({
      general: { gravatar: false },
      openai,
    });
    const setOptions = vi.fn((action: OptionAction) => {
      if (action.type === OptionActionType.OPENAI) {
        openai = { ...openai, ...action.data };
      }
    });

    fetchAndGetUser(vi.fn(), getOptions, setOptions);
    await vi.waitFor(() =>
      expect(authMocks.discoverMcpAuthForServer).toHaveBeenCalled()
    );

    openai = { ...openai, toolsEnabled: new Set([key]) };
    resolveDiscovery?.({ mode: "none" });
    await vi.waitFor(() => expect(setOptions).toHaveBeenCalled());

    const update = setOptions.mock.lastCall?.[0];
    expect(update?.type).toBe(OptionActionType.OPENAI);
    if (update?.type === OptionActionType.OPENAI) {
      expect(update.data.toolsEnabled).toEqual(new Set([key]));
    }
  });
});
