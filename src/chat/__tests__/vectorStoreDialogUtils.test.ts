import { describe, expect, it } from "vitest";
import { APIError, AuthenticationError } from "openai";
import { isMissingApiKeyError } from "../vectorStoreDialogUtils";

describe("isMissingApiKeyError", () => {
  it("detects a 401 from the vector store service", () => {
    const error = new APIError(
      401,
      { detail: "Invalid API key" },
      "401 Invalid API key",
      undefined
    );

    expect(isMissingApiKeyError(error)).toBe(true);
  });

  it("detects the AuthenticationError the SDK throws for 401", () => {
    const error = new AuthenticationError(
      401,
      { detail: "Invalid API key" },
      "401 Invalid API key",
      undefined
    );

    expect(isMissingApiKeyError(error)).toBe(true);
  });

  it("ignores other API errors", () => {
    const error = new APIError(500, {}, "500 Internal Server Error", undefined);

    expect(isMissingApiKeyError(error)).toBe(false);
  });

  it("ignores plain errors that only mention 401", () => {
    expect(isMissingApiKeyError(new Error("401 Invalid API key"))).toBe(false);
  });

  it("ignores values that are not errors", () => {
    expect(isMissingApiKeyError(undefined)).toBe(false);
    expect(isMissingApiKeyError("401")).toBe(false);
  });
});
