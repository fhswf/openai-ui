import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiHubBaseUrl, fetchAiHubLoginUrl } from "../../service/aiHub";
import {
  navigateAiHubLoginPopup,
  openAiHubLoginPopup,
} from "../aiHubLoginPopup";

vi.mock("../../service/aiHub", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../service/aiHub")>()),
  fetchAiHubLoginUrl: vi.fn(),
}));

function createPopup() {
  return { location: { href: "" }, opener: {} } as unknown as Window;
}

describe("openAiHubLoginPopup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens an empty named popup without access to the chat window", () => {
    const popup = createPopup();
    const openSpy = vi.spyOn(window, "open").mockReturnValue(popup);

    expect(openAiHubLoginPopup()).toBe(popup);
    expect(openSpy).toHaveBeenCalledWith(
      "",
      "ai-hub-login",
      expect.stringContaining("popup")
    );
    expect(popup.opener).toBeNull();
  });

  it("returns null when the browser blocks the popup", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(openAiHubLoginPopup()).toBeNull();
  });
});

describe("navigateAiHubLoginPopup", () => {
  beforeEach(() => {
    vi.mocked(fetchAiHubLoginUrl).mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the popup to the Keycloak login", async () => {
    vi.mocked(fetchAiHubLoginUrl).mockResolvedValue(
      "https://keycloak.example/auth"
    );
    const popup = createPopup();

    await navigateAiHubLoginPopup(popup);

    expect(popup.location.href).toBe("https://keycloak.example/auth");
  });

  it("falls back to the hub start page when the login url fails", async () => {
    vi.mocked(fetchAiHubLoginUrl).mockRejectedValue(new Error("offline"));
    const popup = createPopup();

    await navigateAiHubLoginPopup(popup);

    expect(popup.location.href).toBe(aiHubBaseUrl);
  });
});
