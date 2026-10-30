import { test, expect } from "../baseFixtures";
import type { Page, Route } from "@playwright/test";
import { HUB_KEY, MockAiHub } from "./aiHubMock";
import { MockVectorStoreService } from "./vectorStoresMock";
import {
  APP_READY_TIMEOUT,
  acceptTermsIfVisible,
  mockUserEndpoint,
} from "../testHelpers";

test.skip(
  ({ isMobile }) => isMobile,
  "Tests depend on the desktop toolbar layout"
);

/* Accepts the AI-Hub terms and returns the login popup that opens. */
async function acceptAiHubTerms(page: Page) {
  await expect(page.getByTestId("AiHubTermsDialog")).toBeVisible();
  await page.getByTestId("AiHubTermsCheckbox").click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByTestId("AiHubTermsAcceptBtn").click();
  return popupPromise;
}

/* Signs in to the mocked hub and waits until the app closes the popup. */
async function signInThroughPopup(page: Page, hub: MockAiHub) {
  const popup = await acceptAiHubTerms(page);
  await expect(popup).toHaveURL(/keycloak\.ki\.fh-swf\.de/);
  await expect(page.getByTestId("AiHubLoginWaitingHint")).toBeVisible();

  const popupClosed = popup.waitForEvent("close");
  hub.signIn();
  await popupClosed;
}

async function openVectorStoresDialog(page: Page) {
  await page.getByTestId("chat-options-btn").click();
  await page.getByTestId("documents-menu-trigger").hover();
  await page.getByTestId("vector-stores-manage").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test.describe("AI-Hub login", () => {
  let hub: MockAiHub;
  let vectorStores: MockVectorStoreService;

  test.beforeEach(async ({ page }) => {
    hub = new MockAiHub();
    vectorStores = new MockVectorStoreService();
    await mockUserEndpoint(page);
    await hub.install(page);
    // Like litellm-pgvector: only the AI-Hub key may use the service.
    await page.route(/pgvector\.fh-swf\.cloud/, async (route: Route) => {
      const auth = route.request().headers()["authorization"];
      if (auth === `Bearer ${HUB_KEY}`) return vectorStores.handle(route);
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid API key" }),
      });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptTermsIfVisible(page);
    await expect(page.getByTestId("chat-options-btn")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
  });

  test("popover finishes the activation after the popup login", async ({
    page,
  }) => {
    await page.getByTestId("UserInformationBtn").click();
    await page.getByTestId("UseAiHubBudgetBtn").click();

    await signInThroughPopup(page, hub);

    // Check the lasting state; the success toast disappears after 5 seconds.
    await expect(page.getByTestId("UseAiHubBudgetBtn")).toHaveText(
      /nicht mehr nutzen/
    );
    await expect(page.getByTestId("AiHubBudget")).toBeVisible();
    await expect(
      page.getByText("AI-Hub-Budget konnte nicht aktiviert werden")
    ).toHaveCount(0);
    await expect(page.getByTestId("AiHubTermsDialog")).toBeHidden();
    expect(hub.keysCreated).toBe(1);
  });

  test("document collections show the login card and load after the login", async ({
    page,
  }) => {
    const store = vectorStores.addStore("Skript");
    await openVectorStoresDialog(page);

    const card = page.getByTestId("vector-store-ai-hub-required");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("vector-store-name-input")).toBeDisabled();
    await expect(
      page.getByText("Dokumentensammlungen konnten nicht geladen werden")
    ).toHaveCount(0);

    await page.getByTestId("vector-store-ai-hub-login-btn").click();
    await signInThroughPopup(page, hub);

    await expect(page.getByTestId(`vector-store-${store.id}`)).toBeVisible();
    await expect(card).toBeHidden();
    await expect(page.getByTestId("vector-store-name-input")).toBeEnabled();
    expect(hub.keysCreated).toBe(1);
  });
});
