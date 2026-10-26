import { test, expect } from "../baseFixtures";
import type { Page, Route } from "@playwright/test";
import { EXCERPT, MockVectorStoreService } from "./vectorStoresMock";
import {
  APP_READY_TIMEOUT,
  acceptTermsIfVisible,
  mockUserEndpoint,
} from "../testHelpers";

test.skip(
  ({ isMobile }) => isMobile,
  "Tests depend on the desktop toolbar layout"
);

async function openDocumentsMenu(page: Page) {
  await page.getByTestId("chat-options-btn").click();
  await page.getByTestId("documents-menu-trigger").hover();
  await expect(page.getByTestId("vector-stores-manage")).toBeVisible();
}

async function openVectorStoresDialog(page: Page) {
  await openDocumentsMenu(page);
  await page.getByTestId("vector-stores-manage").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function createStore(
  page: Page,
  service: MockVectorStoreService,
  name: string
) {
  await page.getByTestId("vector-store-name-input").fill(name);
  await page.getByTestId("vector-store-create-btn").click();
  await expect
    .poll(() => service.stores.find((s) => s.name === name))
    .toBeDefined();
  const store = service.stores.find((s) => s.name === name);
  expect(store).toBeDefined();
  const row = page.getByTestId(`vector-store-${store!.id}`);
  await expect(row).toBeVisible();
  return { row, id: store!.id };
}

async function expandStore(page: Page, id: string) {
  await page
    .getByTestId(`vector-store-${id}`)
    .getByRole("button", { name: /Dateien anzeigen|Show files/ })
    .click();
  await expect(page.getByTestId(`vector-store-dropzone-${id}`)).toBeVisible();
}

async function uploadMarkdown(page: Page, id: string, name: string) {
  await page.getByTestId(`vector-store-upload-${id}`).setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from("# Notes"),
  });
}

