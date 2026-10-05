import { test, expect } from "../baseFixtures";
import { acceptTermsIfVisible } from "../testHelpers";

test("Excel files can be dragged into the file attachment list", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName === "webkit",
    "Skipping WebKit due to issues with OPFS"
  );

  await page.route(/\/(?:api\/)?user\/?(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Playwright Excel",
        email: "playwright.excel@fh-swf.de",
        sub: "playwright-excel",
        preferred_username: "playwright.excel",
        affiliations: { "fh-swf.de": ["member"] },
      }),
    });
  });

  await page.goto("");
  await acceptTermsIfVisible(page);
  await expect(page.getByTestId("ChatTextArea")).toBeVisible();

  const dragResult = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="file-input"]'
    );
    if (!input) {
      throw new Error("File drop target is missing");
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File(["test workbook"], "workbook.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
    );

    // Simulate a drag source that exposes its filename only on drop.
    Object.defineProperty(dataTransfer.items[0], "getAsFile", {
      value: () => null,
    });

    const dragEnter = new DragEvent("dragenter", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    const dragOver = new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });
    const drop = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    });

    input.dispatchEvent(dragEnter);
    input.dispatchEvent(dragOver);
    input.dispatchEvent(drop);

    return {
      enterAccepted: dragEnter.defaultPrevented,
      overAccepted: dragOver.defaultPrevented,
    };
  });

  expect(dragResult).toEqual({ enterAccepted: true, overAccepted: true });
  await expect(page.getByTestId("file-preview-workbook.xlsx")).toBeVisible();
});
