import { describe, it, expect } from "vitest";
import {
  isValidMcpToolName,
  MCP_TOOL_NAME_MAX_LENGTH,
  mergeServerLabelOnNameChange,
  sanitizeMcpToolName,
} from "../mcpToolName";

describe("isValidMcpToolName", () => {
  it("accepts names with letters, digits, underscores and hyphens", () => {
    expect(isValidMcpToolName("dmcp")).toBe(true);
    expect(isValidMcpToolName("deepwiki_1")).toBe(true);
    expect(isValidMcpToolName("my-tool_2")).toBe(true);
    expect(isValidMcpToolName("ABCxyz019")).toBe(true);
  });

  it("rejects empty names", () => {
    expect(isValidMcpToolName("")).toBe(false);
  });

  it("rejects names containing spaces", () => {
    expect(isValidMcpToolName("Original Service")).toBe(false);
  });

  it("rejects names with characters outside the OpenAI pattern", () => {
    expect(isValidMcpToolName("deep.wiki")).toBe(false);
    expect(isValidMcpToolName("service/name")).toBe(false);
    expect(isValidMcpToolName("emoji🙂")).toBe(false);
    expect(isValidMcpToolName("über")).toBe(false);
  });

  it("rejects names longer than the OpenAI limit", () => {
    const tooLong = "a".repeat(MCP_TOOL_NAME_MAX_LENGTH + 1);
    expect(isValidMcpToolName(tooLong)).toBe(false);
  });

  it("accepts a name exactly at the OpenAI limit", () => {
    const maxLength = "a".repeat(MCP_TOOL_NAME_MAX_LENGTH);
    expect(isValidMcpToolName(maxLength)).toBe(true);
  });
});

describe("sanitizeMcpToolName", () => {
  it("replaces runs of illegal characters with a single underscore", () => {
    expect(sanitizeMcpToolName("Original Service")).toBe("Original_Service");
    expect(sanitizeMcpToolName("a  --  b")).toBe("a_--_b");
    expect(sanitizeMcpToolName("deep.wiki/v2")).toBe("deep_wiki_v2");
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizeMcpToolName("  Service  ")).toBe("Service");
  });

  it("produces a legal label for typical display names", () => {
    for (const name of ["Original Service", "Über Server", "a.b/c"]) {
      expect(isValidMcpToolName(sanitizeMcpToolName(name))).toBe(true);
    }
  });

  it("truncates to the OpenAI limit", () => {
    const sanitized = sanitizeMcpToolName("a".repeat(80));
    expect(sanitized).toHaveLength(MCP_TOOL_NAME_MAX_LENGTH);
    expect(isValidMcpToolName(sanitized)).toBe(true);
  });

  it("can produce an empty label for names without legal characters", () => {
    expect(sanitizeMcpToolName("   ")).toBe("");
    expect(isValidMcpToolName(sanitizeMcpToolName("   "))).toBe(false);
  });
});

describe("mergeServerLabelOnNameChange", () => {
  it("tracks the sanitized name while the label was not edited by hand", () => {
    expect(
      mergeServerLabelOnNameChange({
        currentLabel: "Original Service",
        currentServerLabel: "Original_Service",
        nextLabel: "New Name",
      })
    ).toBe("New_Name");
  });

  it("keeps a manually edited label", () => {
    expect(
      mergeServerLabelOnNameChange({
        currentLabel: "Original Service",
        currentServerLabel: "custom_label",
        nextLabel: "New Name",
      })
    ).toBe("custom_label");
  });

  it("starts deriving a label for a fresh form", () => {
    expect(
      mergeServerLabelOnNameChange({
        currentLabel: "",
        currentServerLabel: "",
        nextLabel: "My Server",
      })
    ).toBe("My_Server");
  });
});
