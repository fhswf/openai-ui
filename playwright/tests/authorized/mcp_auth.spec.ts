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

test.describe("MCP Auth", () => {
  test.describe.configure({timeout: 120000});

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

  const discoveredScopes = {
    scopes_supported: [
      {scope: "email", description: "Email address"},
      {scope: "name", description: "Display name"},
    ],
  };
  const openIdConfiguration = {
    issuer: "https://userdata.example.com",
    jwks_uri: "https://userdata.example.com/.well-known/jwks.json",
    scopes_supported: discoveredScopes.scopes_supported,
  };
  const reversedDiscoveredScopes = {
    scopes_supported: [...discoveredScopes.scopes_supported].reverse(),
  };
  const baseAccountOptions = {name: "Anonymus", avatar: "", terms: true};
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

  let jwksRequestCount = 0;
  let scopeDiscoveryStatus = 200;
  let scopeDiscoveryBody = JSON.stringify(openIdConfiguration);
  let scopeDiscoveryDelayMs = 0;
  const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;

  async function disableAnimations(page: Page) {
    // Neutralize animations for cross-browser timing consistency
    await page.addStyleTag({content: DISABLE_ANIMATIONS_STYLE});
  }

  async function waitForAuthorizedShell(page: Page) {
    await disableAnimations(page);
    await expect(page.getByTestId("chat-options-btn")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
  }

  async function loadAuthorizedPage(page: Page) {
    await page.goto("/", {waitUntil: "domcontentloaded"});
    await waitForAuthorizedShell(page);
    await acceptTermsIfVisible(page);
  }

  async function reloadAuthorizedPage(page: Page) {
    await page.reload({waitUntil: "domcontentloaded"});
    await waitForAuthorizedShell(page);
    await acceptTermsIfVisible(page);
  }

  async function routeDiscoveryForServer(
      page: Page,
      serverUrl: string,
      args: { status: number; body: string; contentType?: string }
  ) {
    const discoveryUrl = new URL(
        "/.well-known/openid-configuration",
        serverUrl
    ).toString();

    await page.route(discoveryUrl, async (route) => {
      await route.fulfill({
        status: args.status,
        contentType: args.contentType ?? "application/json",
        body: args.body,
      });
    });
  }

  test.beforeEach(async ({page}) => {
    jwksRequestCount = 0;
    scopeDiscoveryStatus = 200;
    scopeDiscoveryBody = JSON.stringify(openIdConfiguration);
    scopeDiscoveryDelayMs = 0;
    await page.route(userEndpointPattern, async (route) => {
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
    await page.route("**/.well-known/openid-configuration", async (route) => {
      if (scopeDiscoveryDelayMs > 0) {
        await new Promise((resolve) =>
            setTimeout(resolve, scopeDiscoveryDelayMs)
        );
      }
      await route.fulfill({
        status: scopeDiscoveryStatus,
        contentType: "application/json",
        body: scopeDiscoveryBody,
      });
    });
    await loadAuthorizedPage(page);
  });

  const labelFieldPattern = /Label|Bezeichnung/i;
  const serverUrlFieldPattern = /Server URL|Server-URL/i;

  async function openMcpDialog(page: Page) {
    const chatOptionsButton = page.getByTestId("chat-options-btn");
    await expect(chatOptionsButton).toBeVisible({timeout: APP_READY_TIMEOUT});
    await chatOptionsButton.click();

    const servicesMenuTrigger = page.getByTestId("mcp-services-menu-trigger");
    await expect(servicesMenuTrigger).toBeVisible();
    await servicesMenuTrigger.click();

    const addRemoveServicesButton = page.getByTestId("mcp-add-remove-services");
    await expect(addRemoveServicesButton).toBeVisible();
    await addRemoveServicesButton.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  function buildSeedSession(args: {
    label: string;
    consentGranted: boolean;
    enabled: boolean;
  }) {
    return {
      options: {
        account: baseAccountOptions,
        general: baseGeneralOptions,
        openai: {
          ...baseOpenAiOptions,
          tools: {
            dataType: "Map",
            value: [
              [
                args.label,
                {
                  type: "mcp",
                  server_label: args.label,
                  server_url: "https://consent-race.example.com",
                  require_approval: "never",
                  authorization: args.consentGranted
                      ? "existing-authorization"
                      : undefined,
                },
              ],
            ],
          },
          toolsEnabled: {
            dataType: "Set",
            value: args.enabled ? [args.label] : [],
          },
          mcpAuthConfigs: {
            dataType: "Map",
            value: [
              [
                args.label,
                {
                  mode: "user-data",
                  userData: {
                    scopes: [...discoveredScopes.scopes_supported],
                    consentGranted: args.consentGranted,
                  },
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

  function getLabelInput(page: Page) {
    return page.getByLabel(labelFieldPattern);
  }

  function getServerUrlInput(page: Page) {
    return page.getByLabel(serverUrlFieldPattern);
  }

  async function focusAndFill(locator: Locator, value: string) {
    await expect(locator).toBeVisible();
    await expect(locator).toBeEditable();
    await locator.click();
    await locator.fill(value);
  }

  async function acceptTermsIfVisible(page: Page) {
    const termsBtn = page.getByTestId("accept-terms-btn");
    if ((await termsBtn.count()) === 0) return;

    await expect(termsBtn).toBeVisible({timeout: APP_READY_TIMEOUT});
    await termsBtn.scrollIntoViewIfNeeded();
    await termsBtn.click();
  }

  async function fillServiceBase(page: Page, label: string, url: string) {
    await focusAndFill(getLabelInput(page), label);
    await focusAndFill(getServerUrlInput(page), url);
  }

  type AuthMode = "none" | "static" | "user-data";

  async function setAuthMode(page: Page, mode: AuthMode) {
    const modeOption = page.getByTestId(`mcp-auth-mode-${mode}`);
    await expect(modeOption).toBeVisible();
    await modeOption.click();
    await expectModeChecked(page, mode);
  }

  async function waitForDiscoveredScopes(page: Page) {
    await expect(page.getByTestId("mcp-auth-scope-email")).toBeVisible();
    await expect(page.getByTestId("mcp-auth-scope-name")).toBeVisible();
  }

  function getUserDataConsentCheckbox(page: Page) {
    return page.getByRole("checkbox", {name: /I agree|Ich stimme/i});
  }

  function getUserDataConsentLabel(page: Page) {
    return page.getByTestId("mcp-auth-consent");
  }

  function getModeInput(page: Page, mode: AuthMode) {
    return page
        .getByTestId(`mcp-auth-mode-${mode}`)
        .getByRole("radio", {includeHidden: true});
  }

  async function expectModeChecked(page: Page, mode: AuthMode) {
    await expect(getModeInput(page, mode)).toBeChecked();
  }

  async function grantUserDataConsent(page: Page) {
    const consentControl = getUserDataConsentCheckbox(page);
    const consentLabel = getUserDataConsentLabel(page);
    await expect(consentLabel).toBeVisible();
    await consentLabel.click();
    await expect(consentControl).toBeChecked();
  }

  async function createService(
      page: Page,
      args: {
        label: string;
        url: string;
        mode: AuthMode;
        staticToken?: string;
        consentToUserData?: boolean;
      }
  ) {
    await fillServiceBase(page, args.label, args.url);
    await setAuthMode(page, args.mode);
    if (args.mode === "static" && args.staticToken) {
      await focusAndFill(
          page.getByTestId("mcp-auth-static-token-input"),
          args.staticToken
      );
    }
    if (args.mode === "user-data") {
      await waitForDiscoveredScopes(page);
      if (args.consentToUserData) {
        await grantUserDataConsent(page);
      }
    }
    await page.getByTestId("mcp-add-service-btn").click();
  }

  test.describe("JWKS fetching", () => {
    test("skips JWKS for static auth", async ({page}) => {
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

    test("requests JWKS for user-data auth", async ({page}) => {
      await openMcpDialog(page);
      const initialJwksRequestCount = jwksRequestCount;

      await createService(page, {
        label: "User Data Service",
        url: "https://userdata.example.com",
        mode: "user-data",
        consentToUserData: true,
      });

      await expect(page.getByText("User Data Service")).toBeVisible();
      await expect
          .poll(() => jwksRequestCount)
          .toBeGreaterThan(initialJwksRequestCount);
    });

    test("keeps none/static available when discovery does not provide user-data auth", async ({
                                                                                                          page,
                                                                                                        }) => {
      await routeDiscoveryForServer(page, "https://partial.example.com", {
        status: 404,
        contentType: "text/plain",
        body: "missing",
      });

      await seedSession(page, {
        options: {
          account: baseAccountOptions,
          general: baseGeneralOptions,
          openai: {
            ...baseOpenAiOptions,
            tools: {
              dataType: "Map",
              value: [
                [
                  "Partial Discovery",
                  {
                    type: "mcp",
                    server_label: "Partial Discovery",
                    server_url: "https://partial.example.com",
                    require_approval: "never",
                  },
                ],
              ],
            },
            toolsEnabled: {
              dataType: "Set",
              value: [],
            },
            mcpAuthConfigs: {
              dataType: "Map",
              value: [["Partial Discovery", {mode: "none"}]],
            },
          },
        },
      });

      await reloadAuthorizedPage(page);

      await openMcpDialog(page);
      await page.getByTestId("mcp-edit-Partial Discovery").click();
      // toPass handles eventual consistency without hardcoded waits
      await expect(async () => {
        await expectModeChecked(page, "none");
        await expect(getModeInput(page, "none")).toBeEnabled();
        await expect(getModeInput(page, "static")).toBeEnabled();
      }).toPass({timeout: APP_READY_TIMEOUT});
    });

    test("grays out none and static for discovered user-data services", async ({
                                                                                 page,
                                                                               }) => {
      await seedSession(
          page,
          buildSeedSession({
            label: "User Data Only",
            consentGranted: true,
            enabled: false,
          })
      );

      await reloadAuthorizedPage(page);

      await openMcpDialog(page);
      await page.getByTestId("mcp-edit-User Data Only").click();
      await waitForDiscoveredScopes(page);
      await expect(getModeInput(page, "user-data")).toBeEnabled();
      await expect(getModeInput(page, "none")).toBeDisabled();
      await expect(getModeInput(page, "static")).toBeDisabled();
    });
  });

  test.describe("Mode transitions", () => {
    test("clears static token when switching away", async ({page}) => {
      await openMcpDialog(page);

      await setAuthMode(page, "static");
      await focusAndFill(page.getByTestId("mcp-auth-static-token-input"), "secret");
      await setAuthMode(page, "none");
      await setAuthMode(page, "static");

      await expect(page.getByTestId("mcp-auth-static-token-input")).toHaveValue(
          ""
      );
    });
  });

  test.describe("Editing and persistence", () => {
    test("preserves discovered scopes and consent when editing user-data auth", async ({
                                                                                         page,
                                                                                       }) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "Preserve Fields",
        url: "https://preserve.example.com",
        mode: "user-data",
        consentToUserData: true,
      });

      await page.getByTestId("mcp-edit-Preserve Fields").click();
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await waitForDiscoveredScopes(page);
      await expect(getUserDataConsentCheckbox(page)).toBeChecked();
    });

    test("preserves explicit none when discovery becomes available later", async ({
                                                                                    page,
                                                                                  }) => {
      scopeDiscoveryStatus = 404;
      scopeDiscoveryBody = "missing";

      await openMcpDialog(page);
      await createService(page, {
        label: "No Auth Service",
        url: "https://no-auth.example.com",
        mode: "none",
      });

      scopeDiscoveryStatus = 200;
      scopeDiscoveryBody = JSON.stringify(openIdConfiguration);

      await page.getByTestId("mcp-edit-No Auth Service").click();
      await expect(page.getByTestId("mcp-auth-fields-container")).toHaveCount(
          0
      );
      await expect(page.getByTestId("mcp-auth-static-token-input")).toHaveCount(
          0
      );
      await expectModeChecked(page, "none");
      await expect(getModeInput(page, "none")).toBeEnabled();
      await expect(getModeInput(page, "static")).toBeEnabled();
      await expect(getModeInput(page, "user-data")).toBeEnabled();
    });

    test("renaming service preserves auth config", async ({page}) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "Rename Me",
        url: "https://rename.example.com",
        mode: "user-data",
        consentToUserData: true,
      });

      await page.getByTestId("mcp-edit-Rename Me").click();
      await focusAndFill(getLabelInput(page), "Renamed Service");
      await page.getByTestId("mcp-add-service-btn").click();

      await expect(page.getByText("Renamed Service")).toBeVisible();
      await page.getByTestId("mcp-edit-Renamed Service").click();
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await waitForDiscoveredScopes(page);
      await expect(getUserDataConsentCheckbox(page)).toBeChecked();
    });

    test("preserves consent when discovered scopes arrive in a different order", async ({
                                                                                          page,
                                                                                        }) => {
      await openMcpDialog(page);

      await createService(page, {
        label: "Scope Order",
        url: "https://scope-order.example.com",
        mode: "user-data",
        consentToUserData: true,
      });

      scopeDiscoveryBody = JSON.stringify({
        ...openIdConfiguration,
        scopes_supported: reversedDiscoveredScopes.scopes_supported,
      });

      await page.getByTestId("mcp-edit-Scope Order").click();
      await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
      await waitForDiscoveredScopes(page);
      await expect(getUserDataConsentCheckbox(page)).toBeChecked();
    });

    test.describe("Legacy sessions", () => {
      test("legacy config with selectedFields is rediscovered like a new server", async ({
                                                                                           page,
                                                                                         }) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem("SESSIONS");
          const session = raw ? JSON.parse(raw) : {};
          if (!session.options) session.options = {};
          if (!session.options.openai) session.options.openai = {};

          session.options.openai.mcpAuthConfigs = {
            dataType: "Map",
            value: [
              [
                "FH SWF (beta)",
                {
                  mode: "user-data",
                  selectedFields: ["email", "name"],
                },
              ],
            ],
          };

          localStorage.setItem("SESSIONS", JSON.stringify(session));
        });

        await reloadAuthorizedPage(page);

        await openMcpDialog(page);
        await page.getByTestId("mcp-edit-FH SWF (beta)").click();

        await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
        await waitForDiscoveredScopes(page);
        await expect(getUserDataConsentCheckbox(page)).toBeChecked();
      });

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
            value: [["FH SWF (beta)", {mode: "user-data"}]],
          };

          localStorage.setItem("SESSIONS", JSON.stringify(session));
        });

        await reloadAuthorizedPage(page);

        await openMcpDialog(page);
        await page.getByTestId("mcp-edit-FH SWF (beta)").click();

        await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
        await waitForDiscoveredScopes(page);
        await expect(getUserDataConsentCheckbox(page)).not.toBeChecked();
      });

      test("missing mcpAuthConfigs does not crash", async ({page}) => {
        await page.addInitScript(() => {
          const raw = localStorage.getItem("SESSIONS");
          const session = raw ? JSON.parse(raw) : {};
          if (!session.options) session.options = {};
          if (!session.options.openai) session.options.openai = {};

          delete session.options.openai.mcpAuthConfigs;
          localStorage.setItem("SESSIONS", JSON.stringify(session));
        });

        await reloadAuthorizedPage(page);

        await openMcpDialog(page);
        await expect(page.getByTestId("mcp-edit-FH SWF (beta)")).toBeVisible();
        await page.getByTestId("mcp-edit-FH SWF (beta)").click();

        await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
        await waitForDiscoveredScopes(page);
        await expect(getUserDataConsentCheckbox(page)).not.toBeChecked();
      });

      test("missing mcpAuthConfigs on fresh login does not crash", async ({
                                                                            browser,
                                                                          }) => {
        const context = await browser.newContext({
          storageState: "playwright/.auth/user.json",
        });
        const page = await context.newPage();

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

        await page.addInitScript(() => {
          const raw = localStorage.getItem("SESSIONS");
          const session = raw ? JSON.parse(raw) : {};
          if (!session.options) session.options = {};
          if (!session.options.openai) session.options.openai = {};

          delete session.options.openai.mcpAuthConfigs;
          localStorage.setItem("SESSIONS", JSON.stringify(session));
        });

        await page.goto("/", {waitUntil: "domcontentloaded"});
        await waitForAuthorizedShell(page);
        await acceptTermsIfVisible(page);

        await openMcpDialog(page);
        await page.getByTestId("mcp-edit-FH SWF (beta)").click();

        await expect(page.getByTestId("mcp-auth-fields-container")).toBeVisible();
        await waitForDiscoveredScopes(page);
        await expect(getUserDataConsentCheckbox(page)).not.toBeChecked();

        await context.close();
      });
    });
  });
});
