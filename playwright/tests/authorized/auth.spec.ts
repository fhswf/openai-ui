import { test, expect } from "../baseFixtures";
import type { Locator, Page } from "@playwright/test";

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

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;
const loginEndpointPattern = /\/(?:api\/)?login\/?(?:\?.*)?$/;
const userPathPattern = /\/(?:api\/)?user\/?$/;

function matchesPath(url: string, pattern: RegExp) {
  try {
    return pattern.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

async function acceptTermsIfVisible(page: Page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  let shouldAccept = await termsBtn.isVisible();
  if (!shouldAccept) {
    try {
      await termsBtn.waitFor({ state: "visible", timeout: 5000 });
      shouldAccept = true;
    } catch {
      shouldAccept = false;
    }
  }

  if (!shouldAccept) return;

  await termsBtn.scrollIntoViewIfNeeded();
  await clickWithBackdropRetry(page, termsBtn);
  await expect(termsBtn).toBeHidden({ timeout: 15000 });
  await expect(
    page.locator('[data-scope="dialog"][data-part="backdrop"][data-state="open"]')
  ).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId("InformationWindow")).toBeHidden({
    timeout: 15000,
  });
}

async function clickWithBackdropRetry(page: Page, locator: Locator) {
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
      await page.waitForTimeout(200);
    }
  }

  await locator.click({ force: true });
}

function buildMcpSeedSession(args: {
  staleAuthorization: string;
  staticToken: string;
}) {
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
        tools: {
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
        },
        toolsEnabled: {
          dataType: "Set",
          value: [mcpServiceLabels.userData, mcpServiceLabels.static],
        },
        top_p: 1,
        stream: true,
        assistant: "",
        mcpAuthConfigs: {
          dataType: "Map",
          value: [
            [
              mcpServiceLabels.userData,
              {
                mode: "user-data",
                selectedFields: ["email", "name"],
              },
            ],
            [
              mcpServiceLabels.static,
              {
                mode: "static",
                staticToken: args.staticToken,
              },
            ],
          ],
        },
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
  await page.route("**/.well-known/jwks.json", async (route) => {
    jwksRequestCount.count += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(jwks),
    });
  });
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
  await page.waitForFunction(
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
        userAuth &&
        userAuth !== staleAuthorization &&
        staticAuth === staticToken
      );
    },
    args
  );
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
    await page.waitForURL(loginEndpointPattern, {
      timeout: 50000,
      waitUntil: "commit",
    });
  });

  test("shows user information after successful fetch", async ({
    page,
    isMobile,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("SESSIONS");
      localStorage.removeItem("CHAT_HISTORY");
    });

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
    await expect(page.getByTestId("UserInformationBtn")).toBeVisible({
      timeout: 10000,
    });
    if (!isMobile) {
      await expect(page.getByTestId("LeftSideBar")).toBeVisible({
        timeout: 10000,
      });
    }
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
    await acceptTermsIfVisible(page);

    await waitForMcpAuthRefresh(page, {
      staleAuthorization,
      staticToken,
      userLabel: mcpServiceLabels.userData,
      staticLabel: mcpServiceLabels.static,
    });

    expect(jwksRequestCount.count).toBeGreaterThan(0);
  });
});
