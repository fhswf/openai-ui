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

export const ACCEPTED_FILE_TYPES = [
  "image/*",
  ...INPUT_FILE_EXTENSIONS,
].join(",");

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".pdf": PDF_MIME_TYPE,
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".c": "text/plain",
  ".cpp": "text/plain",
  ".cs": "text/plain",
  ".css": "text/css",
  ".go": "text/plain",
  ".java": "text/plain",
  ".js": "text/javascript",
  ".php": "text/plain",
  ".py": "text/x-python",
  ".rb": "text/plain",
  ".sh": "text/plain",
  ".tex": "text/plain",
  ".ts": "text/plain",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".iif": "text/plain",
};

export interface AttachmentLike {
  name?: string;
  type?: string;
}

export interface Attachment {
  id?: string;
  name: string;
  type?: string;
  size?: number;
  lastModified?: number;
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
  return MIME_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

export function isImageFile(file: AttachmentLike | null | undefined): boolean {
  return Boolean(file?.type?.startsWith("image/"));
}

export function isSupportedFile(
  file: AttachmentLike | null | undefined
): boolean {
  return isImageFile(file) || isInputFile(file);
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
 * Reads a file previously persisted in the origin private file system and
 * returns it as a base64 data URL.
 */
export async function readOpfsFileAsDataUrl(filename: string): Promise<string> {
  const opfs = await navigator.storage.getDirectory();
  const fileHandle = await opfs.getFileHandle(filename);
  const file = await fileHandle.getFile();
  // OPFS does not preserve the original File MIME type. Restore it from the
  // filename so the data URL carries a useful MIME type for input_file.
  return fileToDataUrl(
    new Blob([file], { type: getInputFileMimeType(filename) })
  );
}

/**
 * Builds the Responses API `input_file` content item. The file content stays in
 * OPFS (keyed by `filename`) and is turned into base64 `file_data` for each
 * request, never uploaded through the files API.
 */
export function buildInputFile(attachment: Attachment) {
  return {
    type: "input_file" as const,
    filename: attachment.name,
  };
}
