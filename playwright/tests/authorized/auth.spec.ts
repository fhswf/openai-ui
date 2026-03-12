import { test, expect } from "../baseFixtures";
import type { Locator, Page } from "@playwright/test";

const APP_READY_TIMEOUT = 15000;
const DISABLE_ANIMATIONS_STYLE = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
    scroll-behavior: auto !important;
  }
`;

const mockUser = {
  name: "Playwright Auth",
  email: "auth.user@fh-swf.de",
  sub: "test-user",
  preferred_username: "auth.user",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

const jwks = {
  keys: [
    {
      kty: "RSA",
      n: "2phSoFd1TfAG5zXPy27HckDYdRoEeAVEnlcE-yasXbNAPSgYc84j20Kgw9t8SY_qW2pDjE-yhdqO0xiue5QSyfYkyaemUB8LnAQiZpajCL_RZOrHACWP55axzZbGXwAmCu6rdhd1XyV71TA5N2Big15998WKl3DiVOftZlxJ6WiV7CJSlKYPBSUrXanoDMwSjW-HHl38XYgRmzqNJIc0j5JPSWtjTCp0rJ7Zzq5VkaRsWZ5Ea-lN09XDjCUQYvv2BqlMtyuxgNlXDji51MfhMTw2CjUfa6eaU2ATRNDHqn32uubKLiiJkxqhh9XKHiQh-rEqEeTzIFMPr3mgViE2mQ",
      e: "AQAB",
      alg: "RSA-OAEP-256",
      use: "enc",
    },
  ],
};

const discoveredScopes = {
  scopes_supported: [
    { scope: "email", description: "Email address" },
    { scope: "name", description: "Display name" },
  ],
};
const openIdConfiguration = {
  issuer: "https://userdata.example.com",
  jwks_uri: "https://userdata.example.com/.well-known/jwks.json",
  scopes_supported: discoveredScopes.scopes_supported,
};

const mcpServiceLabels = {
  userData: "User Data Service",
  static: "Static Service",
};

const updatedMcpUser = {
  name: "Updated User",
  email: "updated.user@fh-swf.de",
  sub: "updated-user",
  preferred_username: "updated.user",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

const baseAccountOptions = { name: "Anonymus", avatar: "", terms: true };
const baseGeneralOptions = {
  language: "de",
  theme: "light",
  sendCommand: "COMMAND_ENTER",
  size: "normal",
  codeEditor: false,
  gravatar: false,
};
const baseOpenAiOptions = {
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
};

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;
const loginEndpointPattern = /\/(?:api\/)?login\/?(?:\?.*)?$/;
const userPathPattern = /\/(?:api\/)?user\/?$/;
const loginPathPattern = /\/(?:api\/)?login\/?$/;

function matchesPath(url: string, pattern: RegExp) {
  try {
    return pattern.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function disableAnimations(page: Page) {
  // Neutralize animations for cross-browser timing consistency
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_STYLE });
}

async function waitForAuthenticatedShell(page: Page) {
  await disableAnimations(page);
  await expect(page.getByTestId("UserInformationBtn")).toBeVisible({
    timeout: APP_READY_TIMEOUT,
  });
}

async function acceptTermsIfVisible(page: Page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  const informationWindow = page.getByTestId("InformationWindow");
  if ((await termsBtn.count()) === 0) return;

  await expect(termsBtn).toBeVisible({ timeout: 5000 });
  await termsBtn.scrollIntoViewIfNeeded();
  await clickWithBackdropRetry(page, termsBtn);
  await expect(termsBtn).toBeHidden({ timeout: 15000 });
  await expect(informationWindow).toBeHidden({
    timeout: 15000,
  });
}

async function clickWithBackdropRetry(page: Page, locator: Locator) {
  const informationWindow = page.getByTestId("InformationWindow");

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await locator.click({ timeout: 3000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      const isBackdropInterception =
        message.includes("intercepts pointer events") &&
        message.includes("dialog__backdrop");
      if (!isBackdropInterception) throw error;
      await expect(informationWindow).toBeHidden({ timeout: 3000 });
    }
  }

  await locator.click({ force: true });
}

function buildMcpTools(args: {
  staleAuthorization: string;
  staticToken: string;
}) {
  return {
    dataType: "Map",
    value: [
      [
        mcpServiceLabels.userData,
        {
          type: "mcp",
          server_label: "MCP_USER",
          server_url: "https://userdata.example.com",
          require_approval: "never",
          authorization: args.staleAuthorization,
        },
      ],
      [
        mcpServiceLabels.static,
        {
          type: "mcp",
          server_label: "MCP_STATIC",
          server_url: "https://static.example.com",
          require_approval: "never",
          authorization: args.staticToken,
        },
      ],
    ],
  };
}

function buildMcpToolsEnabled() {
  return {
    dataType: "Set",
    value: [mcpServiceLabels.userData, mcpServiceLabels.static],
  };
}

function buildMcpAuthConfigs(staticToken: string) {
  return {
    dataType: "Map",
    value: [
      [
        mcpServiceLabels.userData,
        {
          mode: "user-data",
          userData: {
            scopes: [{ scope: "email" }, { scope: "name" }],
            consentGranted: true,
          },
        },
      ],
      [
        mcpServiceLabels.static,
        {
          mode: "static",
          staticToken,
        },
      ],
    ],
  };
}

function buildMcpSeedSession(args: {
  staleAuthorization: string;
  staticToken: string;
}) {
  return {
    options: {
      account: baseAccountOptions,
      general: baseGeneralOptions,
      openai: {
        ...baseOpenAiOptions,
        tools: buildMcpTools(args),
        toolsEnabled: buildMcpToolsEnabled(),
        mcpAuthConfigs: buildMcpAuthConfigs(args.staticToken),
      },
    },
  };
}

async function seedSession(page: Page, sessionSeed: unknown) {
  await page.addInitScript((seed) => {
    localStorage.setItem("SESSIONS", JSON.stringify(seed));
    localStorage.removeItem("CHAT_HISTORY");
  }, sessionSeed);
}

async function routeMcpUserAndJwks(
  page: Page,
  jwksRequestCount: { count: number }
) {
  await page.route(userEndpointPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(updatedMcpUser),
    });
  });
  await page.route(
    "https://userdata.example.com/.well-known/jwks.json",
    async (route) => {
      jwksRequestCount.count += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(jwks),
      });
    }
  );
  await page.route(
    "https://userdata.example.com/.well-known/openid-configuration",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(openIdConfiguration),
      });
    }
  );
  await page.route(
    "https://static.example.com/.well-known/openid-configuration",
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "missing",
      });
    }
  );
}

async function waitForMcpAuthRefresh(
  page: Page,
  args: {
    staleAuthorization: string;
    staticToken: string;
    userLabel: string;
    staticLabel: string;
  }
) {
  await expect(async () => {
    const authWasRefreshed = await page.evaluate(
      ({ staleAuthorization, staticToken, userLabel, staticLabel }) => {
        const raw = localStorage.getItem("SESSIONS");
        if (!raw) return false;

        const session = JSON.parse(raw);
        const tools = session?.options?.openai?.tools;
        if (!tools || tools.dataType !== "Map") return false;

        const findAuthorization = (label: string) => {
          const entry = tools.value.find(([key]: [string]) => key === label);
          return entry?.[1]?.authorization;
        };

        const userAuth = findAuthorization(userLabel);
        const staticAuth = findAuthorization(staticLabel);

        return (
          typeof userAuth === "string" &&
          userAuth !== staleAuthorization &&
          staticAuth === staticToken
        );
      },
      args
    );

    expect(authWasRefreshed).toBe(true);
  }).toPass({ timeout: APP_READY_TIMEOUT });
}

test.describe("Authentication (fetchAndGetUser)", () => {
  test("redirects to login when user endpoint returns 401", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("SESSIONS");
      localStorage.removeItem("CHAT_HISTORY");
    });

    const user401Response = page.waitForResponse(
      (response) =>
        matchesPath(response.url(), userPathPattern) &&
        response.status() === 401
    );
    const loginResponse = page.waitForResponse(
      (response) =>
        matchesPath(response.url(), loginPathPattern) &&
        response.status() === 200
    );

    // Mocked to eliminate network timing variance across browsers
    await page.route(userEndpointPattern, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "http://localhost:5173",
          "access-control-allow-credentials": "true",
        },
        body: JSON.stringify({}),
      });
    });
    await page.route(loginEndpointPattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: '<html lang=""><body>Login</body></html>',
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await user401Response;
    await loginResponse;
    await expect(page).toHaveURL(loginEndpointPattern, {
      timeout: APP_READY_TIMEOUT,
    });
    await expect(page.getByText("Login")).toBeVisible();
  });

  test("shows user information after successful fetch", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("SESSIONS");
      localStorage.removeItem("CHAT_HISTORY");
    });

    // Mocked to eliminate network timing variance across browsers
    await page.route(userEndpointPattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    const userResponse = page.waitForResponse(userEndpointPattern);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await userResponse;
    await waitForAuthenticatedShell(page);
    await acceptTermsIfVisible(page);

    const popover = page.getByTestId("UserInformation");
    await clickWithBackdropRetry(page, page.getByTestId("UserInformationBtn"));
    await expect(popover).toBeVisible();
    await expect(popover.getByText(mockUser.name)).toBeVisible();
    await expect(popover.getByText(mockUser.email)).toBeVisible();
  });

  test("refreshes MCP user-data authorization when user changes", async ({
    page,
  }) => {
    const staleAuthorization = "stale-authorization";
    const staticToken = "static-token";

    await seedSession(
      page,
      buildMcpSeedSession({ staleAuthorization, staticToken })
    );

    const jwksRequestCount = { count: 0 };
    await routeMcpUserAndJwks(page, jwksRequestCount);

    const userResponse = page.waitForResponse(userEndpointPattern);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await userResponse;
    await waitForAuthenticatedShell(page);
    await acceptTermsIfVisible(page);

    await waitForMcpAuthRefresh(page, {
      staleAuthorization,
      staticToken,
      userLabel: mcpServiceLabels.userData,
      staticLabel: mcpServiceLabels.static,
    });

    await expect.poll(() => jwksRequestCount.count).toBeGreaterThan(0);
  });
});
