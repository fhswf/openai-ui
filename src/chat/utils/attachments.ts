export const PDF_MIME_TYPE = "application/pdf";

export const INPUT_FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".pptx",
  ".txt",
  ".md",
  ".html",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".java",
  ".js",
  ".php",
  ".py",
  ".rb",
  ".sh",
  ".tex",
  ".ts",
  ".xlsx",
  ".xls",
  ".csv",
  ".tsv",
  ".iif",
] as const;

export const ACCEPTED_FILE_TYPES = ["image/*", ...INPUT_FILE_EXTENSIONS].join(
  ","
);

const MIME_TYPE_BY_EXTENSION = new Map<string, string>([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".bmp", "image/bmp"],
  [".svg", "image/svg+xml"],
  [".pdf", PDF_MIME_TYPE],
  [".doc", "application/msword"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [
    ".pptx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".html", "text/html"],
  [".json", "application/json"],
  [".xml", "application/xml"],
  [".yaml", "text/yaml"],
  [".yml", "text/yaml"],
  [".c", "text/plain"],
  [".cpp", "text/plain"],
  [".cs", "text/plain"],
  [".css", "text/css"],
  [".go", "text/plain"],
  [".java", "text/plain"],
  [".js", "text/javascript"],
  [".php", "text/plain"],
  [".py", "text/x-python"],
  [".rb", "text/plain"],
  [".sh", "text/plain"],
  [".tex", "text/plain"],
  [".ts", "text/plain"],
  [
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  [".xls", "application/vnd.ms-excel"],
  [".csv", "text/csv"],
  [".tsv", "text/tab-separated-values"],
  [".iif", "text/plain"],
]);

export interface AttachmentLike {
  name?: string;
  type?: string;
}

export interface Attachment {
  id?: string;
  name: string;
  opfsName?: string;
  type?: string;
  size?: number;
  lastModified?: number;
}

export interface VaultAttachmentResolver {
  load(chatId: string, attachmentId: string, filename: string): Promise<File>;
  delete(chatId: string, attachmentId: string): Promise<void>;
  canDelete(chatId: string): boolean;
}

let vaultAttachmentResolver: VaultAttachmentResolver | null = null;

export function setVaultAttachmentResolver(
  resolver: VaultAttachmentResolver | null
): void {
  vaultAttachmentResolver = resolver;
}

/** Gives old OPFS references a stable opaque key without changing chat data. */
export async function getAttachmentStorageId(
  attachmentId: string | undefined,
  filename: string
): Promise<string> {
  if (attachmentId) return attachmentId;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(filename)
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `legacy-${hex}`;
}

export function canDeleteVaultAttachment(chatId: string): boolean {
  return vaultAttachmentResolver?.canDelete(chatId) ?? false;
}

export async function deleteVaultAttachment(
  chatId: string,
  attachmentId: string
): Promise<void> {
  if (!vaultAttachmentResolver) {
    throw new Error("Encrypted attachment storage is not available");
  }
  await vaultAttachmentResolver.delete(chatId, attachmentId);
}

export async function deleteOpfsFile(filename: string): Promise<void> {
  const opfs = await navigator.storage.getDirectory();
  await opfs.removeEntry(filename);
}

export async function getOpfsFile(
  filename: string,
  chatId?: string,
  attachmentId?: string
): Promise<File> {
  try {
    const opfs = await navigator.storage.getDirectory();
    const handle = await opfs.getFileHandle(filename);
    return await handle.getFile();
  } catch (localError) {
    if (!chatId || !attachmentId || !vaultAttachmentResolver) {
      throw localError;
    }
    return vaultAttachmentResolver.load(chatId, attachmentId, filename);
  }
}

/**
 * A file is treated as a PDF when its MIME type says so or, as a fallback for
 * drag-and-drop sources that omit the MIME type, when it carries a `.pdf` name.
 */
export function isPdfFile(file: AttachmentLike | null | undefined): boolean {
  if (!file) {
    return false;
  }
  if (file.type === PDF_MIME_TYPE) {
    return true;
  }
  return (
    typeof file.name === "string" && file.name.toLowerCase().endsWith(".pdf")
  );
}

export function isInputFile(file: AttachmentLike | null | undefined): boolean {
  if (isPdfFile(file)) {
    return true;
  }
  if (!file || typeof file.name !== "string") {
    return false;
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return (INPUT_FILE_EXTENSIONS as readonly string[]).includes(extension);
}

export function isSpreadsheetFile(
  file: AttachmentLike | null | undefined
): boolean {
  if (!file || typeof file.name !== "string") {
    return false;
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return [".xlsx", ".xls", ".csv", ".tsv", ".iif"].includes(extension);
}

export function getInputFileMimeType(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MIME_TYPE_BY_EXTENSION.get(extension) ?? "application/octet-stream";
}

export function isImageFile(file: AttachmentLike | null | undefined): boolean {
  return Boolean(file?.type?.startsWith("image/"));
}

export function isSupportedFile(
  file: AttachmentLike | null | undefined
): boolean {
  return isImageFile(file) || isInputFile(file);
}

const EXTENSION_BY_MIME_TYPE = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/gif", "gif"],
  ["image/webp", "webp"],
  ["image/bmp", "bmp"],
  ["image/svg+xml", "svg"],
]);

/** Returns a simple, safe extension, or `undefined` when none can be derived. */
function sanitizeExtension(value: string | undefined): string | undefined {
  if (!value || !/^[a-z0-9]+$/i.test(value)) {
    return undefined;
  }
  return value.toLowerCase();
}

/**
 * Returns a usable filename for a file. Screenshots pasted from the clipboard
 * often arrive with an empty name, so fall back to a generated one derived from
 * the MIME type. `index` keeps multiple pasted files from colliding and `now`
 * is injectable to keep the result deterministic in tests.
 */
export function ensureFileName(
  file: AttachmentLike | null | undefined,
  index = 0,
  now = Date.now()
): string {
  if (file?.name && file.name.trim().length > 0) {
    return file.name;
  }
  const type = file?.type ?? "";
  const extension =
    EXTENSION_BY_MIME_TYPE.get(type) ??
    sanitizeExtension(type.split("/")[1]) ??
    "png";
  const suffix = index > 0 ? `-${index}` : "";
  return `pasted-image-${now}${suffix}.${extension}`;
}

/**
 * Collects files from a paste or drop `DataTransfer`. Some browsers expose
 * pasted clipboard images only through `items`, so fall back to that when the
 * `files` list is empty.
 */
export function extractFiles(
  dataTransfer: DataTransfer | null | undefined
): File[] {
  if (!dataTransfer) {
    return [];
  }
  const files = Array.from(dataTransfer.files);
  if (files.length > 0) {
    return files;
  }
  return Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a local or lazily restored OPFS file and returns a base64 data URL.
 */
export async function readOpfsFileAsDataUrl(
  filename: string,
  chatId?: string,
  attachmentId?: string
): Promise<string> {
  const file = await getOpfsFile(filename, chatId, attachmentId);
  // OPFS does not preserve the original File MIME type. Restore it from the
  // filename so the data URL carries a useful MIME type for input_file.
  return fileToDataUrl(
    new Blob([file], { type: getInputFileMimeType(filename) })
  );
}

/**
 * Builds the Responses API `input_file` item. The local OPFS name and vault ID
 * stay in chat storage and are removed before the request reaches the API.
 */
export function buildInputFile(attachment: Attachment) {
  return {
    type: "input_file" as const,
    filename: attachment.name,
    opfsName: attachment.opfsName ?? attachment.name,
    attachmentId: attachment.id,
    size: attachment.size,
    mimeType: attachment.type,
  };
}
