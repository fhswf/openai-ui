import { describe, it, expect } from "vitest";
import {
  ChunkingChoice,
  DEFAULT_CHUNKING_CHOICE,
  chunkingChoiceFromMetadata,
  chunkingChoiceFromStrategy,
  chunkingStrategyFor,
  metadataWithChunkingChoice,
  validateChunkTokens,
} from "../chunking";

function semantic(maxTokens: unknown) {
  return { type: "semantic", semantic: { max_chunk_size_tokens: maxTokens } };
}

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

describe("chunkingChoiceFromStrategy", () => {
  it.each([
    [400, "precise"],
    [1600, "balanced"],
    [3200, "context"],
  ] as const)("maps %i tokens to the %s preset", (maxTokens, preset) => {
    expect(chunkingChoiceFromStrategy(semantic(maxTokens))).toEqual({
      kind: "preset",
      preset,
    });
  });

  it("maps other sizes to a custom choice", () => {
    expect(chunkingChoiceFromStrategy(semantic(1234))).toEqual({
      kind: "custom",
      maxTokens: 1234,
    });
  });

  it("reads the static shape as well", () => {
    expect(
      chunkingChoiceFromStrategy({
        type: "static",
        static: { max_chunk_size_tokens: 3200, chunk_overlap_tokens: 0 },
      })
    ).toEqual({ kind: "preset", preset: "context" });
  });

  it.each([
    ["an unknown strategy", { type: "other" }],
    ["undefined", undefined],
    ["null", null],
    ["a string", "kaputt"],
    ["a strategy without a size", { type: "semantic", semantic: {} }],
    ["a strategy without details", { type: "semantic" }],
    ["a size given as text", semantic("400")],
    [
      "details under the wrong type",
      { type: "static", semantic: { max_chunk_size_tokens: 400 } },
    ],
  ])("returns null for %s", (_label, strategy) => {
    expect(chunkingChoiceFromStrategy(strategy)).toBeNull();
  });
});

describe("chunkingChoiceFromMetadata", () => {
  it("reads a stored preset", () => {
    expect(chunkingChoiceFromMetadata({ chunking: "precise" })).toEqual({
      kind: "preset",
      preset: "precise",
    });
  });

  it("reads a stored custom size", () => {
    expect(chunkingChoiceFromMetadata({ chunking: "1234" })).toEqual({
      kind: "custom",
      maxTokens: 1234,
    });
  });

  it.each([
    ["an out of range size", { chunking: "99" }],
    ["an unknown value", { chunking: "quatsch" }],
    ["an inherited property name", { chunking: "toString" }],
    ["an empty value", { chunking: "" }],
    ["no stored value", {}],
    ["null metadata", null],
    ["undefined metadata", undefined],
  ])("falls back to the default for %s", (_label, metadata) => {
    expect(chunkingChoiceFromMetadata(metadata)).toEqual(
      DEFAULT_CHUNKING_CHOICE
    );
  });
});

describe("metadataWithChunkingChoice", () => {
  it("keeps other keys and replaces an old choice", () => {
    const metadata = { owner: "x", chunking: "context" };

    expect(
      metadataWithChunkingChoice(metadata, {
        kind: "preset",
        preset: "precise",
      })
    ).toEqual({ owner: "x", chunking: "precise" });
  });

  it("stores a custom size as text", () => {
    expect(
      metadataWithChunkingChoice(null, { kind: "custom", maxTokens: 1234 })
    ).toEqual({ chunking: "1234" });
  });

  it("does not modify the given metadata", () => {
    const metadata = { owner: "x" };

    metadataWithChunkingChoice(metadata, { kind: "preset", preset: "precise" });

    expect(metadata).toEqual({ owner: "x" });
  });

  it.each<ChunkingChoice>([
    { kind: "preset", preset: "precise" },
    { kind: "preset", preset: "balanced" },
    { kind: "preset", preset: "context" },
    { kind: "custom", maxTokens: 1234 },
  ])("reads back %j after storing it", (choice) => {
    const stored = metadataWithChunkingChoice({}, choice);

    expect(chunkingChoiceFromMetadata(stored)).toEqual(choice);
  });
});
