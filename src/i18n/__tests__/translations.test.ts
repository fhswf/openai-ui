import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import i18n from "../config";

const sourceRoot = path.resolve(process.cwd(), "src");
const translationNamespace = "translation";
const locales = Object.keys(i18n.options.resources ?? {});
const nonEnglishLocales = locales.filter((locale) => locale !== "en");

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : listSourceFiles(filePath);
    }

    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) return [];
    return [filePath];
  });
}

function scriptKindFor(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function isTranslationCall(node: ts.Node): node is ts.CallExpression {
  if (!ts.isCallExpression(node)) return false;

  const expression = node.expression;
  if (ts.isIdentifier(expression)) return expression.text === "t";

  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "t" &&
    ts.isIdentifier(expression.expression) &&
    ["i18n", "i18next"].includes(expression.expression.text)
  );
}

function findLiteralTranslationKeys(): Set<string> {
  const keys = new Set<string>();

  for (const filePath of listSourceFiles(sourceRoot)) {
    const sourceFile = ts.createSourceFile(
      filePath,
      readFileSync(filePath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(filePath)
    );

    function visit(node: ts.Node) {
      if (isTranslationCall(node)) {
        const argument = node.arguments[0];
        if (
          argument &&
          (ts.isStringLiteral(argument) ||
            ts.isNoSubstitutionTemplateLiteral(argument))
        ) {
          keys.add(argument.text);
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return keys;
}

function flattenResourceKeys(
  resource: Record<string, unknown>,
  prefix = ""
): string[] {
  return Object.entries(resource).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") {
      return flattenResourceKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

function hasTranslation(locale: string, key: string): boolean {
  const directValue = i18n.getResource(locale, translationNamespace, key);
  if (typeof directValue === "string" && directValue.length > 0) return true;

  // Plural keys such as `count_messages` are stored as locale-specific forms.
    const pluralCategories =
      new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
  return pluralCategories.every((category) => {
    const pluralValue = i18n.getResource(
      locale,
      translationNamespace,
      `${key}_${category}`
    );
    return typeof pluralValue === "string" && pluralValue.length > 0;
  });
}

describe("i18n translations", () => {
  it("includes every English resource key in each non-English locale", () => {
    const englishResource = i18n.getResourceBundle("en", translationNamespace);
    const englishKeys = flattenResourceKeys(
      englishResource as Record<string, unknown>
    );
    const missing = nonEnglishLocales.flatMap((locale) =>
      englishKeys
        .filter((key) => !hasTranslation(locale, key))
        .map((key) => `${locale}: ${key}`)
    );

    expect(missing).toEqual([]);
  });

  it("translates every literal key used by the application", () => {
    const sourceKeys = findLiteralTranslationKeys();
    const missing = nonEnglishLocales.flatMap((locale) =>
      [...sourceKeys]
        .filter((key) => !hasTranslation(locale, key))
        .map((key) => `${locale}: ${key}`)
    );

    expect(missing).toEqual([]);
  });
});
