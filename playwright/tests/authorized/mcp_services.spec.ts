import { test, expect } from "../baseFixtures";

test.skip(
  ({ isMobile, browserName }) => isMobile || browserName === "webkit",
  "Tests depend on Sidebar visibility and fail on WebKit"
);

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

  test.beforeEach(async ({ page }) => {
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

  type AuthMode = "none" | "static" | "user-data";

  async function setAuthMode(page, mode: AuthMode) {
    await page.getByTestId(`mcp-auth-mode-${mode}`).click();
  }

  async function fillServiceBase(
    page,
    args: { label: string; url: string; allowedTools?: string }
  ) {
    await page.locator('input[name="label"]').fill(args.label);
    await page.locator('input[name="server_url"]').fill(args.url);
    if (args.allowedTools !== undefined) {
      await page.locator('input[name="allowed_tools"]').fill(args.allowedTools);
    }
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

    await setAuthMode(page, "static");
    await expect(page.getByTestId("mcp-auth-static-token-input")).toBeVisible();
    await page.getByTestId("mcp-auth-static-token-input").fill("test-token");

    await setAuthMode(page, "user-data");
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

    await setAuthMode(page, "none");
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

    await fillServiceBase(page, {
      label: "Original Service",
      url: "https://original.example.com",
      allowedTools: "read, write",
    });
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
    await setAuthMode(page, "static");
    await page.getByTestId("mcp-auth-static-token-input").fill("new-token");

    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("Updated Service")).toBeVisible();

    await page.getByTestId("mcp-delete-Updated Service").click();
    await expect(page.getByText("Updated Service")).not.toBeVisible();
  });

  test("should handle edge cases gracefully", async ({ page }) => {
    await openMcpDialog(page);

    await fillServiceBase(page, {
      label: "Edge Case Service",
      url: "https://edge.example.com",
    });
    await setAuthMode(page, "static");
    await page.getByTestId("mcp-auth-static-token-input").fill("   ");
    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("Edge Case Service")).toBeVisible();

    await fillServiceBase(page, {
      label: "No Fields Service",
      url: "https://nofields.example.com",
    });
    await setAuthMode(page, "user-data");
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
    await page.unroute("**/.well-known/jwks.json");
    await page.route("**/.well-known/jwks.json", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Server error" }),
      });
    });

    await openMcpDialog(page);

    await fillServiceBase(page, {
      label: "Error Service",
      url: "https://error.example.com",
    });
    await setAuthMode(page, "user-data");
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(page.locator('input[name="label"]')).toBeVisible();
  });

  test("should edit service with user-data auth and preserve config", async ({
    page,
  }) => {
    await openMcpDialog(page);

    await fillServiceBase(page, {
      label: "Preserved Auth Service",
      url: "https://preserved.example.com",
    });
    await setAuthMode(page, "user-data");
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(
      page.getByTestId("mcp-edit-Preserved Auth Service")
    ).toBeVisible();
    await page.getByTestId("mcp-edit-Preserved Auth Service").click();
    await expect(page.locator('input[name="label"]')).toHaveValue(
      "Preserved Auth Service"
    );
    await expect(page.locator('input[name="server_url"]')).toHaveValue(
      "https://preserved.example.com"
    );
  });
});
