import { expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";

export const APP_READY_TIMEOUT = 15000;

export const DEFAULT_MOCK_USER = {
  name: "Playwright User",
  email: "playwright@fh-swf.de",
  sub: "playwright",
  preferred_username: "playwright",
  affiliations: {
    "fh-swf.de": ["member"],
  },
};

/**
 * Serve `/api/user` from a local mock so a spec exercises the locally built
 * bundle. On CI the auth cookie is scoped to the deployed host, so the proxied
 * `/api/user` returns 401 on localhost and the app redirects to the login page,
 * where none of the chat controls render.
 */
export async function mockUserEndpoint(
  page: Page,
  user: typeof DEFAULT_MOCK_USER = DEFAULT_MOCK_USER
) {
  await page.route(/\/(?:api\/)?user\/?(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(user),
    });
  });
}

/**
 * Keep the send flow hermetic by answering the streaming request locally
 * instead of hitting the deployed backend. Returns a created/completed pair,
 * which is enough for specs that only assert on the user's own message.
 */
export async function mockResponsesEndpoint(page: Page) {
  const events = [
    { type: "response.created", response: { id: "resp_mock_1" } },
    {
      type: "response.completed",
      response: {
        usage: { total_tokens: 2, input_tokens: 1, output_tokens: 1 },
      },
    },
  ];

  await page.route("**/v1/responses", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    });
  });
}

export async function waitForDialogLayerToClear(page: Page) {
  const positioners = page.locator('[data-scope="dialog"][data-part="positioner"]');
  await expect(async () => {
    const count = await positioners.count();
    for (let i = 0; i < count; i++) {
      const state = await positioners.nth(i).getAttribute("data-state");
      expect(state).not.toBe("open");
    }
  }).toPass({ timeout: APP_READY_TIMEOUT });
}

export async function clickWithBackdropRetry(page: Page, locator: Locator) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await locator.click({ timeout: 3000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`;
      const isBackdropInterception =
        message.includes("intercepts pointer events") &&
        (message.includes("dialog__backdrop") ||
          message.includes("dialog__positioner"));
      if (!isBackdropInterception) throw error;
      await page.waitForTimeout(500);
    }
  }

  await locator.click({ force: true });
}

export async function closeInformationWindowIfVisible(page: Page) {
  const informationWindow = page.getByTestId("InformationWindow");

  if (await informationWindow.isHidden({ timeout: APP_READY_TIMEOUT }).catch(() => false)) {
    await waitForDialogLayerToClear(page);
    return;
  }

  await page.keyboard.press("Escape");
  await expect(informationWindow).toBeHidden({ timeout: APP_READY_TIMEOUT });
  await waitForDialogLayerToClear(page);
}

export async function acceptTermsIfVisible(page: Page) {
  const termsBtn = page.getByTestId("accept-terms-btn");
  const informationWindow = page.getByTestId("InformationWindow");
  const userInformationBtn = page.getByTestId("UserInformationBtn");
  const chatTextArea = page.getByTestId("ChatTextArea");

  // 1. Wait for redirects and network requests to settle
  let url = page.url();
  if (url.includes('localhost')) {
    await page.waitForTimeout(2000);
    url = page.url();
  }

  if (!url.includes('localhost')) {
    await expect(page).toHaveURL(/https:\/\/openai\.ki\.fh-swf\.de\/?/, { timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  }

  // 2. Wait for the app to stabilize (either terms modal or authenticated elements are visible)
  await expect(termsBtn.or(chatTextArea).or(userInformationBtn).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

  // 2. Read up-to-date terms acceptance status from localStorage
  const termsAccepted = await page.evaluate(() => {
    const raw = localStorage.getItem("SESSIONS");
    if (!raw) return false;
    try {
      const session = JSON.parse(raw);
      return !!session?.options?.account?.terms;
    } catch {
      return false;
    }
  }).catch(() => false);

  if (termsAccepted) {
    return;
  }

  // 3. Terms are not accepted, wait for termsBtn to be fully visible and click it
  await expect(termsBtn).toBeVisible({ timeout: 30000 });

  await expect(async () => {
    await termsBtn.scrollIntoViewIfNeeded();
    await clickWithBackdropRetry(page, termsBtn);
    
    const count = await informationWindow.count();
    if (count === 0) {
      expect(true).toBe(true);
      return;
    }

    const state = await informationWindow.getAttribute("data-state");
    const isHidden = await informationWindow.isHidden();
    expect(isHidden || state === "closed").toBe(true);
  }).toPass({ timeout: 15000, intervals: [500, 1000] });
  
  await expect(informationWindow).toBeHidden({ timeout: 10000 });
  await closeInformationWindowIfVisible(page);
}
