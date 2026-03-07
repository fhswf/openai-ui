import { test, expect } from "../baseFixtures";

test.skip(
  ({ isMobile, browserName }) => isMobile || browserName === "webkit",
  "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("MCP Auth", () => {
  const mockUser = {
    name: "Christian Gawron",
    email: "gawron.christian@fh-swf.de",
    sub: "8414053a-25d6-482b-901f-b676d810ebca",
    preferred_username: "chgaw002",
    affiliations: {
      "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
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

  let jwksRequestCount = 0;

  test.beforeEach(async ({ page }) => {
    jwksRequestCount = 0;
    await page.route("**/api/user**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
      });
    });
    await page.route("**/.well-known/jwks.json", async (route) => {
      jwksRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(jwks),
      });
    });
    await page.goto("/");
    await expect(page.getByTestId("LeftSideBar")).toBeVisible({
      timeout: 10000,
    });

    const termsBtn = page.getByTestId("accept-terms-btn");
    if (await termsBtn.isVisible()) {
      await termsBtn.click();
    }
  });

  async function openMcpDialog(page) {
    await page.getByTestId("chat-options-btn").click();
    await page.getByTestId("mcp-services-menu-trigger").click();
    await page.getByTestId("mcp-add-remove-services").click();
  }

  async function fillServiceBase(page, label: string, url: string) {
    await page.locator('input[name="label"]').fill(label);
    await page.locator('input[name="server_url"]').fill(url);
  }

  type AuthMode = "none" | "static" | "user-data";

  async function setAuthMode(page, mode: AuthMode) {
    await page.getByTestId(`mcp-auth-mode-${mode}`).click();
  }

  async function toggleUserFields(page, fields: string[]) {
    for (const field of fields) {
      await page.getByTestId(`mcp-auth-field-${field}`).click();
    }
  }

  async function createService(page, args: {
    label: string;
    url: string;
    mode: AuthMode;
    staticToken?: string;
    selectedFields?: string[];
  }) {
    await fillServiceBase(page, args.label, args.url);
    await setAuthMode(page, args.mode);
    if (args.mode === "static" && args.staticToken) {
      await page
        .getByTestId("mcp-auth-static-token-input")
        .fill(args.staticToken);
    }
    if (args.mode === "user-data" && args.selectedFields) {
      await toggleUserFields(page, args.selectedFields);
    }
    await page.getByTestId("mcp-add-service-btn").click();
  }

  test.describe("JWKS fetching", () => {
    test("skips JWKS for static auth", async ({ page }) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "Static Auth Service",
        url: "https://static.example.com",
        mode: "static",
        staticToken: "token-123",
      });

      await expect(page.getByText("Static Auth Service")).toBeVisible();
      expect(jwksRequestCount).toBe(0);
    });

    test("requests JWKS for user-data auth", async ({ page }) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "User Data Service",
        url: "https://userdata.example.com",
        mode: "user-data",
        selectedFields: ["email"],
      });

      await expect(page.getByText("User Data Service")).toBeVisible();
      await expect.poll(() => jwksRequestCount).toBe(1);
    });
  });

  test.describe("Mode transitions", () => {
    test("clears user-data fields when switching modes", async ({ page }) => {
      await openMcpDialog(page);

      await setAuthMode(page, "user-data");
      await toggleUserFields(page, ["email"]);
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).toBeChecked();

      await setAuthMode(page, "static");
      await setAuthMode(page, "user-data");

      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).not.toBeChecked();
    });

    test("clears static token when switching away", async ({ page }) => {
      await openMcpDialog(page);

      await setAuthMode(page, "static");
      await page.getByTestId("mcp-auth-static-token-input").fill("secret");
      await setAuthMode(page, "none");
      await setAuthMode(page, "static");

      await expect(
        page.getByTestId("mcp-auth-static-token-input")
      ).toHaveValue("");
    });
  });

  test.describe("Editing and persistence", () => {
    test("preserves selected fields when editing user-data auth", async ({
      page,
    }) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "Preserve Fields",
        url: "https://preserve.example.com",
        mode: "user-data",
        selectedFields: ["email", "name"],
      });

      await page.getByTestId("mcp-edit-Preserve Fields").click();
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).toBeChecked();
      await expect(
        page.getByTestId("mcp-auth-field-name-control")
      ).toBeChecked();
    });

    test("renaming service preserves auth config", async ({ page }) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "Rename Me",
        url: "https://rename.example.com",
        mode: "user-data",
        selectedFields: ["email"],
      });

      await page.getByTestId("mcp-edit-Rename Me").click();
      await page.locator('input[name="label"]').fill("Renamed Service");
      await page.getByTestId("mcp-add-service-btn").click();

      await expect(page.getByText("Renamed Service")).toBeVisible();
      await page.getByTestId("mcp-edit-Renamed Service").click();
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).toBeChecked();
    });
  });

  test.describe("Legacy sessions", () => {
    test("legacy config without selectedFields does not crash", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const raw = localStorage.getItem("SESSIONS");
        const session = raw ? JSON.parse(raw) : {};
        if (!session.options) session.options = {};
        if (!session.options.openai) session.options.openai = {};

        session.options.openai.mcpAuthConfigs = {
          dataType: "Map",
          value: [["FH SWF (beta)", { mode: "user-data" }]],
        };

        localStorage.setItem("SESSIONS", JSON.stringify(session));
      });

      await page.reload();
      await expect(page.getByTestId("LeftSideBar")).toBeVisible({
        timeout: 10000,
      });

      const termsBtn = page.getByTestId("accept-terms-btn");
      if (await termsBtn.isVisible()) {
        await termsBtn.click();
      }

      await openMcpDialog(page);
      await page.getByTestId("mcp-edit-FH SWF (beta)").click();

      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).not.toBeChecked();
    });

    test("missing mcpAuthConfigs does not crash", async ({ page }) => {
      await page.addInitScript(() => {
        const raw = localStorage.getItem("SESSIONS");
        const session = raw ? JSON.parse(raw) : {};
        if (!session.options) session.options = {};
        if (!session.options.openai) session.options.openai = {};

        delete session.options.openai.mcpAuthConfigs;
        localStorage.setItem("SESSIONS", JSON.stringify(session));
      });

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("LeftSideBar")).toBeVisible({
        timeout: 10000,
      });

      const termsBtn = page.getByTestId("accept-terms-btn");
      if (await termsBtn.isVisible()) {
        await termsBtn.click();
      }

      await openMcpDialog(page);
      await page.getByTestId("mcp-edit-FH SWF (beta)").click();

      await expect(page.getByTestId("mcp-auth-fields-container")).toHaveCount(0);

      await setAuthMode(page, "user-data");
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).not.toBeChecked();
    });

    test("missing mcpAuthConfigs on fresh login does not crash", async ({
      browser,
    }) => {
      const context = await browser.newContext({
        storageState: "playwright/.auth/user.json",
      });
      const page = await context.newPage();

      await page.route("**/api/user**", async (route) => {
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
          body: JSON.stringify(jwks),
        });
      });

      await page.addInitScript(() => {
        const raw = localStorage.getItem("SESSIONS");
        const session = raw ? JSON.parse(raw) : {};
        if (!session.options) session.options = {};
        if (!session.options.openai) session.options.openai = {};

        delete session.options.openai.mcpAuthConfigs;
        localStorage.setItem("SESSIONS", JSON.stringify(session));
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("LeftSideBar")).toBeVisible({
        timeout: 10000,
      });

      const termsBtn = page.getByTestId("accept-terms-btn");
      if (await termsBtn.isVisible()) {
        await termsBtn.click();
      }

      await openMcpDialog(page);
      await page.getByTestId("mcp-edit-FH SWF (beta)").click();

      await expect(page.getByTestId("mcp-auth-fields-container")).toHaveCount(0);

      await setAuthMode(page, "user-data");
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await expect(
        page.getByTestId("mcp-auth-field-email-control")
      ).not.toBeChecked();

      await context.close();
    });
  });
});
