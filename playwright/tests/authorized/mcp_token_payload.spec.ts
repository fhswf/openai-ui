import { compactDecrypt, exportJWK, generateKeyPair } from "jose";
import { test, expect } from "../baseFixtures";

const mockUser = {
  name: "Playwright Auth",
  email: "auth.user@fh-swf.de",
  sub: "test-user",
  preferred_username: "auth.user",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;
const mcpServiceLabel = "User Data Service";

function buildSeedSession(staleAuthorization: string) {
  return {
    options: {
      account: { name: "Anonymus", avatar: "", terms: true },
      general: {
        language: "de",
        theme: "light",
        sendCommand: "COMMAND_ENTER",
        size: "normal",
        codeEditor: false,
        gravatar: false,
      },
      openai: {
        baseUrl: "https://openai.ki.fh-swf.de/api",
        organizationId: "",
        temperature: 1,
        mode: "chat",
        model: "gpt-4o-mini",
        apiKey: "unused",
        max_tokens: 2048,
        n: 1,
        top_p: 1,
        stream: true,
        assistant: "",
        tools: {
          dataType: "Map",
          value: [
            [
              mcpServiceLabel,
              {
                type: "mcp",
                server_label: mcpServiceLabel,
                server_url: "https://userdata.example.com",
                require_approval: "never",
                authorization: staleAuthorization,
              },
            ],
          ],
        },
        toolsEnabled: {
          dataType: "Set",
          value: [mcpServiceLabel],
        },
        mcpAuthConfigs: {
          dataType: "Map",
          value: [
            [
              mcpServiceLabel,
              {
                mode: "user-data",
                selectedFields: ["email", "name"],
              },
            ],
          ],
        },
      },
    },
  };
}

async function acceptTermsIfVisible(page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  if (!(await termsBtn.isVisible())) return;
  await termsBtn.click();
  await expect(termsBtn).toBeHidden({ timeout: 15000 });
}

test("user-data MCP authorization includes numeric exp/iat claims", async ({
  page,
}) => {
  const staleAuthorization = "stale-authorization";
  const { publicKey, privateKey } = await generateKeyPair("RSA-OAEP-256", {
    modulusLength: 2048,
  });
  const publicJwk = await exportJWK(publicKey);

  await page.addInitScript((seed) => {
    localStorage.setItem("SESSIONS", JSON.stringify(seed));
    localStorage.removeItem("CHAT_HISTORY");
  }, buildSeedSession(staleAuthorization));

  await page.route(userEndpointPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockUser),
    });
  });

  await page.route("**/.well-known/jwks.json", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        keys: [
          {
            ...publicJwk,
            alg: "RSA-OAEP-256",
            use: "enc",
            kid: "test-key",
          },
        ],
      }),
    });
  });

  const userResponse = page.waitForResponse(userEndpointPattern);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await userResponse;
  await acceptTermsIfVisible(page);

  const authorization = await page.waitForFunction(
    ({ label, stale }) => {
      const raw = localStorage.getItem("SESSIONS");
      if (!raw) return null;
      const session = JSON.parse(raw);
      const tools = session?.options?.openai?.tools;
      if (!tools || tools.dataType !== "Map") return null;
      const entry = tools.value.find(([key]: [string]) => key === label);
      const nextAuthorization = entry?.[1]?.authorization;
      if (!nextAuthorization || nextAuthorization === stale) return null;
      return nextAuthorization;
    },
    { label: mcpServiceLabel, stale: staleAuthorization }
  );

  const token = await authorization.jsonValue<string>();
  const decrypted = await compactDecrypt(token, privateKey);
  const payload = JSON.parse(new TextDecoder().decode(decrypted.plaintext));

  expect(payload.name).toBe(mockUser.name);
  expect(payload.email).toBe(mockUser.email);
  expect(typeof payload.iat).toBe("number");
  expect(typeof payload.exp).toBe("number");
  expect(payload.exp).toBe(payload.iat + 300);
});
