import { describe, it, expect } from "vitest";
import {
  PDF_MIME_TYPE,
  ACCEPTED_FILE_TYPES,
  isPdfFile,
  isImageFile,
  isInputFile,
  isSpreadsheetFile,
  isSupportedFile,
  getInputFileMimeType,
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

describe("supported attachments", () => {
  it("detects images", () => {
    expect(isImageFile({ name: "photo.png", type: "image/png" })).toBe(true);
    expect(isImageFile({ name: "doc.pdf", type: PDF_MIME_TYPE })).toBe(false);
    expect(isSupportedFile({ name: "photo.png", type: "image/jpeg" })).toBe(
      true
    );
  });

  it.each([
    "report.docx",
    "slides.pptx",
    "notes.txt",
    "source.py",
    "source.ts",
    "workbook.xlsx",
    "workbook.xls",
    "data.csv",
    "data.tsv",
    "export.iif",
  ])("accepts supported input file %s", (name) => {
    expect(isInputFile({ name })).toBe(true);
    expect(isSupportedFile({ name })).toBe(true);
  });

  it("accepts PDFs by MIME type even when the filename is missing", () => {
    expect(isInputFile({ type: PDF_MIME_TYPE })).toBe(true);
  });

  it("matches extensions without case sensitivity", () => {
    expect(isInputFile({ name: "REPORT.DOCX" })).toBe(true);
    expect(isSpreadsheetFile({ name: "DATA.CSV" })).toBe(true);
  });

  it("rejects unsupported file types", () => {
    expect(isInputFile({ name: "archive.zip" })).toBe(false);
    expect(isSupportedFile({ name: "archive.zip" })).toBe(false);
    expect(isSpreadsheetFile({ name: "report.docx" })).toBe(false);
  });

  it("includes supported input extensions in the file chooser filter", () => {
    expect(ACCEPTED_FILE_TYPES).toContain("image/*");
    expect(ACCEPTED_FILE_TYPES).toContain(".docx");
    expect(ACCEPTED_FILE_TYPES).toContain(".xlsx");
    expect(ACCEPTED_FILE_TYPES).toContain(".csv");
    expect(ACCEPTED_FILE_TYPES).toContain(".tsv");
  });
});

describe("isSpreadsheetFile / getInputFileMimeType", () => {
  it.each(["table.xlsx", "table.xls", "table.csv", "table.tsv", "data.iif"])(
    "recognizes spreadsheet file %s",
    (name) => {
      expect(isSpreadsheetFile({ name })).toBe(true);
    }
  );

  it("restores MIME types from the filename", () => {
    expect(getInputFileMimeType("report.pdf")).toBe(PDF_MIME_TYPE);
    expect(getInputFileMimeType("report.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(getInputFileMimeType("sheet.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(getInputFileMimeType("data.csv")).toBe("text/csv");
    expect(getInputFileMimeType("data.tsv")).toBe(
      "text/tab-separated-values"
    );
    expect(getInputFileMimeType("unknown.bin")).toBe(
      "application/octet-stream"
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
  it.each(["document.pdf", "report.docx", "data.csv"])(
    "builds an input_file item for %s without using the files API",
    (name) => {
      const item = buildInputFile({ name });

      expect(item).toEqual({
        type: "input_file",
        filename: name,
      });
      expect(item).not.toHaveProperty("file_id");
    }
  );
});
