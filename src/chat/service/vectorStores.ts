import type {
  VectorStore,
  VectorStoreDeleted,
  VectorStoreSearchResponse,
} from "openai/resources/vector-stores/vector-stores.mjs";
import type { VectorStoreFile } from "openai/resources/vector-stores/files.mjs";
import { Options } from "../context/types";
import { defaultVectorStoreBaseUrl } from "../context/initState";
import { createClient } from "./openai";

/*
 * Vector stores are managed directly against the litellm-pgvector service
 * (not the LiteLLM hub), using the same user key as the chat requests.
 * The service registers new stores with LiteLLM under the same id.
 */
function getVectorStoreBaseUrl(options: Options) {
  return options.openai.vectorStoreBaseUrl || defaultVectorStoreBaseUrl;
}

function createVectorStoreClient(options: Options) {
  return createClient(options, getVectorStoreBaseUrl(options));
}

/*
 * TODO: litellm-pgvector serves update and delete only at
 * `/vector_stores/{id}/` (without the `/v1` prefix), not at the OpenAI paths
 * used by the SDK. Switch back to `client.vectorStores.update/delete` once the
 * service exposes `POST`/`DELETE /v1/vector_stores/{id}`.
 */
function legacyVectorStoreUrl(options: Options, vectorStoreId: string) {
  const root = getVectorStoreBaseUrl(options)
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "");
  return `${root}/vector_stores/${encodeURIComponent(vectorStoreId)}/`;
}

export type VectorStoreFileWithName = VectorStoreFile & { filename?: string };

// The search runs before every chat request, so fail fast instead of using
// the SDK default of a 10 minute timeout with two retries.
const SEARCH_REQUEST_OPTIONS = { timeout: 15_000, maxRetries: 1 };

// File names never change, so look each one up only once per session.
const filenameCache = new Map<string, string>();

function filenameCacheKey(options: Options, fileId: string) {
  return `${getVectorStoreBaseUrl(options)}|${fileId}`;
}

export async function listVectorStores(
  options: Options
): Promise<VectorStore[]> {
  const client = createVectorStoreClient(options);
  const stores: VectorStore[] = [];
  for await (const store of client.vectorStores.list({ limit: 100 })) {
    stores.push(store);
  }
  return stores;
}

export async function createVectorStore(options: Options, name: string) {
  const client = createVectorStoreClient(options);
  return client.vectorStores.create({ name });
}

export async function renameVectorStore(
  options: Options,
  vectorStoreId: string,
  name: string
) {
  const client = createVectorStoreClient(options);
  return client.post<VectorStore>(
    legacyVectorStoreUrl(options, vectorStoreId),
    {
      body: { name },
    }
  );
}

export async function deleteVectorStore(
  options: Options,
  vectorStoreId: string
) {
  const client = createVectorStoreClient(options);
  return client.delete<VectorStoreDeleted>(
    legacyVectorStoreUrl(options, vectorStoreId)
  );
}

export async function listVectorStoreFiles(
  options: Options,
  vectorStoreId: string
): Promise<VectorStoreFileWithName[]> {
  const client = createVectorStoreClient(options);
  const files: VectorStoreFile[] = [];
  for await (const file of client.vectorStores.files.list(vectorStoreId, {
    limit: 100,
  })) {
    files.push(file);
  }

  // Attachments only carry the file id, so look up the original file names.
  return Promise.all(
    files.map(async (file) => {
      const cacheKey = filenameCacheKey(options, file.id);
      const cached = filenameCache.get(cacheKey);
      if (cached) {
        return { ...file, filename: cached };
      }
      try {
        const original = await client.files.retrieve(file.id);
        filenameCache.set(cacheKey, original.filename);
        return { ...file, filename: original.filename };
      } catch {
        return file;
      }
    })
  );
}

/**
 * Uploads a file and attaches it to the vector store. Resolves once the
 * service has finished parsing and embedding (status completed or failed).
 */
export async function uploadFileToVectorStore(
  options: Options,
  vectorStoreId: string,
  file: File
) {
  const client = createVectorStoreClient(options);
  return client.vectorStores.files.uploadAndPoll(vectorStoreId, file);
}

/** Removes the attachment but keeps the uploaded file. */
export async function removeFileFromVectorStore(
  options: Options,
  vectorStoreId: string,
  fileId: string
) {
  const client = createVectorStoreClient(options);
  return client.vectorStores.files.delete(fileId, {
    vector_store_id: vectorStoreId,
  });
}

/** Deletes the uploaded file together with all of its attachments. */
export async function deleteFile(options: Options, fileId: string) {
  const client = createVectorStoreClient(options);
  filenameCache.delete(filenameCacheKey(options, fileId));
  return client.files.delete(fileId);
}

export async function searchVectorStore(
  options: Options,
  vectorStoreId: string,
  query: string,
  maxResults = 5
): Promise<VectorStoreSearchResponse[]> {
  const client = createVectorStoreClient(options);
  const page = await client.vectorStores.search(
    vectorStoreId,
    { query, max_num_results: maxResults },
    SEARCH_REQUEST_OPTIONS
  );
  return page.data;
}
