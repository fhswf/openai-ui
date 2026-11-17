import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, jwtDecrypt } from "jose";
import { test, expect } from "../baseFixtures";
import { getAuthorizationForMcpConfig } from "../../../src/chat/hooks/useMcpAuth";

const protocolVersion = "2025-03-26";
const keyId = "mock-mcp-auth-key";
const userData = {
  name: "Mock MCP Playwright test",
  email: "mock-mcp-playwright@example.com",
};
const scopes = [{ scope: "email" }, { scope: "name" }];

test("accepts encrypted UI authorization on a mocked MCP server", async ({
  request,
}) => {
  const { publicKey, privateKey } = await generateKeyPair("RSA-OAEP", {
    modulusLength: 2048,
  });
  const publicJwk = await exportJWK(publicKey);
  const jwks = {
    keys: [
      {
        ...publicJwk,
        alg: "RSA-OAEP",
        kid: keyId,
        use: "enc",
      },
    ],
  };
  const verifiedTokens: Array<{
    data: unknown;
    protectedHeader: Record<string, unknown>;
  }> = [];
  let serverUrl = "";

  const server = createServer(async (incomingRequest, response) => {
    const sendJson = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };

    if (
      incomingRequest.method === "GET" &&
      incomingRequest.url === "/.well-known/openid-configuration"
    ) {
      sendJson(200, {
        issuer: serverUrl,
        jwks_uri: new URL("/.well-known/jwks.json", serverUrl).toString(),
        scopes_supported: scopes,
      });
      return;
    }

    if (
      incomingRequest.method === "GET" &&
      incomingRequest.url === "/.well-known/jwks.json"
    ) {
      sendJson(200, jwks);
      return;
    }

    if (incomingRequest.method !== "POST" || incomingRequest.url !== "/mcp") {
      sendJson(404, { error: "not found" });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of incomingRequest) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    let rpcRequest: { id?: number; method?: string };
    try {
      rpcRequest = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      sendJson(400, { error: "invalid JSON" });
      return;
    }

    const authorization = incomingRequest.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      sendJson(401, { error: "Bearer authorization required" });
      return;
    }

    try {
      const { payload, protectedHeader } = await jwtDecrypt(
        authorization.slice("Bearer ".length),
        privateKey
      );
      verifiedTokens.push({ data: payload.data, protectedHeader });
    } catch {
      sendJson(401, { error: "invalid encrypted authorization" });
      return;
    }

    if (rpcRequest.method === "initialize") {
      response.setHeader("mcp-session-id", "mock-mcp-session");
      sendJson(200, {
        jsonrpc: "2.0",
        id: rpcRequest.id,
        result: {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: "mock-mcp-server", version: "1.0.0" },
        },
      });
      return;
    }

    if (rpcRequest.method === "tools/list") {
      if (
        incomingRequest.headers["mcp-protocol-version"] !== protocolVersion ||
        incomingRequest.headers["mcp-session-id"] !== "mock-mcp-session"
      ) {
        sendJson(400, { error: "MCP session headers missing" });
        return;
      }
      sendJson(200, {
        jsonrpc: "2.0",
        id: rpcRequest.id,
        result: {
          tools: [
            {
              name: "mock_echo",
              description: "A mocked MCP tool",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      });
      return;
    }

    sendJson(400, { error: "unsupported method" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${address.port}`;

  try {
    const authorization = await getAuthorizationForMcpConfig(
      {
        mode: "user-data",
        userData: {
          scopes,
          consentGranted: true,
          consentPrompted: true,
        },
      },
      serverUrl,
      userData
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
      `MCP initialize failed: ${await initializeResponse.text()}`
    ).toBe(true);
    const initializeMessage = await initializeResponse.json();
    expect(initializeMessage.result.protocolVersion).toBe(protocolVersion);

    const toolsResponse = await request.post(mcpEndpoint, {
      headers: {
        ...headers,
        "MCP-Protocol-Version": protocolVersion,
        "Mcp-Session-Id": initializeResponse.headers()["mcp-session-id"],
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
      `MCP tools/list failed: ${await toolsResponse.text()}`
    ).toBe(true);
    const toolsMessage = await toolsResponse.json();
    expect(toolsMessage.result.tools).toEqual([
      {
        name: "mock_echo",
        description: "A mocked MCP tool",
        inputSchema: { type: "object", properties: {} },
      },
    ]);

    expect(verifiedTokens).toHaveLength(2);
    for (const verifiedToken of verifiedTokens) {
      expect(verifiedToken.data).toEqual(userData);
      expect(verifiedToken.protectedHeader).toMatchObject({
        alg: "RSA-OAEP",
        enc: "A256GCM",
        kid: keyId,
      });
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
