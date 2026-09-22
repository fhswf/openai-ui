export const PDF_MIME_TYPE = "application/pdf";

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

export function isImageFile(file: AttachmentLike | null | undefined): boolean {
  return Boolean(file?.type?.startsWith("image/"));
}

export function isSupportedFile(
  file: AttachmentLike | null | undefined
): boolean {
  return isImageFile(file) || isPdfFile(file);
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
  return fileToDataUrl(file);
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
