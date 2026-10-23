import { describe, it, expect, vi, beforeEach } from "vitest";
import { Options } from "../../context/types";

const client = {
  post: vi.fn(),
  delete: vi.fn(),
  vectorStores: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
    files: {
      list: vi.fn(),
      createAndPoll: vi.fn(),
      delete: vi.fn(),
    },
  },
  files: {
    create: vi.fn(),
    retrieve: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("../openai", () => ({
  createClient: vi.fn(() => client),
}));

vi.mock("../../context/initState", () => ({
  defaultVectorStoreBaseUrl: "https://pgvector.example/v1",
}));

import { createClient } from "../openai";
import {
  createVectorStore,
  deleteFile,
  deleteVectorStore,
  listVectorStoreFiles,
  listVectorStores,
  removeFileFromVectorStore,
  renameVectorStore,
  searchVectorStore,
  uploadFileToVectorStore,
} from "../vectorStores";

async function* iterate<T>(items: T[]) {
  for (const item of items) yield item;
}

function makeOptions(vectorStoreBaseUrl?: string): Options {
  return {
    openai: { apiKey: "sk-test", vectorStoreBaseUrl },
  } as unknown as Options;
}

describe("vectorStores service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the configured vector store base url", async () => {
    client.vectorStores.list.mockReturnValue(iterate([]));
    const options = makeOptions("https://custom.example/v1");

    await listVectorStores(options);

    expect(createClient).toHaveBeenCalledWith(
      options,
      "https://custom.example/v1"
    );
  });

  it("falls back to the default base url for persisted settings without one", async () => {
    client.vectorStores.list.mockReturnValue(iterate([]));
    const options = makeOptions();

    await listVectorStores(options);

    expect(createClient).toHaveBeenCalledWith(
      options,
      "https://pgvector.example/v1"
    );
  });

  it("collects all vector stores from the paginated list", async () => {
    client.vectorStores.list.mockReturnValue(
      iterate([{ id: "a" }, { id: "b" }])
    );

    const stores = await listVectorStores(makeOptions());

    expect(stores.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("creates vector stores via the SDK", async () => {
    await createVectorStore(makeOptions(), "Skript");

    expect(client.vectorStores.create).toHaveBeenCalledWith({ name: "Skript" });
  });

  it("renames and deletes vector stores via the pgvector paths without /v1", async () => {
    const options = makeOptions("https://pgvector.example/v1/");

    await renameVectorStore(options, "vs1", "Skript 2");
    await deleteVectorStore(options, "vs1");

    expect(client.post).toHaveBeenCalledWith(
      "https://pgvector.example/vector_stores/vs1/",
      {
        body: { name: "Skript 2" },
      }
    );
    expect(client.delete).toHaveBeenCalledWith(
      "https://pgvector.example/vector_stores/vs1/"
    );
  });

  it("adds file names to the attached files", async () => {
    client.vectorStores.files.list.mockReturnValue(
      iterate([
        { id: "file-1", status: "completed" },
        { id: "file-2", status: "failed" },
      ])
    );
    client.files.retrieve.mockImplementation(async (id: string) => {
      if (id === "file-2") throw new Error("not found");
      return { id, filename: "skript.pdf" };
    });

    const files = await listVectorStoreFiles(makeOptions(), "vs1");

    expect(files).toEqual([
      { id: "file-1", status: "completed", filename: "skript.pdf" },
      { id: "file-2", status: "failed" },
    ]);
  });

  it("uploads a file and attaches it with the service default", async () => {
    const file = new File(["hello"], "notes.md", { type: "text/markdown" });
    client.files.create.mockResolvedValue({ id: "file-1" });

    await uploadFileToVectorStore(makeOptions(), "vs1", file);

    expect(client.files.create).toHaveBeenCalledWith({
      file,
      purpose: "assistants",
    });
    // toHaveBeenCalledWith ignores undefined properties, so check the body
    // itself: without a strategy the request must stay unchanged.
    const [storeId, body] =
      client.vectorStores.files.createAndPoll.mock.calls[0];
    expect(storeId).toBe("vs1");
    expect(body).toEqual({ file_id: "file-1" });
    expect(body).not.toHaveProperty("chunking_strategy");
  });

  it("attaches a file with the given chunking strategy", async () => {
    const file = new File(["hello"], "notes.md", { type: "text/markdown" });
    const strategy = {
      type: "semantic" as const,
      semantic: { max_chunk_size_tokens: 400 },
    };
    client.files.create.mockResolvedValue({ id: "file-1" });

    await uploadFileToVectorStore(makeOptions(), "vs1", file, strategy);

    expect(client.vectorStores.files.createAndPoll).toHaveBeenCalledWith(
      "vs1",
      {
        file_id: "file-1",
        chunking_strategy: strategy,
      }
    );
  });

  it("distinguishes removing an attachment from deleting the file", async () => {
    const options = makeOptions();

    await removeFileFromVectorStore(options, "vs1", "file-1");
    await deleteFile(options, "file-1");

    expect(client.vectorStores.files.delete).toHaveBeenCalledWith("file-1", {
      vector_store_id: "vs1",
    });
    expect(client.files.delete).toHaveBeenCalledWith("file-1");
  });

  it("searches a vector store", async () => {
    client.vectorStores.search.mockResolvedValue({
      data: [
        { file_id: "file-1", filename: "skript.pdf", score: 0.9, content: [] },
      ],
    });

    const results = await searchVectorStore(makeOptions(), "vs1", "Klausur", 3);

    expect(client.vectorStores.search).toHaveBeenCalledWith(
      "vs1",
      { query: "Klausur", max_num_results: 3 },
      { timeout: 15_000, maxRetries: 1 }
    );
    expect(results).toHaveLength(1);
  });

  it("looks up each file name only once", async () => {
    client.vectorStores.files.list.mockImplementation(() =>
      iterate([{ id: "file-cached", status: "completed" }])
    );
    client.files.retrieve.mockResolvedValue({
      id: "file-cached",
      filename: "cached.pdf",
    });

    await listVectorStoreFiles(makeOptions(), "vs1");
    const files = await listVectorStoreFiles(makeOptions(), "vs1");

    expect(files[0].filename).toBe("cached.pdf");
    expect(client.files.retrieve).toHaveBeenCalledTimes(1);
  });
});
