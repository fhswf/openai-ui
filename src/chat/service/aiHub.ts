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

export type AiHubErrorCode =
  | "key_generation_failed"
  | "key_generation_missing_key"
  | "model_list_failed";

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

export async function generateAiHubKey(keyAlias = "kimpuls") {
  const response = await fetch(
    `${normalizedAiHubBaseUrl}/api/key/generate`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key_alias: keyAlias }),
    }
  );

  assertOk(response, "key_generation_failed");

  const payload = (await response.json()) as AiHubKeyResponse;
  if (!payload.key) {
    throw new AiHubError("key_generation_missing_key");
  }

  return payload;
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
