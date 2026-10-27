import { test, expect } from "../baseFixtures";
import type { APIResponse } from "@playwright/test";
import { getAuthorizationForMcpConfig } from "../../../src/chat/hooks/useMcpAuth";

const mcpServerUrl = process.env.MCP_SERVER_URL?.trim();
const protocolVersion = "2025-03-26";

interface JsonRpcResponse {
  id?: number;
  error?: unknown;
  result?: {
    protocolVersion?: unknown;
    tools?: unknown;
  };
}

test.skip(
  !mcpServerUrl,
  "Set MCP_SERVER_URL to run the direct MCP server integration test"
);

async function readJsonRpcResponse(response: APIResponse, id: number) {
  const body = await response.text();
  const dataLines = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter(Boolean);
  const messages = dataLines.length
    ? dataLines.map((line) => JSON.parse(line) as JsonRpcResponse)
    : [JSON.parse(body) as JsonRpcResponse];
  const message = messages.find((candidate) => candidate.id === id);

  if (!message) {
    throw new Error(`MCP response did not contain JSON-RPC id ${id}`);
  }
  expect(message.error).toBeUndefined();
  return message;
}

test("accepts the UI-generated token on a direct tools/list request", async ({
  request,
}) => {
  if (!mcpServerUrl) {
    throw new Error("MCP_SERVER_URL is required for this integration test");
  }

  const serverUrl = new URL(mcpServerUrl);
  const authorization = await getAuthorizationForMcpConfig(
    {
      mode: "user-data",
      userData: {
        scopes: [{ scope: "email" }, { scope: "name" }],
        consentGranted: true,
        consentPrompted: true,
      },
    },
    serverUrl.toString(),
    {
      name: "Playwright MCP integration test",
      email: "playwright-mcp-integration@example.com",
    }
  );

  expect(authorization).toBeTruthy();
  if (!authorization) {
    throw new Error("MCP auth helper did not produce an authorization token");
  }

  const mcpEndpoint = new URL("/mcp", serverUrl).toString();
  const headers = {
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${authorization}`,
    "Content-Type": "application/json",
  };
  const initializeResponse = await request.post(mcpEndpoint, {
    headers,
    data: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: "openai-ui-playwright", version: "1.0.0" },
      },
    },
  });

  expect(
    initializeResponse.ok(),
    `MCP initialize failed (${initializeResponse.status()}): ${await initializeResponse.text()}`
  ).toBe(true);
  const initializeMessage = await readJsonRpcResponse(initializeResponse, 1);
  expect(initializeMessage.result).toBeDefined();
  const negotiatedProtocolVersion = initializeMessage.result?.protocolVersion;
  expect(typeof negotiatedProtocolVersion).toBe("string");
  if (typeof negotiatedProtocolVersion !== "string") {
    throw new Error(
      "MCP initialize response did not include a protocol version"
    );
  }

  const sessionId = initializeResponse.headers()["mcp-session-id"];
  const toolsResponse = await request.post(mcpEndpoint, {
    headers: {
      ...headers,
      "MCP-Protocol-Version": negotiatedProtocolVersion,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    data: {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    },
  });

  expect(
    toolsResponse.ok(),
    `MCP tools/list failed (${toolsResponse.status()}): ${await toolsResponse.text()}`
  ).toBe(true);
  const toolsMessage = await readJsonRpcResponse(toolsResponse, 2);
  const tools = toolsMessage.result?.tools;
  expect(Array.isArray(tools)).toBe(true);
  if (!Array.isArray(tools)) {
    throw new Error("MCP tools/list response did not contain a tools array");
  }
  expect(tools.length).toBeGreaterThan(0);
});
