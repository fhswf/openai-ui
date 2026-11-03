export const FEATURE_TOUR_STORAGE_KEY = "openai-ui:feature-tour:v1";
const SCHEMA_VERSION = 1;

export interface FeatureTourProgress {
  schemaVersion: number;
  lastKnownBuild?: string;
  seen: Record<string, number>;
}

export function createInitialFeatureTourProgress(): FeatureTourProgress {
  return { schemaVersion: SCHEMA_VERSION, seen: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseFeatureTourProgress(value: unknown): FeatureTourProgress {
  if (!isRecord(value) || !isRecord(value.seen)) {
    return createInitialFeatureTourProgress();
  }

  const seen: Record<string, number> = {};
  for (const [id, revision] of Object.entries(value.seen)) {
    if (
      typeof revision === "number" &&
      Number.isInteger(revision) &&
      revision > 0
    ) {
      seen[id] = revision;
    }
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    lastKnownBuild:
      typeof value.lastKnownBuild === "string"
        ? value.lastKnownBuild
        : undefined,
    seen,
  };
}

export function readFeatureTourProgress(): FeatureTourProgress {
  try {
    if (typeof window === "undefined") return createInitialFeatureTourProgress();
    const raw = window.localStorage.getItem(FEATURE_TOUR_STORAGE_KEY);
    return raw
      ? parseFeatureTourProgress(JSON.parse(raw))
      : createInitialFeatureTourProgress();
  } catch (error) {
    console.warn("Could not read feature tour progress:", error);
    return createInitialFeatureTourProgress();
  }
}

export function writeFeatureTourProgress(progress: FeatureTourProgress): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FEATURE_TOUR_STORAGE_KEY,
      JSON.stringify(parseFeatureTourProgress(progress))
    );
  } catch (error) {
    // Tours remain usable for this session when browser storage is unavailable.
    console.warn("Could not save feature tour progress:", error);
  }
}

export function hasSeenFeatureGuide(
  progress: FeatureTourProgress,
  guideId: string,
  revision: number
): boolean {
  return (progress.seen[guideId] ?? 0) >= revision;
}
