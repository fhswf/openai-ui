import { expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";

export const APP_READY_TIMEOUT = 15000;

export async function waitForDialogLayerToClear(page: Page) {
  await expect(
    page.locator('[data-scope="dialog"][data-part="positioner"]')
  ).toBeHidden({ timeout: APP_READY_TIMEOUT });
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

  await expect(termsBtn.or(chatTextArea).or(userInformationBtn).first()).toBeVisible({ timeout: APP_READY_TIMEOUT });

  if (await termsBtn.isVisible()) {
    await expect(async () => {
      await termsBtn.scrollIntoViewIfNeeded();
      await clickWithBackdropRetry(page, termsBtn);
      await expect(informationWindow).toHaveAttribute("data-state", "closed", { timeout: 1000 });
    }).toPass({ timeout: 15000, intervals: [500, 1000] });
    
    await expect(informationWindow).toBeHidden({ timeout: 10000 });
    await closeInformationWindowIfVisible(page);
  }
}
