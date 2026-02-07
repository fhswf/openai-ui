import { test, expect } from "../baseFixtures";

test.skip(
  ({ isMobile, browserName }) => isMobile || browserName === "webkit",
  "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("User Interface", () => {
  test.beforeEach(async ({ page }) => {
    // Mock user
    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "Christian Gawron",
          email: "gawron.christian@fh-swf.de",
          sub: "8414053a-25d6-482b-901f-b676d810ebca",
          preferred_username: "chgaw002",
          affiliations: {
            "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
          },
        }),
      });
    });

    // Intercept Gravatar to avoid external requests
    await page.route("**/gravatar.com/**", (route) =>
      route.fulfill({ status: 200 })
    );

    // Visit page
    await page.goto("/");

    // Wait for user to be loaded and access granted (SideBar is part of main layout)
    // If this fails, it means specific user mock is not accepted or fetch failed
    await expect(page.getByTestId("LeftSideBar")).toBeVisible({
      timeout: 10000,
    });

    // Conditionally accept terms (if not already accepted in storage state)
    const termsBtn = page.getByTestId("accept-terms-btn");
    if (await termsBtn.isVisible()) {
      await termsBtn.click();
    }
  });

  test("Check the headline", async ({ page }) => {
    await expect(page.getByTestId("HeaderTitle")).toContainText("K!mpuls");
  });

  test("Show infos", async ({ page }) => {
    await expect(page.getByTestId("InformationWindow")).not.toBeVisible();
    await page.getByTestId("aboutBtn").click();
    await expect(page.getByTestId("InformationWindow")).toBeVisible();
  });
});

test.describe("Dark Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        // Using minimal user object
        body: JSON.stringify({
          name: "Christian Gawron",
          email: "gawron.christian@fh-swf.de",
          sub: "8414053a-25d6-482b-901f-b676d810ebca",
          preferred_username: "chgaw002",
          affiliations: {
            "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
          },
        }),
      });
    });
    // Visit page
    await page.goto("/");
    // Wait for user to be loaded
    await expect(page.getByTestId("LeftSideBar")).toBeVisible({
      timeout: 10000,
    });

    // Conditionally accept terms
    const termsBtn = page.getByTestId("accept-terms-btn");
    if (await termsBtn.isVisible()) {
      await termsBtn.click();
    }
  });

  test("Down Left Button (Theme toggle)", async ({ page }) => {
    const html = page.locator("html");

    // Force light to start to match Cypress assumption
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "light")
    );
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByTestId("OptionDarkModeSelect").click();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.getByTestId("OptionDarkModeSelect").click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("In Settings", async ({ page }) => {
    await page.getByTestId("OpenConfigBtn").click();
    const html = page.locator("html");

    // Force light to start
    await page.evaluate(() =>
      document.documentElement.setAttribute("data-theme", "light")
    );
    await expect(html).toHaveAttribute("data-theme", "light");

    // Select Dark in settings (Radio Group)
    await page.getByTestId("themeSelectdark").click({ force: true });
    await expect(html).toHaveAttribute("data-theme", "dark");

    // Select Light in settings
    await page.getByTestId("themeSelectlight").click({ force: true });
    await expect(html).toHaveAttribute("data-theme", "light");
  });
});

test.describe("User Information", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          name: "Christian Gawron",
          email: "gawron.christian@fh-swf.de",
          sub: "8414053a-25d6-482b-901f-b676d810ebca",
          preferred_username: "chgaw002",
          affiliations: {
            "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
          },
        }),
      });
    });
    await page.goto("/");
    // Wait for user to be loaded
    await expect(page.getByTestId("LeftSideBar")).toBeVisible({
      timeout: 10000,
    });

    // Conditionally accept terms
    const termsBtn = page.getByTestId("accept-terms-btn");
    if (await termsBtn.isVisible()) {
      await termsBtn.click();
    }
  });

  test("Open and close user information", async ({ page }) => {
    await expect(page.getByTestId("UserInformation")).not.toBeVisible();
    await page.getByTestId("UserInformationBtn").click();
    await expect(page.getByTestId("UserInformation")).toBeVisible();
    await page.getByTestId("UserInformationBtn").click();
    await expect(page.getByTestId("UserInformation")).not.toBeVisible();
  });
});

