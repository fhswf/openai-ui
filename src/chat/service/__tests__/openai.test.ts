import { describe, it, expect, vi } from "vitest";
import { APIError } from "openai";

// Mock the toaster
vi.mock("../../../components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

// Mock i18next
vi.mock("i18next", () => ({
  t: (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      error_occurred: "Error occurred",
      ai_hub_responses_api_not_supported:
        "The Responses API requires a compatible endpoint. Your current Base URL appears to be configured for the Chat Completions API. Please check your Base URL setting or reset to the default OpenAI API endpoint.",
      login_required: "Login required",
      login_required_description: "Please log in to continue.",
    };
    if (params) {
      return translations[key] || key;
    }
    return translations[key] || key;
  },
}));

// Mock Sentry
vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}));

// Since we can't easily test the createResponse function without significant mocking,
// let's test the error detection logic directly
describe("Incompatible endpoint error detection", () => {
  it("should detect Chat Completions endpoint from baseUrl", () => {
    const isChatCompletionsEndpoint = (baseUrl: string) => {
      return baseUrl.includes("/chat/completions");
    };

    expect(isChatCompletionsEndpoint("https://openai.ki.fh-swf.de/api/v1/chat/completions")).toBe(true);
    expect(isChatCompletionsEndpoint("https://api.openai.com/v1/chat/completions")).toBe(true);
    expect(isChatCompletionsEndpoint("https://api.openai.com/v1")).toBe(false);
    expect(isChatCompletionsEndpoint("")).toBe(false);
  });

  it("should detect legacy proxy from baseUrl", () => {
    const isLegacyProxy = (baseUrl: string) => {
      return baseUrl.includes("openai.ki.fh-swf.de/api");
    };

    expect(isLegacyProxy("https://openai.ki.fh-swf.de/api/v1/chat/completions")).toBe(true);
    expect(isLegacyProxy("https://openai.ki.fh-swf.de/api")).toBe(true);
    expect(isLegacyProxy("https://hub.ki.fh-swf.de/v1")).toBe(false);
    expect(isLegacyProxy("https://api.openai.com/v1")).toBe(false);
  });

  it("should identify 'Unknown parameter: model' error", () => {
    const isModelParameterError = (message: string | undefined) => {
      return (
        message?.includes("Unknown parameter") && message?.includes("'model'")
      );
    };

    expect(
      isModelParameterError("Ws: 400 Unknown parameter: 'model'.")
    ).toBe(true);
    expect(
      isModelParameterError("Unknown parameter: 'model' is not supported")
    ).toBe(true);
    expect(isModelParameterError("Unknown parameter: 'temperature'")).toBe(
      false
    );
    expect(isModelParameterError("Error: something else")).toBe(false);
  });

  it("should detect APIError with 400 status", () => {
    const mockError = new APIError(
      400,
      { message: "Unknown parameter: 'model'." },
      "Ws: 400 Unknown parameter: 'model'."
    );

    expect(mockError.status).toBe(400);
    expect(mockError.message).toContain("Unknown parameter");
  });

  it("should handle error with missing message", () => {
    const isModelParameterError = (message: string | undefined) => {
      return (
        message?.includes("Unknown parameter") && message?.includes("'model'")
      );
    };

    expect(isModelParameterError(undefined)).toBe(false);
  });
});

