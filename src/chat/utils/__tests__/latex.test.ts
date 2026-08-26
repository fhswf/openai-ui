import { describe, it, expect } from "vitest";
import { processLaTeX } from "../latex";

describe("processLaTeX", () => {
  it("should convert multi-line block LaTeX (\\[...\\]) to markdown-compatible $$ syntax", () => {
    // Regression test for https://github.com/fhswf/openai-ui/issues/142
    const input = `2023 ist **keine Primzahl**. Es lässt sich zerlegen:

\\[
2023 = 7 \\cdot 289 = 7 \\cdot 17^2
\\]

Da 2023 außer 1 und sich selbst noch die Teiler 7 und 17 besitzt, ist es eine **zusammengesetzte Zahl**.`;

    const result = processLaTeX(input);

    expect(result).toContain(
      "$$\n2023 = 7 \\cdot 289 = 7 \\cdot 17^2\n$$"
    );
    expect(result).not.toContain("\\[");
    expect(result).not.toContain("\\]");
  });

  it("should convert single-line block LaTeX (\\[...\\]) to $$ syntax", () => {
    const input = "Ein Beispiel: \\[ x^2 + y^2 = z^2 \\] fertig.";
    const result = processLaTeX(input);
    expect(result).toBe("Ein Beispiel: $$ x^2 + y^2 = z^2 $$ fertig.");
  });

  it("should convert inline LaTeX (\\(...\\)) to $ syntax", () => {
    const input = "Die Formel \\(a^2 + b^2 = c^2\\) ist bekannt.";
    const result = processLaTeX(input);
    expect(result).toBe("Die Formel $a^2 + b^2 = c^2$ ist bekannt.");
  });

  it("should detect multi-line \\begin{equation}...\\end{equation} blocks", () => {
    const input =
      "Text\n\\begin{equation}\nx = 1\n\\end{equation}\nmore text with \\(y=2\\)";
    const result = processLaTeX(input);
    expect(result).toContain("\\begin{equation}\nx = 1\n\\end{equation}");
    expect(result).toContain("$y=2$");
  });

  it("should leave content without LaTeX unchanged", () => {
    const input = "Einfacher Text **ohne** LaTeX.";
    expect(processLaTeX(input)).toBe(input);
  });

  it("should not convert LaTeX inside code blocks", () => {
    const input = "Code:\n```\n\\[\nnot = latex\n\\]\n```";
    expect(processLaTeX(input)).toBe(input);
  });

  it("should escape dollar signs followed by digits", () => {
    const input = "Das kostet $5 und $10.";
    expect(processLaTeX(input)).toBe("Das kostet \\$5 und \\$10.");
  });
});
