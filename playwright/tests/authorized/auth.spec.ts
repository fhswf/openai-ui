import { test, expect } from "../baseFixtures";
import crypto from "node:crypto";
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

const userEndpointPattern = /\/(?:api\/)?user(?:\?.*)?$/;
const loginEndpointPattern = /\/(?:api\/)?login(?:\?.*)?$/;

async function acceptTermsIfVisible(page: Page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  let shouldAccept = await termsBtn.isVisible();
  if (!shouldAccept) {
    try {
      await termsBtn.waitFor({ state: "visible", timeout: 5000 });
      shouldAccept = true;
    } catch {
      // Terms dialog did not appear; continue.
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

function buildSessionWithGravatar(gravatar: boolean) {
  return {
    options: {
      account: {
        name: "Anonymus",
        avatar: "",
        terms: true,
      },
      general: {
        language: "de",
        theme: "light",
        sendCommand: "COMMAND_ENTER",
        size: "normal",
        codeEditor: false,
        gravatar,
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
        tools: { dataType: "Map", value: [] },
        toolsEnabled: { dataType: "Set", value: [] },
        top_p: 1,
        stream: true,
        assistant: "",
        mcpAuthConfigs: { dataType: "Map", value: [] },
      },
    },
  };
}

test.describe("Authentication (fetchAndGetUser)", () => {
  test("redirects to login when user endpoint returns 401", async ({
    page,
  }) => {
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
        body: "<html><body>Login</body></html>",
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(loginEndpointPattern, { timeout: 50000 });
    await expect(page.getByText("Login")).toBeVisible();
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

  test("gravatar enabled uses identicon fallback when no gravatar", async ({
    page,
  }) => {
    const session = buildSessionWithGravatar(true);
    await page.addInitScript((value) => {
      localStorage.setItem("SESSIONS", value);
    }, JSON.stringify(session));

    await page.route(userEndpointPattern, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    const hash = crypto
      .createHash("sha256")
      .update(mockUser.email)
      .digest("hex");

    await page.route(`**/gravatar.com/${hash}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/plain",
        body: "not found",
      });
    });

    await page.goto("/");
    await acceptTermsIfVisible(page);

    const avatarImg = page.getByTestId("UserInformationBtn").locator("img");

    await expect(avatarImg).toHaveAttribute(
      "src",
      new RegExp(`gravatar\\.com/avatar/${hash}\\?d=identicon`)
    );
  });
});