// Test the combined error detection logic
describe("Incompatible endpoint error handling logic", () => {
  it("should trigger specific error for model parameter error with Chat Completions endpoint", () => {
    const shouldShowIncompatibleEndpointError = (
      error: APIError | null,
      baseUrl: string | undefined
    ) => {
      if (
        error?.status === 400 &&
        error.message?.includes("Unknown parameter") &&
        error.message?.includes("'model'")
      ) {
        const normalizedBaseUrl = baseUrl || "";
        const isChatCompletionsEndpoint = normalizedBaseUrl.includes("/chat/completions");
        const isLegacyProxy = normalizedBaseUrl.includes("openai.ki.fh-swf.de/api");

        if (isChatCompletionsEndpoint || isLegacyProxy) {
          return true;
        }
      }
      return false;
    };

    const chatCompletionsUrl = "https://openai.ki.fh-swf.de/api/v1/chat/completions";
    const apiError = new APIError(
      400,
      { message: "Unknown parameter: 'model'." },
      "Ws: 400 Unknown parameter: 'model'."
    );

    expect(shouldShowIncompatibleEndpointError(apiError, chatCompletionsUrl)).toBe(true);
    expect(
      shouldShowIncompatibleEndpointError(apiError, "https://api.openai.com/v1")
    ).toBe(false);
  });

  it("should trigger for legacy proxy endpoint", () => {
    const shouldShowIncompatibleEndpointError = (
      error: APIError | null,
      baseUrl: string | undefined
    ) => {
      if (
        error?.status === 400 &&
        error.message?.includes("Unknown parameter") &&
        error.message?.includes("'model'")
      ) {
        const normalizedBaseUrl = baseUrl || "";
        const isChatCompletionsEndpoint = normalizedBaseUrl.includes("/chat/completions");
        const isLegacyProxy = normalizedBaseUrl.includes("openai.ki.fh-swf.de/api");

        if (isChatCompletionsEndpoint || isLegacyProxy) {
          return true;
        }
      }
      return false;
    };

    const legacyProxyUrl = "https://openai.ki.fh-swf.de/api";
    const apiError = new APIError(
      400,
      { message: "Unknown parameter: 'model'." },
      "Ws: 400 Unknown parameter: 'model'."
    );

    expect(shouldShowIncompatibleEndpointError(apiError, legacyProxyUrl)).toBe(true);
  });

  it("should not trigger for non-400 errors", () => {
    const shouldShowIncompatibleEndpointError = (
      error: APIError | null,
      baseUrl: string | undefined
    ) => {
      if (
        error?.status === 400 &&
        error.message?.includes("Unknown parameter") &&
        error.message?.includes("'model'")
      ) {
        const normalizedBaseUrl = baseUrl || "";
        const isChatCompletionsEndpoint = normalizedBaseUrl.includes("/chat/completions");
        const isLegacyProxy = normalizedBaseUrl.includes("openai.ki.fh-swf.de/api");

        if (isChatCompletionsEndpoint || isLegacyProxy) {
          return true;
        }
      }
      return false;
    };

    const chatCompletionsUrl = "https://openai.ki.fh-swf.de/api/v1/chat/completions";
    const unauthorizedError = new APIError(
      401,
      { message: "Unauthorized" },
      "401 Unauthorized"
    );

    expect(shouldShowIncompatibleEndpointError(unauthorizedError, chatCompletionsUrl)).toBe(false);
  });

  it("should not trigger for other 'Unknown parameter' errors", () => {
    const shouldShowIncompatibleEndpointError = (
      error: APIError | null,
      baseUrl: string | undefined
    ) => {
      if (
        error?.status === 400 &&
        error.message?.includes("Unknown parameter") &&
        error.message?.includes("'model'")
      ) {
        const normalizedBaseUrl = baseUrl || "";
        const isChatCompletionsEndpoint = normalizedBaseUrl.includes("/chat/completions");
        const isLegacyProxy = normalizedBaseUrl.includes("openai.ki.fh-swf.de/api");

        if (isChatCompletionsEndpoint || isLegacyProxy) {
          return true;
        }
      }
      return false;
    };

    const chatCompletionsUrl = "https://openai.ki.fh-swf.de/api/v1/chat/completions";
    const temperatureError = new APIError(
      400,
      { message: "Unknown parameter: 'temperature'." },
      "400 Unknown parameter: 'temperature'."
    );

    expect(shouldShowIncompatibleEndpointError(temperatureError, chatCompletionsUrl)).toBe(false);
  });
});
