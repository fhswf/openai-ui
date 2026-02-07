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
    await page.route("**/api/user", async (route) => {
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

  test("static auth does not request JWKS", async ({ page }) => {
    await openMcpDialog(page);

    await fillServiceBase(
      page,
      "Static Auth Service",
      "https://static.example.com"
    );
    await page.getByTestId("mcp-auth-mode-static").click();
    await page.getByTestId("mcp-auth-static-token-input").fill("token-123");
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(page.getByText("Static Auth Service")).toBeVisible();
    expect(jwksRequestCount).toBe(0);
  });

  test("user-data auth requests JWKS", async ({ page }) => {
    await openMcpDialog(page);

    await fillServiceBase(
      page,
      "User Data Service",
      "https://userdata.example.com"
    );
    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(page.getByText("User Data Service")).toBeVisible();
    await expect.poll(() => jwksRequestCount).toBe(1);
  });

  test("preserves selected fields when editing user-data auth", async ({
    page,
  }) => {
    await openMcpDialog(page);

    await fillServiceBase(
      page,
      "Preserve Fields",
      "https://preserve.example.com"
    );
    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-auth-field-name").click();
    await page.getByTestId("mcp-add-service-btn").click();

    await page.getByTestId("mcp-edit-Preserve Fields").click();
    await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
    await expect(
      page.getByTestId("mcp-auth-field-email-control")
    ).toBeChecked();
    await expect(page.getByTestId("mcp-auth-field-name-control")).toBeChecked();
  });

  test("clears user-data fields when switching modes", async ({ page }) => {
    await openMcpDialog(page);

    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-auth-field-email").click();
    await expect(
      page.getByTestId("mcp-auth-field-email-control")
    ).toBeChecked();

    await page.getByTestId("mcp-auth-mode-static").click();
    await page.getByTestId("mcp-auth-mode-user-data").click();

    await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
    await expect(
      page.getByTestId("mcp-auth-field-email-control")
    ).not.toBeChecked();
  });

  test("clears static token when switching away", async ({ page }) => {
    await openMcpDialog(page);

    await page.getByTestId("mcp-auth-mode-static").click();
    await page.getByTestId("mcp-auth-static-token-input").fill("secret");
    await page.getByTestId("mcp-auth-mode-none").click();
    await page.getByTestId("mcp-auth-mode-static").click();

    await expect(page.getByTestId("mcp-auth-static-token-input")).toHaveValue(
      ""
    );
  });

  test("renaming service preserves auth config", async ({ page }) => {
    await openMcpDialog(page);

    await fillServiceBase(page, "Rename Me", "https://rename.example.com");
    await page.getByTestId("mcp-auth-mode-user-data").click();
    await page.getByTestId("mcp-auth-field-email").click();
    await page.getByTestId("mcp-add-service-btn").click();

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
