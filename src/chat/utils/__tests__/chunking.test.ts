import { describe, it, expect } from "vitest";
import { DEFAULT_CHUNKING_CHOICE, chunkingStrategyFor } from "../chunking";

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