test.describe("Config Menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({
          name: "Christian Gawron",
          email: "gawron.christian@fh-swf.de",
          sub: "8414053a-25d6-482b-901f-b676d810ebca",
          preferred_username: "chgaw002",
          affiliations: {
            "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
          },
        }),
      });
    });
    // Visit page
    await page.goto("/");
    // Wait for user to be loaded
    await expect(page.getByTestId("LeftSideBar")).toBeVisible({
      timeout: 10000,
    });

    // Conditionally accept terms
    const termsBtn = page.getByTestId("accept-terms-btn");
    if (await termsBtn.isVisible()) {
      await termsBtn.click();
    }

    await page.getByTestId("OpenConfigBtn").click();
  });

  test("Set api base url input", async ({ page }) => {
    const input = page.getByTestId("ApiBaseURLInput");
    await input.clear();
    await expect(input).toHaveValue("");
    await input.fill("a_playwright_input_test");
    await expect(input).toHaveValue("a_playwright_input_test");
  });

  test("Set api key input", async ({ page }) => {
    const input = page.getByTestId("APIKeyInput");
    await input.clear();
    await expect(input).toHaveValue("");
    await input.fill("a_playwright_input_test");
    await expect(input).toHaveValue("a_playwright_input_test");
  });

  test("Set organisation id input", async ({ page }) => {
    const input = page.getByTestId("APIOrganisationIDInput");
    await input.clear();
    await expect(input).toHaveValue("");
    await input.fill("a_playwright_id_test");
    await expect(input).toHaveValue("a_playwright_id_test");
  });

  test("Close the settings", async ({ page }) => {
    await page.getByTestId("SettingsCloseBtn").click();
    // Verifying Settings is closed.
    await expect(page.getByTestId("SettingsHeader")).not.toBeVisible();
  });
});
test.describe("MCP Services", () => {
  const mockUser = {
    name: "Christian Gawron",
    email: "gawron.christian@fh-swf.de",
    sub: "8414053a-25d6-482b-901f-b676d810ebca",
    preferred_username: "chgaw002",
    affiliations: {
      "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
    },
  };

  test.beforeEach(async ({ page }) => {
    await page.route("**/api/user", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockUser),
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

  test("should display MCP dialog with all form fields", async ({ page }) => {
    await openMcpDialog(page);

    await expect(page.locator('input[name="label"]')).toBeVisible();
    await expect(page.locator('input[name="server_url"]')).toBeVisible();
    await expect(
      page.getByTestId("mcp-require-approval-trigger")
    ).toBeVisible();
    await expect(page.locator('input[name="allowed_tools"]')).toBeVisible();
    await expect(page.getByTestId("mcp-auth-mode-group")).toBeVisible();
  });

  test("should handle all authorization mode transitions", async ({ page }) => {
    await openMcpDialog(page);

    await page.getByTestId("mcp-auth-mode-static").click();
    await expect(page.getByTestId("mcp-auth-static-token-input")).toBeVisible();
    await page.getByTestId("mcp-auth-static-token-input").fill("test-token");

    await page.getByTestId("mcp-auth-mode-user-data").click();
    await expect(
      page.getByTestId("mcp-auth-static-token-input")
    ).not.toBeVisible();
    await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();

    await expect(page.getByTestId("mcp-auth-field-name")).toBeVisible();
    await expect(page.getByTestId("mcp-auth-field-email")).toBeVisible();

    const emailControl = page.getByTestId("mcp-auth-field-email-control");
    await page.getByTestId("mcp-auth-field-email").click();
    await expect(emailControl).toBeChecked();
    await page.getByTestId("mcp-auth-field-email").click();
    await expect(emailControl).not.toBeChecked();

    await page.getByTestId("mcp-auth-mode-none").click();
    await expect(
      page.getByTestId("mcp-auth-fields-container")
    ).not.toBeVisible();
  });
  test("should validate required fields before adding service", async ({
    page,
  }) => {
    let alertCount = 0;
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toContain("required");
      alertCount++;
      await dialog.accept();
    });

    await openMcpDialog(page);

    await page.getByTestId("mcp-add-service-btn").click();

    await page.locator('input[name="server_url"]').fill("https://example.com");
    await page.getByTestId("mcp-add-service-btn").click();

    await page.locator('input[name="server_url"]').clear();
    await page.locator('input[name="label"]').fill("Test");
    await page.getByTestId("mcp-add-service-btn").click();

    expect(alertCount).toBeGreaterThanOrEqual(2);
  });

  test("should edit, update, and delete MCP service", async ({ page }) => {
    await openMcpDialog(page);

    await page.locator('input[name="label"]').fill("Original Service");
    await page
      .locator('input[name="server_url"]')
      .fill("https://original.example.com");
    await page.locator('input[name="allowed_tools"]').fill("read, write");
    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("Original Service")).toBeVisible();

    await page.getByTestId("mcp-edit-Original Service").click();
    await expect(page.locator('input[name="label"]')).toHaveValue(
      "Original Service"
    );
    await expect(page.locator('input[name="server_url"]')).toHaveValue(
      "https://original.example.com"
    );
    await expect(page.locator('input[name="allowed_tools"]')).toHaveValue(
      "read,write"
    );

    await page.locator('input[name="label"]').clear();
    await page.locator('input[name="label"]').fill("Updated Service");
    await page.locator('input[name="server_url"]').clear();
    await page
      .locator('input[name="server_url"]')
      .fill("https://updated.example.com");
    await page.getByTestId("mcp-auth-mode-static").click();
    await page.getByTestId("mcp-auth-static-token-input").fill("new-token");

    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("Updated Service")).toBeVisible();

    await page.getByTestId("mcp-delete-Updated Service").click();
    await expect(page.getByText("Updated Service")).not.toBeVisible();
  });

  test("should handle edge cases gracefully", async ({ page }) => {
    await openMcpDialog(page);

    await page.locator('input[name="label"]').fill("Edge Case Service");
    await page
      .locator('input[name="server_url"]')
      .fill("https://edge.example.com");
    await page.getByTestId("mcp-auth-mode-static").click();
    await page.getByTestId("mcp-auth-static-token-input").fill("   ");
    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("Edge Case Service")).toBeVisible();

    await page.locator('input[name="label"]').fill("No Fields Service");
    await page
      .locator('input[name="server_url"]')
      .fill("https://nofields.example.com");
    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("No Fields Service")).toBeVisible();

    const serviceRow = page.locator("text=Edge Case Service").locator("..");
    const checkbox = serviceRow.locator('[data-part="control"]').first();
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("data-state", "checked");
    await checkbox.click();
    await expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  test("should handle errors when fetching MCP server public key", async ({
    page,
  }) => {
    await page.route("**/.well-known/jwks.json", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server error" }),
      });
    });

    await openMcpDialog(page);

    await page.locator('input[name="label"]').fill("Error Service");
    await page
      .locator('input[name="server_url"]')
      .fill("https://error.example.com");
    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(page.locator('input[name="label"]')).toBeVisible();
  });

  test("should edit service with user-data auth and preserve config", async ({
    page,
  }) => {
    await openMcpDialog(page);

    await page.locator('input[name="label"]').fill("Preserved Auth Service");
    await page
      .locator('input[name="server_url"]')
      .fill("https://preserved.example.com");
    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-add-service-btn").click();

    await page.getByTestId("mcp-edit-Preserved Auth Service").click();
    await expect(page.locator('input[name="label"]')).toHaveValue(
      "Preserved Auth Service"
    );
    await expect(page.locator('input[name="server_url"]')).toHaveValue(
      "https://preserved.example.com"
    );
  });
});
