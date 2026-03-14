import { test, expect } from "../baseFixtures";
import type { Locator, Page } from "@playwright/test";

test.skip(
  ({ isMobile }) => isMobile,
  "Tests depend on the desktop toolbar layout"
);

const APP_READY_TIMEOUT = 15000;
const DISABLE_ANIMATIONS_STYLE = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
    scroll-behavior: auto !important;
  }
`;

test.describe("MCP Services", () => {
  const labelFieldPattern = /Label|Bezeichnung/i;
  const serverUrlFieldPattern = /Server URL|Server-URL/i;
  const allowedToolsFieldPattern = /Allowed Tools|Erlaubte Werkzeuge/i;
  const discoveredScopes = {
    scopes_supported: [
      { scope: "email", description: "Email address" },
      { scope: "name", description: "Display name" },
    ],
  };
  const openIdConfiguration = {
    issuer: "https://service.example.com",
    jwks_uri: "https://service.example.com/.well-known/jwks.json",
    scopes_supported: discoveredScopes.scopes_supported,
  };
  const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;
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

  async function disableAnimations(page: Page) {
    // Neutralize animations for cross-browser timing consistency
    await page.addStyleTag({ content: DISABLE_ANIMATIONS_STYLE });
  }

  async function waitForAuthorizedShell(page: Page) {
    await disableAnimations(page);
    await expect(page.getByTestId("chat-options-btn")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
  }

  async function acceptTermsIfVisible(page: Page) {
    const termsBtn = page.getByTestId("accept-terms-btn");
    if ((await termsBtn.count()) === 0) return;

    await expect(termsBtn).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await termsBtn.scrollIntoViewIfNeeded();
    await termsBtn.click();
  }

  async function waitForDiscoveredScopes(page: Page) {
    await expect(page.getByTestId("mcp-auth-scope-name")).toBeVisible();
    await expect(page.getByTestId("mcp-auth-scope-email")).toBeVisible();
    await expect(getUserDataConsentCheckbox(page)).toBeVisible();
  }

  test.beforeEach(async ({ page }) => {
    // Mocked to eliminate network timing variance across browsers
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
        body: JSON.stringify(jwks),
      });
    });
    await page.route("**/.well-known/openid-configuration", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(openIdConfiguration),
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForAuthorizedShell(page);
    await acceptTermsIfVisible(page);
  });

  function getLabelInput(page: Page) {
    return page.getByLabel(labelFieldPattern);
  }

  function getServerUrlInput(page: Page) {
    return page.getByLabel(serverUrlFieldPattern);
  }

  function getAllowedToolsInput(page: Page) {
    return page.getByLabel(allowedToolsFieldPattern);
  }

  function getUserDataConsentCheckbox(page: Page) {
    return page.getByRole("checkbox", { name: /I agree|Ich stimme/i });
  }

  function getUserDataConsentLabel(page: Page) {
    return page.getByTestId("mcp-auth-consent");
  }

  async function focusAndFill(locator: Locator, value: string) {
    await expect(locator).toBeVisible();
    await expect(locator).toBeEditable();
    await locator.click();
    await locator.fill(value);
  }

  async function openMcpDialog(page: Page) {
    const chatOptionsButton = page.getByTestId("chat-options-btn");
    await expect(chatOptionsButton).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await chatOptionsButton.click();

    const servicesMenuTrigger = page.getByTestId("mcp-services-menu-trigger");
    await expect(servicesMenuTrigger).toBeVisible();
    await servicesMenuTrigger.click();

    const addRemoveServicesButton = page.getByTestId("mcp-add-remove-services");
    await expect(addRemoveServicesButton).toBeVisible();
    await addRemoveServicesButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  type AuthMode = "none" | "static" | "user-data";

  function getModeInput(page: Page, mode: AuthMode) {
    return page
      .getByTestId(`mcp-auth-mode-${mode}`)
      .getByRole("radio", { includeHidden: true });
  }

  async function expectModeChecked(page: Page, mode: AuthMode) {
    await expect(getModeInput(page, mode)).toBeChecked();
  }

  async function setAuthMode(page: Page, mode: AuthMode) {
    const modeOption = page.getByTestId(`mcp-auth-mode-${mode}`);
    await expect(modeOption).toBeVisible();
    await modeOption.click();
    await expectModeChecked(page, mode);
  }

  async function fillServiceBase(
    page: Page,
    args: { label: string; url: string; allowedTools?: string }
  ) {
    await focusAndFill(getLabelInput(page), args.label);
    await focusAndFill(getServerUrlInput(page), args.url);
    if (args.allowedTools !== undefined) {
      await focusAndFill(getAllowedToolsInput(page), args.allowedTools);
    }
  }

  test("should display MCP dialog with all form fields", async ({ page }) => {
    await openMcpDialog(page);

    await expect(getLabelInput(page)).toBeVisible();
    await expect(getServerUrlInput(page)).toBeVisible();
    await expect(
      page.getByTestId("mcp-require-approval-trigger")
    ).toBeVisible();
    await expect(getAllowedToolsInput(page)).toBeVisible();
    await expect(page.getByTestId("mcp-auth-mode-group")).toBeVisible();
  });

  test("should show user-data consent after switching auth modes", async ({
    page,
  }) => {
    await openMcpDialog(page);

    await setAuthMode(page, "static");
    await expect(page.getByTestId("mcp-auth-static-token-input")).toBeVisible();
    await focusAndFill(
      page.getByTestId("mcp-auth-static-token-input"),
      "test-token"
    );

    await setAuthMode(page, "user-data");
    await expect(
      page.getByTestId("mcp-auth-static-token-input")
    ).not.toBeVisible();
    await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
    await waitForDiscoveredScopes(page);

    const consentControl = getUserDataConsentCheckbox(page);
    await getUserDataConsentLabel(page).click();
    await expect(consentControl).toBeChecked();
    await getUserDataConsentLabel(page).click();
    await expect(consentControl).not.toBeChecked();
  });

  test("should validate required fields before adding service", async ({
    page,
  }) => {
    let alertCount = 0;
    page.on("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/required|Pflichtfelder/i);
      alertCount++;
      await dialog.accept();
    });

    await openMcpDialog(page);

    await page.getByTestId("mcp-add-service-btn").click();

    await focusAndFill(getServerUrlInput(page), "https://example.com");
    await page.getByTestId("mcp-add-service-btn").click();

    await getServerUrlInput(page).clear();
    await focusAndFill(getLabelInput(page), "Test");
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
    await expect(getLabelInput(page)).toHaveValue("Original Service");
    await expect(getServerUrlInput(page)).toHaveValue(
      "https://original.example.com"
    );
    await expect(getAllowedToolsInput(page)).toHaveValue("read,write");

    await getLabelInput(page).clear();
    await focusAndFill(getLabelInput(page), "Updated Service");
    await getServerUrlInput(page).clear();
    await focusAndFill(getServerUrlInput(page), "https://updated.example.com");
    await setAuthMode(page, "static");
    await focusAndFill(
      page.getByTestId("mcp-auth-static-token-input"),
      "new-token"
    );

    await page.getByTestId("mcp-add-service-btn").click();
    await expect(
      page.getByText("Updated Service", { exact: true })
    ).toBeVisible();

    await page.getByTestId("mcp-delete-Updated Service").click();
    await expect(
      page.getByText("Updated Service", { exact: true })
    ).toHaveCount(0);
  });

  test("should handle edge cases gracefully", async ({ page }) => {
    await openMcpDialog(page);

    await fillServiceBase(page, {
      label: "Edge Case Service",
      url: "https://edge.example.com",
    });
    await setAuthMode(page, "static");
    await focusAndFill(page.getByTestId("mcp-auth-static-token-input"), "   ");
    await page.getByTestId("mcp-add-service-btn").click();
    await expect(page.getByText("Edge Case Service")).toBeVisible();

    await page.route(
      /^https:\/\/consent-required\.example\.com\/?$/,
      async (route) => {
        // Mocked to eliminate network timing variance across browsers
        await route.fulfill({
          status: 204,
          body: "",
        });
      }
    );

    await fillServiceBase(page, {
      label: "Consent Required Service",
      url: "https://consent-required.example.com",
    });
    await setAuthMode(page, "user-data");
    await waitForDiscoveredScopes(page);
    await page.getByTestId("mcp-add-service-btn").click();
    await expect(
      page.getByText("Consent Required Service", { exact: true })
    ).toBeVisible();
    await expect(getUserDataConsentCheckbox(page)).not.toBeChecked();

    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();

    const chatOptionsButton = page.getByTestId("chat-options-btn");
    await expect(chatOptionsButton).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await chatOptionsButton.click();

    const serviceToggle = page
      .getByRole("menuitemcheckbox", { name: "Edge Case Service" })
      .first();
    await expect(serviceToggle).toBeVisible();
    await expect(serviceToggle).toHaveAttribute("aria-checked", "false");
    await serviceToggle.click();
    await expect
      .poll(async () => {
        return page.evaluate((label) => {
          const raw = localStorage.getItem("SESSIONS");
          if (!raw) return false;

          const session = JSON.parse(raw);
          const toolsEnabled = session?.options?.openai?.toolsEnabled;
          return (
            toolsEnabled?.dataType === "Set" &&
            toolsEnabled.value.includes(label as string)
          );
        }, "Edge Case Service");
      })
      .toBe(true);
  });

  test("should handle errors when fetching MCP server public key", async ({
    page,
  }) => {
    let alertMessage = "";
    page.on("dialog", async (dialog) => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
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
    await waitForDiscoveredScopes(page);
    await getUserDataConsentLabel(page).click();
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(getLabelInput(page)).toBeVisible();
    await expect
      .poll(() => alertMessage)
      .toMatch(/fehlgeschlagen|Encryption failed/i);
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
    await waitForDiscoveredScopes(page);
    await getUserDataConsentLabel(page).click();
    await page.getByTestId("mcp-add-service-btn").click();

    await expect(
      page.getByTestId("mcp-edit-Preserved Auth Service")
    ).toBeVisible();
    await page.getByTestId("mcp-edit-Preserved Auth Service").click();
    await expect(getLabelInput(page)).toHaveValue("Preserved Auth Service");
    await expect(getServerUrlInput(page)).toHaveValue(
      "https://preserved.example.com"
    );
  });
});
