import { compactDecrypt, exportJWK, generateKeyPair } from "jose";
import type { Page } from "@playwright/test";
import { test, expect } from "../baseFixtures";

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;
const mcpServiceLabels = {
  good: "Good User Data Service",
  bad: "Bad User Data Service",
  repeat: "Repeat User Data Service",
};

const firstUser = {
  name: "First User",
  email: "first.user@fh-swf.de",
  sub: "first-user",
  preferred_username: "first.user",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

const secondUser = {
  name: "Second User",
  email: "second.user@fh-swf.de",
  sub: "second-user",
  preferred_username: "second.user",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

const baseSession = {
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
    },
  },
};

async function acceptTermsIfVisible(page: Page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  if (!(await termsBtn.isVisible())) return;
  await termsBtn.click();
  await expect(termsBtn).toBeHidden({ timeout: 15000 });
}

async function seedSession(page: Page, sessionSeed: unknown) {
  await page.addInitScript((seed) => {
    localStorage.setItem("SESSIONS", JSON.stringify(seed));
    localStorage.removeItem("CHAT_HISTORY");
  }, sessionSeed);
}

function buildUserDataSession(tools: Array<{
  label: string;
  serverUrl: string;
  staleAuthorization: string;
}>): unknown {
  return {
    ...baseSession,
    options: {
      ...baseSession.options,
      openai: {
        ...baseSession.options.openai,
        tools: {
          dataType: "Map",
          value: tools.map((tool) => [
            tool.label,
            {
              type: "mcp",
              server_label: tool.label,
              server_url: tool.serverUrl,
              require_approval: "never",
              authorization: tool.staleAuthorization,
            },
          ]),
        },
        toolsEnabled: {
          dataType: "Set",
          value: tools.map((tool) => tool.label),
        },
        mcpAuthConfigs: {
          dataType: "Map",
          value: tools.map((tool) => [
            tool.label,
            {
              mode: "user-data",
              selectedFields: ["email", "name"],
            },
          ]),
        },
      },
    },
  };
}

async function readToolAuthorization(
  page: Page,
  label: string
): Promise<string | null> {
  return page.evaluate((toolLabel) => {
    const raw = localStorage.getItem("SESSIONS");
    if (!raw) return null;
    const session = JSON.parse(raw);
    const tools = session?.options?.openai?.tools;
    if (!tools || tools.dataType !== "Map") return null;
    const entry = tools.value.find(([key]: [string]) => key === toolLabel);
    return entry?.[1]?.authorization ?? null;
  }, label);
}

