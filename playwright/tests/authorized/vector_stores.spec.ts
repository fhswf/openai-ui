import { test, expect } from "../baseFixtures";
import type { Page, Request, Route } from "@playwright/test";
import {
  APP_READY_TIMEOUT,
  acceptTermsIfVisible,
  mockUserEndpoint,
} from "../testHelpers";

test.skip(
  ({ isMobile }) => isMobile,
  "Tests depend on the desktop toolbar layout"
);

interface MockFile {
  id: string;
  filename: string;
}

interface MockStore {
  id: string;
  name: string;
  files: MockFile[];
}

const EXCERPT = "Die Klausur findet am 12. Februar im Raum H 101 statt.";

/*
 * In-memory stand-in for the litellm-pgvector service, including its
 * non-standard update/delete paths without the /v1 prefix.
 */
class MockVectorStoreService {
  stores: MockStore[] = [];
  files = new Map<string, MockFile>();
  requests: string[] = [];
  private nextId = 1;

  private id(prefix: string) {
    return `${prefix}${this.nextId++}`;
  }

  addStore(name: string, filenames: string[] = []) {
    const store: MockStore = { id: this.id("vs"), name, files: [] };
    for (const filename of filenames) {
      const file = { id: this.id("file"), filename };
      this.files.set(file.id, file);
      store.files.push(file);
    }
    this.stores.push(store);
    return store;
  }

  private storeJson(store: MockStore) {
    return {
      id: store.id,
      object: "vector_store",
      created_at: 0,
      name: store.name,
      usage_bytes: 0,
      status: "completed",
      file_counts: {
        total: store.files.length,
        completed: store.files.length,
        failed: 0,
        cancelled: 0,
        in_progress: 0,
      },
      metadata: {},
    };
  }

  private attachmentJson(store: MockStore, file: MockFile) {
    return {
      id: file.id,
      object: "vector_store.file",
      created_at: 0,
      status: "completed",
      last_error: null,
      usage_bytes: 0,
      vector_store_id: store.id,
    };
  }

  private fileJson(file: MockFile) {
    return {
      ...file,
      object: "file",
      bytes: 1,
      created_at: 0,
      purpose: "assistants",
    };
  }

  async handle(route: Route) {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname;
    this.requests.push(`${method} ${path}`);

    if (await this.handleCollection(route, request, method, path)) return;
    if (await this.handleStore(route, request, method, path)) return;
    if (await this.handleSearch(route, request, path)) return;
    if (await this.handleFiles(route, request, method, path)) return;
    if (await this.handleAttachments(route, request, method, path)) return;
    await route.fulfill({ status: 404, body: `Unhandled ${method} ${path}` });
  }

  private async handleCollection(
    route: Route,
    request: Request,
    method: string,
    path: string
  ) {
    if (path !== "/v1/vector_stores") return false;
    if (method === "GET") {
      await this.list(route, this.stores.map((store) => this.storeJson(store)));
    } else if (method === "POST") {
      const store = this.addStore(request.postDataJSON().name);
      await this.json(route, this.storeJson(store));
    } else {
      return false;
    }
    return true;
  }

  private async handleStore(
    route: Route,
    request: Request,
    method: string,
    path: string
  ) {
    const match = path.match(/^\/vector_stores\/([^/]+)\/$/);
    if (!match) return false;
    const store = this.stores.find((item) => item.id === match[1]);
    if (!store) return this.notFound(route);
    if (method === "POST") {
      store.name = request.postDataJSON().name;
      await this.json(route, this.storeJson(store));
      return true;
    }
    if (method === "DELETE") {
      this.stores = this.stores.filter((item) => item !== store);
      await this.json(route, {
        id: store.id,
        object: "vector_store.deleted",
        deleted: true,
      });
      return true;
    }
    return false;
  }

  private async handleSearch(route: Route, request: Request, path: string) {
    const match = path.match(/^\/v1\/vector_stores\/([^/]+)\/search$/);
    if (!match) return false;
    const store = this.stores.find((item) => item.id === match[1]);
    if (!store) return this.notFound(route);
    await this.json(route, {
      object: "vector_store.search_results.page",
      search_query: request.postDataJSON().query,
      data: store.files.map((file) => ({
        file_id: file.id,
        filename: file.filename,
        score: 0.87,
        attributes: null,
        content: [{ type: "text", text: EXCERPT }],
      })),
      has_more: false,
      next_page: null,
    });
    return true;
  }

  private async handleFiles(
    route: Route,
    request: Request,
    method: string,
    path: string
  ) {
    if (path === "/v1/files" && method === "POST") {
      const filename =
        /filename="([^"]+)"/.exec(request.postData() ?? "")?.[1] ?? "upload";
      const file = { id: this.id("file"), filename };
      this.files.set(file.id, file);
      await this.json(route, this.fileJson(file));
      return true;
    }

    const match = path.match(/^\/v1\/files\/([^/]+)$/);
    if (!match) return false;
    const file = this.files.get(match[1]);
    if (!file) return this.notFound(route);
    if (method === "DELETE") {
      this.files.delete(file.id);
      this.stores.forEach((store) => {
        store.files = store.files.filter((item) => item.id !== file.id);
      });
      await this.json(route, { id: file.id, object: "file", deleted: true });
    } else {
      await this.json(route, this.fileJson(file));
    }
    return true;
  }

  private async handleAttachments(
    route: Route,
    request: Request,
    method: string,
    path: string
  ) {
    const match = path.match(
      /^\/v1\/vector_stores\/([^/]+)\/files(?:\/([^/]+))?$/
    );
    if (!match) return false;
    const store = this.stores.find((item) => item.id === match[1]);
    if (!store) return this.notFound(route);
    const fileId = match[2];
    if (!fileId && method === "GET") {
      await this.list(
        route,
        store.files.map((file) => this.attachmentJson(store, file))
      );
      return true;
    }
    if (!fileId && method === "POST") {
      const file = this.files.get(request.postDataJSON().file_id);
      if (!file) return this.notFound(route);
      store.files.push(file);
      await this.json(route, this.attachmentJson(store, file));
      return true;
    }
    const file = store.files.find((item) => item.id === fileId);
    if (!file) return this.notFound(route);
    await this.json(route, this.attachmentJson(store, file));
    return true;
  }

  private async json(route: Route, body: unknown) {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  }

  private async list(route: Route, data: unknown[]) {
    await this.json(route, { object: "list", data, has_more: false });
  }

  private async notFound(route: Route) {
    await route.fulfill({ status: 404, body: "not found" });
    return true;
  }
}

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
