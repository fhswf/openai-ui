export const aiHubBaseUrl =
  import.meta.env.VITE_AI_HUB_BASE_URL ||
  import.meta.env.AI_HUB_BASE_URL ||
  "https://hub.ki.fh-swf.de";

const normalizedAiHubBaseUrl = aiHubBaseUrl.replace(/\/$/, "");

export const aiHubApiBaseUrl = `${normalizedAiHubBaseUrl}/v1`;

interface AiHubKeyResponse {
  key: string;
  key_alias?: string;
  key_name?: string;
}

interface ModelListResponse {
  data?: Array<{ id?: string; name?: string } | string>;
}

export interface AiHubBudget {
  max_budget_in_team: number;
  spend: number;
  available: number;
  team_id?: string | null;
  spend_by_team?: Record<string, number>;
}

export type AiHubErrorCode =
  | "key_generation_failed"
  | "key_generation_missing_key"
  | "model_list_failed"
  | "budget_fetch_failed";

export class AiHubError extends Error {
  code: AiHubErrorCode;
  status?: number;

  constructor(code: AiHubErrorCode, status?: number) {
    super(code);
    this.name = "AiHubError";
    this.code = code;
    this.status = status;
  }
}

function assertOk(response: Response, code: AiHubErrorCode) {
  if (!response.ok) {
    throw new AiHubError(code, response.status);
  }
}

export const aiHubTermsUrl =
  "https://publikationen.fhb.fh-swf.de/servlets/MCRFileNodeServlet/fhswf_derivate_00002553/Nr.%201328%20vom%2013.02.2025%20-%20Nutzungsordnung%20der%20FH%20SWF%20f%C3%BCr%20den%20OpenAI-Proxy%20KImpuls-Chatb.pdf";

export async function generateAiHubKey(
  keyAlias = "kimpuls",
  acceptedTerms = false
) {
  const response = await fetch(
    `${normalizedAiHubBaseUrl}/api/key/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key_alias: keyAlias,
        accepted_terms: acceptedTerms,
      }),
    }
  );

  assertOk(response, "key_generation_failed");

  const payload = (await response.json()) as AiHubKeyResponse;
  if (!payload.key) {
    throw new AiHubError("key_generation_missing_key");
  }

  return payload;
}

// Statuscodes, mit denen der AI-Hub antwortet, wenn ein Key-Alias bereits
// vergeben ist (z. B. weil auf einem anderen Rechner schon ein Key erzeugt wurde).
// 401 gehoert nicht dazu: Der Hub meldet damit "Invalid session", also eine
// fehlende Anmeldung im Hub, die ein neuer Alias nicht behebt.
const keyAliasConflictStatuses = new Set([400, 409]);

function createKeyAliasSuffix() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? uuid.replace(/-/g, "").slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

function isKeyAliasConflict(error: unknown) {
  return (
    error instanceof AiHubError &&
    error.code === "key_generation_failed" &&
    error.status !== undefined &&
    keyAliasConflictStatuses.has(error.status)
  );
}

/**
 * Erzeugt einen AI-Hub-Key. Ist der gewuenschte Alias bereits vergeben,
 * wird ein zufaelliger Suffix angehaengt und erneut versucht.
 * `acceptedTerms` muss vom Nutzer bestaetigt worden sein, sonst lehnt der
 * Hub die Erzeugung ab.
 */
export async function generateUniqueAiHubKey(
  keyAlias: string,
  {
    acceptedTerms = false,
    maxAttempts = 3,
    createSuffix = createKeyAliasSuffix,
  }: {
    acceptedTerms?: boolean;
    maxAttempts?: number;
    createSuffix?: () => string;
  } = {}
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const alias = attempt === 0 ? keyAlias : `${keyAlias}-${createSuffix()}`;

    try {
      const payload = await generateAiHubKey(alias, acceptedTerms);
      return { ...payload, key_alias: payload.key_alias || alias };
    } catch (error) {
      if (!isKeyAliasConflict(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
}

export async function fetchAiHubModels(apiKey: string) {
  const response = await fetch(`${aiHubApiBaseUrl}/models`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  assertOk(response, "model_list_failed");

  const payload = (await response.json()) as ModelListResponse;
  return (payload.data ?? [])
    .map((model) =>
      typeof model === "string" ? model : model.id ?? model.name
    )
    .filter((model): model is string => Boolean(model))
    .sort((left, right) => left.localeCompare(right));
}

export async function fetchAiHubBudget() {
  const response = await fetch(`${normalizedAiHubBaseUrl}/api/user/budget`, {
    credentials: "include",
  });

  assertOk(response, "budget_fetch_failed");

  return (await response.json()) as AiHubBudget;
}
