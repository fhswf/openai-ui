import { describe, expect, it } from "vitest";
import type { Chat } from "../../context/types";
import {
  chatToPlainText,
  matchesChatQuery,
  messageToPlainText,
} from "../chatSearch";

function makeChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "c1",
    title: "Projektplanung",
    app: 0,
    ct: 0,
    messages: [
      { id: "m1", role: "user", content: "Wie plane ich ein Projekt?" },
      { id: "m2", role: "assistant", content: "Zuerst die Ziele festlegen." },
    ],
    ...overrides,
  };
}

describe("chatSearch", () => {
  it("extracts text from string content", () => {
    expect(
      messageToPlainText({ id: "m", role: "user", content: "hello" })
    ).toBe("hello");
  });

  it("extracts text from array content and keeps attachment names", () => {
    const text = messageToPlainText({
      id: "m",
      role: "user",
      content: [
        { type: "input_text", text: "see attachment" },
        { type: "input_image", name: "diagram.png" },
        { type: "input_file", filename: "report.pdf" },
      ] as unknown as string,
    });
    expect(text).toContain("see attachment");
    expect(text).toContain("diagram.png");
    expect(text).toContain("report.pdf");
  });

  it("matches a query in the title or any message, case-insensitively", () => {
    const chat = makeChat();
    expect(matchesChatQuery(chat, "projektplanung")).toBe(true);
    expect(matchesChatQuery(chat, "ZIELE")).toBe(true);
    expect(matchesChatQuery(chat, "  projekt  ")).toBe(true);
    expect(matchesChatQuery(chat, "unrelated")).toBe(false);
  });

  it("returns every chat for an empty query", () => {
    expect(matchesChatQuery(makeChat(), "")).toBe(true);
    expect(matchesChatQuery(makeChat(), "   ")).toBe(true);
  });

  it("falls back to the local preview for a placeholder chat", () => {
    const chat = makeChat({
      messages: [],
      vault: {
        rev: 1,
        ownerId: "user-1",
        messageCount: 2,
        preview: "Wie plane ich ein Projekt?",
        updatedAt: 0,
      },
    });
    expect(matchesChatQuery(chat, "projekt")).toBe(true);
    expect(matchesChatQuery(chat, "Ziele")).toBe(false);
  });

  it("joins the title and message text for indexing", () => {
    expect(chatToPlainText(makeChat())).toContain("Projektplanung");
    expect(chatToPlainText(makeChat())).toContain("Ziele festlegen");
  });
});
