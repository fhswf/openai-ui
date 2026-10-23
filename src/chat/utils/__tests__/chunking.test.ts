import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHUNKING_CHOICE,
  chunkingStrategyFor,
  validateChunkTokens,
} from "../chunking";

describe("chunkingStrategyFor", () => {
  it("sends nothing for the default so the backend default applies", () => {
    expect(chunkingStrategyFor(DEFAULT_CHUNKING_CHOICE)).toBeUndefined();
  });

  it("maps presets to semantic strategies", () => {
    expect(chunkingStrategyFor({ kind: "preset", preset: "precise" })).toEqual({
      type: "semantic",
      semantic: { max_chunk_size_tokens: 400 },
    });
    expect(chunkingStrategyFor({ kind: "preset", preset: "context" })).toEqual({
      type: "semantic",
      semantic: { max_chunk_size_tokens: 3200 },
    });
  });

  it("sends a custom size even if it equals the default", () => {
    expect(chunkingStrategyFor({ kind: "custom", maxTokens: 1600 })).toEqual({
      type: "semantic",
      semantic: { max_chunk_size_tokens: 1600 },
    });
  });
});

describe("validateChunkTokens", () => {
  it.each(["", "   "])("rejects %j as empty", (input) => {
    expect(validateChunkTokens(input)).toEqual({ ok: false, error: "empty" });
  });

  it.each([
    ["100", 100],
    ["4096", 4096],
    [" 800 ", 800],
    ["0100", 100],
  ])("accepts %j as %i", (input, value) => {
    expect(validateChunkTokens(input)).toEqual({ ok: true, value });
  });

  it.each(["99", "4097", "0"])("rejects %j as out of range", (input) => {
    expect(validateChunkTokens(input)).toEqual({
      ok: false,
      error: "out_of_range",
    });
  });

  it.each(["12.5", "abc", "12abc", "1e3", "0x100", "-5", "+5"])(
    "rejects %j as not an integer",
    (input) => {
      expect(validateChunkTokens(input)).toEqual({
        ok: false,
        error: "not_integer",
      });
    }
  );
});