test("refreshes user-data MCP authorization on repeated /api/user fetches", async ({
  page,
}) => {
  const staleAuthorization = "stale-repeat-auth";
  const { publicKey, privateKey } = await generateKeyPair("RSA-OAEP-256", {
    modulusLength: 2048,
  });
  const publicJwk = await exportJWK(publicKey);
  let userRequestCount = 0;

  await seedSession(
    page,
    buildUserDataSession([
      {
        label: mcpServiceLabels.repeat,
        serverUrl: "https://repeat.example.com",
        staleAuthorization,
      },
    ])
  );

  await page.route(userEndpointPattern, async (route) => {
    userRequestCount += 1;
    const nextUser = userRequestCount === 1 ? firstUser : secondUser;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(nextUser),
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
            kid: "repeat-key",
          },
        ],
      }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await acceptTermsIfVisible(page);

  await page.waitForFunction(
    ({ label, stale }) => {
      const raw = localStorage.getItem("SESSIONS");
      if (!raw) return false;
      const session = JSON.parse(raw);
      const tools = session?.options?.openai?.tools;
      if (!tools || tools.dataType !== "Map") return false;
      const entry = tools.value.find(([key]: [string]) => key === label);
      const authorization = entry?.[1]?.authorization;
      return (
        typeof authorization === "string" &&
        authorization !== stale &&
        authorization.split(".").length === 5
      );
    },
    { label: mcpServiceLabels.repeat, stale: staleAuthorization }
  );

  const firstAuthorization = await readToolAuthorization(page, mcpServiceLabels.repeat);
  expect(firstAuthorization).not.toBeNull();
  const firstPayload = JSON.parse(
    new TextDecoder().decode(
      (
        await compactDecrypt(firstAuthorization as string, privateKey)
      ).plaintext
    )
  );
  expect(firstPayload.name).toBe(firstUser.name);
  expect(firstPayload.email).toBe(firstUser.email);

  await page.reload({ waitUntil: "domcontentloaded" });
  await acceptTermsIfVisible(page);

  await page.waitForFunction(
    ({ label, previous }) => {
      const raw = localStorage.getItem("SESSIONS");
      if (!raw) return false;
      const session = JSON.parse(raw);
      const tools = session?.options?.openai?.tools;
      if (!tools || tools.dataType !== "Map") return false;
      const entry = tools.value.find(([key]: [string]) => key === label);
      const authorization = entry?.[1]?.authorization;
      return (
        typeof authorization === "string" &&
        authorization !== previous &&
        authorization.split(".").length === 5
      );
    },
    { label: mcpServiceLabels.repeat, previous: firstAuthorization }
  );

  const secondAuthorization = await readToolAuthorization(page, mcpServiceLabels.repeat);
  expect(secondAuthorization).not.toBeNull();
  expect(secondAuthorization).not.toBe(firstAuthorization);
  const secondPayload = JSON.parse(
    new TextDecoder().decode(
      (
        await compactDecrypt(secondAuthorization as string, privateKey)
      ).plaintext
    )
  );
  expect(secondPayload.name).toBe(secondUser.name);
  expect(secondPayload.email).toBe(secondUser.email);
});

test("clears only the failed user-data MCP authorization during refresh", async ({
  page,
}) => {
  const { publicKey, privateKey } = await generateKeyPair("RSA-OAEP-256", {
    modulusLength: 2048,
  });
  const publicJwk = await exportJWK(publicKey);

  await seedSession(
    page,
    buildUserDataSession([
      {
        label: mcpServiceLabels.good,
        serverUrl: "https://good.example.com",
        staleAuthorization: "stale-good-auth",
      },
      {
        label: mcpServiceLabels.bad,
        serverUrl: "https://bad.example.com",
        staleAuthorization: "stale-bad-auth",
      },
    ])
  );

  await page.route(userEndpointPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(firstUser),
    });
  });

  await page.route("**/.well-known/jwks.json", async (route) => {
    const hostname = new URL(route.request().url()).hostname;
    if (hostname === "bad.example.com") {
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        keys: [
          {
            ...publicJwk,
            alg: "RSA-OAEP-256",
            use: "enc",
            kid: "good-key",
          },
        ],
      }),
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await acceptTermsIfVisible(page);

  await page.waitForFunction(
    ({ goodLabel, badLabel }) => {
      const raw = localStorage.getItem("SESSIONS");
      if (!raw) return false;
      const session = JSON.parse(raw);
      const tools = session?.options?.openai?.tools;
      if (!tools || tools.dataType !== "Map") return false;
      const findEntry = (label: string) =>
        tools.value.find(([key]: [string]) => key === label)?.[1];

      const goodTool = findEntry(goodLabel);
      const badTool = findEntry(badLabel);
      return !!goodTool?.authorization && !("authorization" in (badTool || {}));
    },
    { goodLabel: mcpServiceLabels.good, badLabel: mcpServiceLabels.bad }
  );

  const goodAuthorization = await readToolAuthorization(page, mcpServiceLabels.good);
  const badAuthorization = await readToolAuthorization(page, mcpServiceLabels.bad);

  expect(goodAuthorization).not.toBeNull();
  expect(badAuthorization).toBeNull();

  const goodPayload = JSON.parse(
    new TextDecoder().decode(
      (
        await compactDecrypt(goodAuthorization as string, privateKey)
      ).plaintext
    )
  );
  expect(goodPayload.name).toBe(firstUser.name);
  expect(goodPayload.email).toBe(firstUser.email);
});