test.describe("Document collections (vector stores)", () => {
  let service: MockVectorStoreService;

  test.beforeEach(async ({ page }) => {
    service = new MockVectorStoreService();
    await mockUserEndpoint(page);
    await page.route(/pgvector\.fh-swf\.cloud/, (route) =>
      service.handle(route)
    );

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await acceptTermsIfVisible(page);
    await expect(page.getByTestId("chat-options-btn")).toBeVisible({
      timeout: APP_READY_TIMEOUT,
    });
  });

  test("documents submenu toggles several collections and opens the dialog", async ({
    page,
  }) => {
    const skript = service.addStore("Skript");
    const folien = service.addStore("Folien");

    await openDocumentsMenu(page);
    const skriptItem = page.getByTestId(`documents-menu-store-${skript.id}`);
    const folienItem = page.getByTestId(`documents-menu-store-${folien.id}`);
    await expect(skriptItem).toHaveAttribute("aria-checked", "false");

    // The menu stays open, so several collections can be toggled in a row.
    await skriptItem.click();
    await expect(skriptItem).toHaveAttribute("aria-checked", "true");
    await folienItem.click();
    await expect(folienItem).toHaveAttribute("aria-checked", "true");
    await folienItem.click();
    await expect(folienItem).toHaveAttribute("aria-checked", "false");

    // Collections are not listed individually among the tool options.
    await expect(
      page.getByRole("menuitemcheckbox", { name: /File Search/ })
    ).toHaveCount(0);

    await page.getByTestId("vector-stores-manage").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByTestId(`vector-store-in-chat-${skript.id}`)
    ).toHaveAttribute("data-state", "checked");
    await expect(
      page.getByTestId(`vector-store-in-chat-${folien.id}`)
    ).toHaveAttribute("data-state", "unchecked");
  });

  test("manages collections and their files in the dialog", async ({
    page,
  }) => {
    await openVectorStoresDialog(page);
    const { row, id } = await createStore(page, service, "Skript");

    // Rename via the pgvector path without /v1.
    await page.getByTestId(`vector-store-rename-${id}`).click();
    const nameInput = row.getByRole("textbox");
    await nameInput.fill("Skript 2");
    await nameInput.press("Enter");
    await expect(row).toContainText("Skript 2");
    expect(service.requests).toContain(`POST /vector_stores/${id}/`);

    // Upload via the button.
    await expandStore(page, id);
    await page.getByTestId(`vector-store-upload-${id}`).setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes"),
    });
    // The name shows up as "processing" first; wait until the upload is done.
    await expect
      .poll(() => service.stores[0].files.map((f) => f.filename))
      .toEqual(["notes.md"]);
    await expect(row).toContainText("notes.md");

    // Upload via drag and drop; the drop zone turns blue while dragging.
    const dropzone = page.getByTestId(`vector-store-dropzone-${id}`);
    const dataTransfer = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File(["%PDF-1.4"], "skript.pdf", { type: "application/pdf" })
      );
      return transfer;
    });
    await dropzone.dispatchEvent("dragenter", { dataTransfer });
    await expect(dropzone).not.toHaveCSS(
      "border-top-color",
      "rgba(0, 0, 0, 0)"
    );
    await dropzone.dispatchEvent("drop", { dataTransfer });
    await expect(dropzone).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect
      .poll(() => service.stores[0].files.map((f) => f.filename))
      .toEqual(["notes.md", "skript.pdf"]);
    await expect(row).toContainText("skript.pdf");

    // Deleting a file asks for confirmation first.
    const notes = service.stores[0].files[0];
    await page.getByTestId(`vector-store-file-delete-${notes.id}`).click();
    expect(service.files.has(notes.id)).toBe(true);
    await page
      .getByTestId(`vector-store-file-confirm-delete-${notes.id}`)
      .click();
    await expect(row).not.toContainText("notes.md");
    expect(service.files.has(notes.id)).toBe(false);

    // Deleting the collection asks for confirmation as well.
    await page.getByTestId(`vector-store-delete-${id}`).click();
    await page.getByTestId(`vector-store-confirm-delete-${id}`).click();
    await expect(row).toBeHidden();
    expect(service.requests).toContain(`DELETE /vector_stores/${id}/`);
  });

  test("rejects unsupported file types", async ({ page }) => {
    await openVectorStoresDialog(page);
    const { id } = await createStore(page, service, "Bilder");
    await expandStore(page, id);

    await page.getByTestId(`vector-store-upload-${id}`).setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from("png"),
    });

    await expect(
      page.getByText("Dateityp wird nicht unterstützt")
    ).toBeVisible();
    expect(service.files.size).toBe(0);
  });

  test("uploads new files with the collection's splitting setting", async ({
    page,
  }) => {
    const store = service.addStore("Skript");
    await openVectorStoresDialog(page);
    await expandStore(page, store.id);
    const setting = page.getByTestId(`vector-store-chunking-${store.id}`);
    await expect(setting).toContainText(/Ausgewogen|Balanced/);

    // Without a choice, the attach request stays as before.
    await uploadMarkdown(page, store.id, "notes.md");
    await expect.poll(() => service.attachRequests.length).toBe(1);
    expect(service.attachRequests[0]).not.toHaveProperty("chunking_strategy");

    await page.getByTestId(`vector-store-chunking-toggle-${store.id}`).click();
    await page.getByTestId("chunking-preset-precise").click();
    await expect.poll(() => store.metadata.chunking).toBe("precise");
    expect(service.requests).toContain(`POST /vector_stores/${store.id}/`);
    await expect(setting).toContainText(/Präzise|Precise/);

    await uploadMarkdown(page, store.id, "glossar.md");
    await expect.poll(() => service.attachRequests.length).toBe(2);
    expect(service.attachRequests[1].chunking_strategy).toEqual({
      type: "semantic",
      semantic: { max_chunk_size_tokens: 400 },
    });

    // The file list shows how each file was split.
    const [notes, glossar] = store.files;
    await expect(
      page.getByTestId(`vector-store-file-${notes.id}`)
    ).toContainText(/Aufteilung: Ausgewogen|Split: Balanced/);
    await expect(
      page.getByTestId(`vector-store-file-${glossar.id}`)
    ).toContainText(/Aufteilung: Präzise|Split: Precise/);
  });

  test("shows no splitting for files processed before it was stored", async ({
    page,
  }) => {
    const store = service.addStore("Skript", ["alt.pdf", "neu.pdf"]);
    const [old, current] = store.files;
    // The service reports { type: "other" } for such files.
    delete old.chunkingStrategy;
    await openVectorStoresDialog(page);
    await expandStore(page, store.id);

    await expect(
      page.getByTestId(`vector-store-file-${current.id}`)
    ).toContainText(/Aufteilung: Ausgewogen|Split: Balanced/);
    const oldRow = page.getByTestId(`vector-store-file-${old.id}`);
    await expect(oldRow).toContainText("alt.pdf");
    await expect(oldRow).not.toContainText(/Aufteilung|Split/);
  });

  test("validates and stores a custom section size", async ({ page }) => {
    const store = service.addStore("Skript", [], { chunking: "context" });
    await openVectorStoresDialog(page);
    await expandStore(page, store.id);
    const setting = page.getByTestId(`vector-store-chunking-${store.id}`);
    await expect(setting).toContainText(/Viel Zusammenhang|More context/);

    await page.getByTestId(`vector-store-chunking-toggle-${store.id}`).click();
    await page.getByTestId("chunking-advanced-toggle").click();
    const input = page.getByTestId("chunking-custom-input");

    // An invalid size shows an error and is not stored.
    await input.fill("99");
    await page.getByTestId("chunking-custom-apply").click();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByText(/Bitte geben Sie eine Zahl|Please enter a number/)
    ).toBeVisible();
    expect(store.metadata).toEqual({ chunking: "context" });

    await input.fill("1234");
    await input.press("Enter");
    await expect.poll(() => store.metadata.chunking).toBe("1234");
    await expect(setting).toContainText("1234");
    await expect(input).not.toHaveAttribute("aria-invalid", "true");
    // No preset is selected while a custom size is active.
    await expect(page.getByTestId("chunking-preset-context")).toHaveAttribute(
      "data-state",
      "unchecked"
    );

    await uploadMarkdown(page, store.id, "skript.md");
    await expect.poll(() => service.attachRequests.length).toBe(1);
    expect(service.attachRequests[0].chunking_strategy).toEqual({
      type: "semantic",
      semantic: { max_chunk_size_tokens: 1234 },
    });
    await expect(
      page.getByTestId(`vector-store-file-${store.files[0].id}`)
    ).toContainText(/Eigene Größe \(1234\)|Custom size \(1234\)/);
  });

  test("searches active collections through a client-side function tool", async ({
    page,
  }) => {
    const store = service.addStore("Skript", ["skript.pdf"]);
    const responseBodies: any[] = [];

    await page.route("**/v1/responses", async (route) => {
      const requestBody = route.request().postDataJSON();
      responseBodies.push(requestBody);
      const events = requestBody.previous_response_id
        ? [
            {
              type: "response.created",
              response: { id: "resp_mock_answer" },
            },
            { type: "response.output_text.delta", delta: "Am 12. Februar." },
            {
              type: "response.completed",
              response: {
                id: "resp_mock_answer",
                usage: { total_tokens: 2, input_tokens: 1, output_tokens: 1 },
              },
            },
          ]
        : [
            { type: "response.created", response: { id: "resp_mock_fs" } },
            {
              type: "response.output_item.added",
              output_index: 0,
              item: {
                id: "fc_item_fs",
                type: "function_call",
                call_id: "call_fs",
                name: "search_documents",
                arguments: '{"query":"Klausur Termine"}',
              },
            },
            {
              type: "response.output_item.done",
              output_index: 0,
              item: {
                id: "fc_item_fs",
                type: "function_call",
                call_id: "call_fs",
                name: "search_documents",
                arguments: '{"query":"Klausur Termine"}',
                status: "completed",
              },
            },
            {
              type: "response.completed",
              response: {
                id: "resp_mock_fs",
                usage: { total_tokens: 2, input_tokens: 1, output_tokens: 1 },
              },
            },
          ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events
          .map((event) => `data: ${JSON.stringify(event)}\n\n`)
          .join(""),
      });
    });

    await openDocumentsMenu(page);
    await page.getByTestId(`documents-menu-store-${store.id}`).click();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.getByTestId("ChatTextArea").fill("Wann ist die Klausur?");
    await page.getByTestId("SendMessageBtn").click();

    await expect(page.getByText("Am 12. Februar.")).toBeVisible();
    expect(service.requests).toContain(
      `POST /v1/vector_stores/${store.id}/search`
    );

    const initialRequest = responseBodies[0];
    const functionTool = initialRequest.tools.find(
      (tool: { type: string; name?: string }) =>
        tool.type === "function" && tool.name === "search_documents"
    );
    expect(functionTool).toBeDefined();
    expect(initialRequest.tool_choice).toBe("auto");
    expect(initialRequest.tools.map((tool: { type: string }) => tool.type)).not.toContain(
      "file_search"
    );
    expect(
      JSON.stringify(initialRequest.input)
    ).not.toContain("<documents>");

    const continuationRequest = responseBodies[1];
    expect(continuationRequest.previous_response_id).toBe("resp_mock_fs");
    expect(continuationRequest.input[0]).toMatchObject({
      type: "function_call_output",
      call_id: "call_fs",
    });
    expect(continuationRequest.input[0].output).toContain("skript.pdf");
    expect(continuationRequest.input[0].output).toContain(EXCERPT);

    // The search shows up as tool usage below the answer.
    const badge = page.getByTestId("tool-usage-badge-file_search_call");
    await expect(badge).toContainText("Dokumente");
    await badge.click();
    const popup = page.getByTestId("tool-usage-popup-content");
    await expect(popup).toContainText("Klausur Termine");
    await expect(popup).toContainText("skript.pdf");
    await expect(popup).toContainText(EXCERPT);
  });
});
