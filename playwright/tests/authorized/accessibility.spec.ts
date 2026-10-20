import axe from "axe-core";
import type { Page } from "@playwright/test";
import { test, expect } from "../baseFixtures";
import { acceptTermsIfVisible, mockUserEndpoint } from "../testHelpers";

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

test.describe("Accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await mockUserEndpoint(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptTermsIfVisible(page);
  });

  test("chat view has no WCAG 2.1 A/AA violations", async ({ page }) => {
    const chatInput = page.getByRole("textbox", {
      name: /Enter something|Gib Deine Frage ein/i,
    });

    await expect(page.getByRole("main")).toBeVisible();
    await expect(chatInput).toBeVisible();
    await expect(page.getByRole("button", { name: /Senden|Send/i })).toBeVisible();
    await expectNoWcagViolations(page);
  });

  test("about dialog is named and keyboard dismissible", async ({ page }) => {
    await page.getByTestId("aboutBtn").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleName(/About|Über/i);
    await expectNoWcagViolations(page);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
