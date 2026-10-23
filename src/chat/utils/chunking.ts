export const MIN_CHUNK_TOKENS = 100;
export const MAX_CHUNK_TOKENS = 4096;

// Target chunk sizes in tokens of the backend's tokenizer.
// "balanced" equals the backend default, so it is never sent.
export const CHUNKING_PRESETS = {
  precise: 400,
  balanced: 1600,
  context: 3200,
} as const;

export type ChunkingPresetId = keyof typeof CHUNKING_PRESETS;

export type ChunkingChoice =
  | { kind: "preset"; preset: ChunkingPresetId }
  | { kind: "custom"; maxTokens: number };

export const DEFAULT_CHUNKING_CHOICE: ChunkingChoice = {
  kind: "preset",
  preset: "balanced",
};

// litellm-pgvector's native strategy; the OpenAI SDK types only know
// "auto" and "static".
export interface SemanticChunkingStrategy {
  type: "semantic";
  semantic: { max_chunk_size_tokens: number };
}

/** Returns undefined for the default so the request stays unchanged. */
export function chunkingStrategyFor(
  choice: ChunkingChoice
): SemanticChunkingStrategy | undefined {
  if (choice.kind === "preset" && choice.preset === "balanced") {
    return undefined;
  }
  const maxTokens =
    choice.kind === "preset"
      ? CHUNKING_PRESETS[choice.preset]
      : choice.maxTokens;
  return { type: "semantic", semantic: { max_chunk_size_tokens: maxTokens } };
}
