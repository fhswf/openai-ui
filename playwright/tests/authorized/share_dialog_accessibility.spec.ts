import axe from "axe-core";
import { expect, test } from "../baseFixtures";

test("sharing dialog meets WCAG AA color contrast in light and dark themes", async ({ page }) => {
  for (const story of ["contrast-check", "contrast-check-dark"]) {
    await page.goto(
      `http://127.0.0.1:6006/iframe.html?id=chat-share-dialog--${story}&viewMode=story`
    );

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("option", { name: "Test" })).toHaveCount(1);
    await expect(
      dialog.getByRole("button", { name: /Share chat|Chat teilen/i })
    ).toHaveAttribute("data-disabled", "");
    await expect(
      dialog.getByRole("button", { name: /Save group|Gruppe speichern/i })
    ).toHaveAttribute("data-disabled", "");

    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      const dialogElement = document.querySelector('[role="dialog"]');
      if (!dialogElement) throw new Error("Sharing dialog was not rendered");

      const results = await (window as any).axe.run(dialogElement, {
        runOnly: { type: "rule", values: ["color-contrast"] },
      });
      return results.violations.map((violation: any) => ({
        id: violation.id,
        nodes: violation.nodes.map((node: any) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      }));
    });

    expect(violations, `${story} Storybook story`).toEqual([]);
  }
});
