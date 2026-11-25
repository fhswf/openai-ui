import { describe, it, expect } from "vitest";
import {
  getModelOptions,
  getReplacementForRetiredModel,
  modelOptions,
} from "../options";

describe("modelOptions", () => {
  it("should include gpt-5.6-luna model", () => {
    const gpt56luna = modelOptions.find((opt) => opt.value === "gpt-5.6-luna");
    expect(gpt56luna).toBeDefined();
    expect(gpt56luna?.label).toBe("gpt-5.6-luna");
  });

  it("should have gpt-5.6-luna as the first option", () => {
    expect(modelOptions[0].value).toBe("gpt-6-luna");
  });

  it("should include all expected GPT models", () => {
    const expectedModels = [
      "gpt-6-luna",
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
    ];

    const modelValues = modelOptions.map((opt) => opt.value);

    expectedModels.forEach((model) => {
      expect(modelValues).toContain(model);
    });

    expect(modelOptions.length).toBe(expectedModels.length);
  });
});

describe("getModelOptions", () => {
  it("should sort recommended models by generation when no AI Hub models are configured", () => {
    const options = getModelOptions();
    expect(options.map((opt) => opt.value)).toEqual([
      "gpt-6-luna",
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4-turbo",
      "gpt-4o-mini",
      "gpt-4",
      "gpt-3.5-turbo",
    ]);
    expect(options.every((opt) => opt.group === undefined)).toBe(true);
  });

  it("should append and sort AI Hub models in the combined list", () => {
    const options = getModelOptions({
      aiHubModels: ["gpt-4.1-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"],
    });
    const values = options.map((opt) => opt.value);
    // recommended OpenAI models first, then the provider-prefixed models installed their generation order
    expect(values.indexOf("anthropic/claude-3.5-sonnet")).toBeLessThan(values.indexOf("google/gemini-2.0-flash"));
    expect(values.filter((value) => value === "gpt-4.1-mini")).toHaveLength(1);
  });

  it("should tag group name when multiple providers are present", () => {
    const options = getModelOptions({
      aiHubModels: ["anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash"],
    });
    const groups = options.map((opt) => opt.group);
    expect(groups).toContain("OpenAI");
    expect(groups).toContain("Anthropic");
    expect(groups).toContain("Google");
    // models from the same provider stay adjacent
    expect(options.filter((opt) => opt.group === "Google").length).toBe(1);
    expect(options.filter((opt) => opt.group === "Anthropic").length).toBe(1);
  });

  it("should not tag group name when only one provider is present", () => {
    const options = getModelOptions({
      aiHubModels: ["openai/gpt-4.1-mini"],
    });
    expect(options.every((opt) => opt.group === undefined)).toBe(true);
  });
});

describe("getReplacementForRetiredModel", () => {
  it("returns undefined for models that are not retired", () => {
    expect(getReplacementForRetiredModel("gpt-6-luna")).toBeUndefined();
  });

  it("replaces gpt-5-mini and gpt-5-nano with gpt-6-luna", () => {
    expect(getReplacementForRetiredModel("gpt-5-mini")).toBe("gpt-6-luna");
    expect(getReplacementForRetiredModel("gpt-5-nano")).toBe("gpt-6-luna");
  });

  it("only replaces with models we offer", () => {
    const offered = modelOptions.map((opt) => opt.value);
    for (const retired of ["gpt-5-mini", "gpt-5-nano"]) {
      expect(offered).toContain(getReplacementForRetiredModel(retired));
    }
  });

  it("never offers a retired model in the fixed list", () => {
    for (const option of modelOptions) {
      expect(getReplacementForRetiredModel(option.value)).toBeUndefined();
    }
  });

  it("leaves AI Hub model ids untouched", () => {
    expect(getReplacementForRetiredModel("openai/gpt-5-mini")).toBeUndefined();
  });

  it("ignores inherited object keys", () => {
    expect(getReplacementForRetiredModel("constructor")).toBeUndefined();
  });
});
