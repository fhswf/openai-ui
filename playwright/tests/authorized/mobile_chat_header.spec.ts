import { test, expect } from "../baseFixtures";
import type { Page } from "@playwright/test";
import {
  APP_READY_TIMEOUT,
  acceptTermsIfVisible,
  mockUserEndpoint,
} from "../testHelpers";

// On phones the header collapses its actions into an overflow sheet. The sheet
// is hidden with `display: none` while closed, so anything that anchors to a
// trigger inside it must keep the sheet laid out, otherwise the popup opens
// with a zero-sized reference box and stays invisible.
// Touch + mobile metrics emulation is only supported by Chromium.
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Mobile metrics emulation requires Chromium"
);

test.use({
  viewport: { width: 393, height: 851 },
  isMobile: true,
  hasTouch: true,
});

test.describe("Mobile chat header", () => {
  test.beforeEach(async ({ page }) => {
    await mockUserEndpoint(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptTermsIfVisible(page);
  });

  const actionSheet = (page: Page) =>
    page.locator("#mobile-chat-header-actions");

  async function openActionSheet(page: Page) {
    const moreButton = page.getByRole("button", {
      name: /Mehr Aktionen|More Actions/i,
    });
    await expect(moreButton).toBeVisible({ timeout: APP_READY_TIMEOUT });
    await moreButton.click();
    await expect(actionSheet(page)).toHaveAttribute("data-open", "true");
  }

  test("chat options menu opens with a usable position", async ({ page }) => {
    await openActionSheet(page);
    await page.getByTestId("chat-options-btn").click();

    const menu = page
      .locator('[data-scope="menu"][data-part="content"]')
      .first();
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(/Werkzeug-Optionen|Tool Options/);
    await expect(menu).toContainText(/MCP-Dienste|MCP Services/);

    const box = await menu.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);

    // Opening a popup must not collapse the sheet it is anchored to.
    await expect(actionSheet(page)).toHaveAttribute("data-open", "true");
  });

  test("chat options toggles persist from the mobile sheet", async ({
    page,
  }) => {
    await openActionSheet(page);
    await page.getByTestId("chat-options-btn").click();

    const menu = page
      .locator('[data-scope="menu"][data-part="content"]')
      .first();
    const option = menu.getByRole("menuitemcheckbox", { name: "Web Search" });
    await expect(option).toBeVisible();
    await expect(option).toHaveAttribute("aria-checked", "false");
    await option.click();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = localStorage.getItem("SESSIONS");
          if (!raw) return false;
          const toolsEnabled = JSON.parse(raw)?.options?.openai?.toolsEnabled;
          return (
            toolsEnabled?.dataType === "Set" &&
            toolsEnabled.value.includes("Web Search")
          );
        })
      )
      .toBe(true);
  });

  test("download thread menu opens from the mobile sheet", async ({ page }) => {
    await openActionSheet(page);
    await page
      .locator("#mobile-chat-header-actions [data-header-action-label]")
      .filter({ hasText: /Unterhaltung herunterladen|Download Thread/i })
      .click();

    const menu = page
      .locator('[data-scope="menu"][data-part="content"]')
      .first();
    await expect(menu).toBeVisible();
    await expect(menu).toContainText(/JSON/);
    await expect(menu).toContainText(/Markdown/);

    const box = await menu.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
  });

  test("issue menu opens from the mobile sheet", async ({ page }) => {
    await openActionSheet(page);
    await page
      .getByRole("button", { name: /Verbesserungswunsch|Open Issue/i })
      .first()
      .click();

    const menu = page
      .locator('[data-scope="menu"][data-part="content"]')
      .first();
    await expect(menu).toBeVisible();

    const box = await menu.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
  });

  test("mcp services submenu stays open when clicked", async ({ page }) => {
    await openActionSheet(page);
    await page.getByTestId("chat-options-btn").click();

    await page.getByTestId("mcp-services-menu-trigger").click();

    // The submenu is portalled out of the sheet; interacting with it must not
    // dismiss the sheet or the submenu itself.
    const submenu = page
      .locator('[data-scope="menu"][data-part="content"]')
      .filter({ hasText: /Add\/Remove MCP Services|MCP-Dienste hinzufügen/i });
    await expect(submenu).toBeVisible();

    await page.getByTestId("mcp-add-remove-services").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(actionSheet(page)).toHaveAttribute("data-open", "true");
  });

  test("usage information dialog opens from the mobile sheet", async ({
    page,
  }) => {
    await openActionSheet(page);
    await page.getByTestId("UsageInformationBtn").click();

    const dialog = page.getByTestId("UsageInformation");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Nutzungsstatistik|Usage Information/);
  });
});
