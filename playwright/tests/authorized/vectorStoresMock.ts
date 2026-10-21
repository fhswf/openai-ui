import type { Request, Route } from "@playwright/test";

export interface MockFile {
  id: string;
  filename: string;
}

export interface MockStore {
  id: string;
  name: string;
  files: MockFile[];
}

export const EXCERPT = "Die Klausur findet am 12. Februar im Raum H 101 statt.";

/*
 * In-memory stand-in for the litellm-pgvector service, including its
 * non-standard update/delete paths without the /v1 prefix.
 */
export class MockVectorStoreService {
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
}

