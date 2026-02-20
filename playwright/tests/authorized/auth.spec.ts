import { test, expect } from "../baseFixtures";
import crypto from "node:crypto";

const mockUser = {
  name: "Playwright Auth",
  email: "auth.user@fh-swf.de",
  sub: "test-user",
  preferred_username: "auth.user",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

async function acceptTermsIfVisible(page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  if (await termsBtn.isVisible()) {
    await termsBtn.click();
    return;
  }
  try {
    await termsBtn.waitFor({ state: "visible", timeout: 3000 });
    await termsBtn.click();
  } catch {
    // Terms dialog did not appear; continue.
  }
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
    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/api/login**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Login</body></html>",
      });
    });

    await page.goto("/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/api\/login/);
    await expect(page.getByText("Login")).toBeVisible();
  });

  test("shows user information after successful fetch", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("SESSIONS");
      localStorage.removeItem("CHAT_HISTORY");
    });

    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });

    const userResponse = page.waitForResponse(/\/api\/user/);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await userResponse;
    await expect(page.getByTestId("LeftSideBar")).toBeVisible({
      timeout: 10000,
    });
    await acceptTermsIfVisible(page);

    const popover = page.getByTestId("UserInformation");
    await page.getByTestId("UserInformationBtn").click();
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

    await page.route("**/api/user", async (route) => {
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

    const avatarImg = page
      .getByTestId("UserInformationBtn")
      .locator("img");

    await expect(avatarImg).toHaveAttribute(
      "src",
      new RegExp(`gravatar\\.com/avatar/${hash}\\?d=identicon`)
    );
  });
});
