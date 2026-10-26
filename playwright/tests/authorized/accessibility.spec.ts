import axe from "axe-core";
import type { Page } from "@playwright/test";
import { test, expect } from "../baseFixtures";
import {
  acceptTermsIfVisible,
  mockResponsesEndpoint,
  mockUserEndpoint,
} from "../testHelpers";
import { MockVectorStoreService } from "./vectorStoresMock";

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

  for (const theme of ["light", "dark"] as const) {
    test(`document splitting settings have no WCAG 2.1 A/AA violations in ${theme} theme`, async ({
      page,
      isMobile,
    }) => {
      test.skip(isMobile, "Uses the desktop toolbar layout");
      const service = new MockVectorStoreService();
      const store = service.addStore("Skript");
      await page.route(/pgvector\.fh-swf\.cloud/, (route) =>
        service.handle(route)
      );
      await setTheme(page, theme);

      await page.getByTestId("chat-options-btn").click();
      await page.getByTestId("documents-menu-trigger").hover();
      await page.getByTestId("vector-stores-manage").click();
      await page
        .getByTestId(`vector-store-${store.id}`)
        .getByRole("button", { name: /Dateien anzeigen|Show files/ })
        .click();

      const toggle = page.getByTestId(
        `vector-store-chunking-toggle-${store.id}`
      );
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(
        page.getByRole("radiogroup", {
          name: /Aufteilung neuer Dateien|Splitting of new files/,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("radio", { name: /Präzise|Precise/ })
      ).toHaveCount(1);

      await page.getByTestId("chunking-advanced-toggle").click();
      const input = page.getByTestId("chunking-custom-input");
      await expect(input).toHaveAccessibleName(
        /Genaue Abschnittsgröße|Exact section size/
      );
      await input.fill("99");
      await page.getByTestId("chunking-custom-apply").click();
      await expect(input).toHaveAccessibleDescription(
        /Bitte geben Sie eine Zahl|Please enter a number/
      );

      await expectNoWcagViolations(page);
    });
  }

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
