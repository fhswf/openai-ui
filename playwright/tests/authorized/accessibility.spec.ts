import axe from "axe-core";
import type { Page } from "@playwright/test";
import { test, expect } from "../baseFixtures";
import {
  acceptTermsIfVisible,
  mockResponsesEndpoint,
  mockUserEndpoint,
} from "../testHelpers";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoWcagViolations(page: Page) {
  await page.addScriptTag({ content: axe.source });

  const violations = await page.evaluate(async (tags) => {
    const results = await (window as any).axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });

    return results.violations.map((violation: any) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node: any) => ({
        target: node.target,
        failureSummary: node.failureSummary,
      })),
    }));
  }, wcagTags);

  expect(violations).toEqual([]);
}

async function setTheme(page: Page, theme: "light" | "dark") {
  const html = page.locator("html");
  if ((await html.getAttribute("data-theme")) !== theme) {
    await page.getByTestId("OptionDarkModeSelect").click();
  }
  await expect(html).toHaveAttribute("data-theme", theme);
}

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await mockUserEndpoint(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptTermsIfVisible(page);
  });

  test("chat view has no WCAG 2.1 A/AA violations", async ({ page }) => {
    await setTheme(page, "light");
    const chatInput = page.getByRole("textbox", {
      name: /Enter something|Gib Deine Frage ein/i,
    });

    await expect(page.getByRole("main")).toBeVisible();
    await expect(chatInput).toBeVisible();
    await expect(page.getByRole("button", { name: /Senden|Send/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Nachricht entfernen|Remove Message/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Kopieren|copy/i })).toBeVisible();
    await expect(page.getByTestId("file-input")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    await expect(page.getByTestId("file-input")).toHaveAttribute("tabindex", "-1");
    await expect(page.getByTestId("UploadFileBtn")).toHaveAccessibleName(
      /Datei hochladen|Upload file/i
    );
    await expectNoWcagViolations(page);
  });

  test("user message edit control has an accessible name", async ({ page }) => {
    await mockResponsesEndpoint(page);
    const chatInput = page.getByRole("textbox", {
      name: /Enter something|Gib Deine Frage ein/i,
    });

    await chatInput.fill("Accessibility check");
    await page.getByRole("button", { name: /Senden|Send/i }).click();

    await expect(page.getByTestId("EditMessageBtn")).toHaveAccessibleName(
      /Nachricht bearbeiten|Edit Message/i
    );
  });

  test("about dialog is named and keyboard dismissible", async ({ page }) => {
    await setTheme(page, "light");
    await page.getByTestId("aboutBtn").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/About|Über/i);
    await expectNoWcagViolations(page);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("chat view and about dialog have no WCAG 2.1 A/AA violations in dark theme", async ({
    page,
  }) => {
    await setTheme(page, "dark");
    await expectNoWcagViolations(page);

    await page.getByTestId("aboutBtn").click();
    await expect(page.getByRole("dialog")).toHaveAccessibleName(/About|Über/i);
    await expectNoWcagViolations(page);
  });
});
