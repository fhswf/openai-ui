import { toaster } from "../components/ui/toaster";
import { getInputFileMimeType } from "./utils/attachments";

export function showVectorStoreError(title: string, error: unknown) {
  console.error(title, error);
  toaster.create({
    title,
    description: error instanceof Error ? error.message : String(error),
    type: "error",
    duration: 5000,
  });
}

/*
 * Browsers often report an empty MIME type for e.g. Markdown files, which the
 * vector store service then cannot parse. Fall back to the type derived from
 * the file extension.
 */
export function withVectorStoreFileMimeType(file: File): File {
  if (file.type) return file;
  return new File([file], file.name, { type: getInputFileMimeType(file.name) });
}
