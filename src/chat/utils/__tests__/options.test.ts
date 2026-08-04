import { describe, it, expect } from "vitest";
import { modelOptions } from "../options";

describe("modelOptions", () => {
  it("should include gpt-5.6-luna model", () => {
    const gpt56luna = modelOptions.find((opt) => opt.value === "gpt-5.6-luna");
    expect(gpt56luna).toBeDefined();
    expect(gpt56luna?.label).toBe("gpt-5.6-luna");
  });

  it("should have gpt-5.6-luna as the first option", () => {
    expect(modelOptions[0].value).toBe("gpt-5.6-luna");
  });

  it("should include all expected GPT models", () => {
    const expectedModels = [
      "gpt-5.6-luna",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5-mini",
      "gpt-5-nano",
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
