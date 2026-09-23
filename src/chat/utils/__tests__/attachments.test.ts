import { describe, it, expect } from "vitest";
import {
  PDF_MIME_TYPE,
  isPdfFile,
  isImageFile,
  isSupportedFile,
  fileToDataUrl,
  buildInputFile,
} from "../attachments";

describe("isPdfFile", () => {
  it("detects PDFs by mime type", () => {
    expect(isPdfFile({ name: "doc", type: PDF_MIME_TYPE })).toBe(true);
  });

  it("detects PDFs by file extension when the mime type is missing", () => {
    expect(isPdfFile({ name: "Report.PDF" })).toBe(true);
    expect(isPdfFile({ name: "report.pdf", type: "" })).toBe(true);
  });

  it("rejects images, other files and empty input", () => {
    expect(isPdfFile({ name: "photo.png", type: "image/png" })).toBe(false);
    expect(isPdfFile({ name: "notes.txt", type: "text/plain" })).toBe(false);
    expect(isPdfFile(null)).toBe(false);
    expect(isPdfFile(undefined)).toBe(false);
  });
});

describe("isImageFile / isSupportedFile", () => {
  it("detects images", () => {
    expect(isImageFile({ name: "photo.png", type: "image/png" })).toBe(true);
    expect(isImageFile({ name: "doc.pdf", type: PDF_MIME_TYPE })).toBe(false);
  });

  it("supports images and PDFs only", () => {
    expect(isSupportedFile({ name: "photo.png", type: "image/jpeg" })).toBe(
      true
    );
    expect(isSupportedFile({ name: "doc.pdf", type: PDF_MIME_TYPE })).toBe(
      true
    );
    expect(isSupportedFile({ name: "notes.txt", type: "text/plain" })).toBe(
      false
    );
  });
});

describe("fileToDataUrl", () => {
  it("encodes the file contents as a base64 data URL", async () => {
    const file = new Blob(["hello"], { type: PDF_MIME_TYPE });
    await expect(fileToDataUrl(file)).resolves.toBe(
      `data:${PDF_MIME_TYPE};base64,aGVsbG8=`
    );
  });
});

describe("buildInputFile", () => {
  it("builds an input_file item without using the files API", () => {
    const item = buildInputFile({ name: "document.pdf" });

    expect(item).toEqual({
      type: "input_file",
      filename: "document.pdf",
    });
    expect(item).not.toHaveProperty("file_id");
  });
});
