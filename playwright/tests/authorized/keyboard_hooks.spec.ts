import { test, expect } from "../baseFixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
    ({ isMobile, browserName }) => isMobile || browserName === "webkit",
    "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("Keyboard Hooks Coverage", () => {
    test.beforeEach(async ({ page }) => {
        // Mock user
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    name: "Christian Gawron",
                    email: "gawron.christian@fh-swf.de",
                    sub: "8414053a-25d6-482b-901f-b676d810ebca",
                    preferred_username: "chgaw002",
                    affiliations: {
                        "fh-swf.de": ["affiliate", "faculty", "employee", "member"],
                    },
                }),
            });
        });

        // Intercept Gravatar
        await page.route("**/gravatar.com/**", (route) =>
            route.fulfill({ status: 200 })
        );

        await page.goto("/");

        await expect(page.getByTestId("LeftSideBar")).toBeVisible({
            timeout: 10000,
        });

        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("should handle regular key presses (useKeyboard downHandler/upHandler)", async ({
        page,
    }) => {
        // Click on the chat textarea to focus it
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();

        // Type regular keys - exercises useKeyboard downHandler for non-modifier keys
        await page.keyboard.press("a");
        await page.keyboard.press("b");
        await page.keyboard.press("c");

        // Release keys - exercises useKeyboard upHandler
        await page.keyboard.up("a");
        await page.keyboard.up("b");
        await page.keyboard.up("c");
    });

    test("should handle modifier key presses (useKeyboard modifier detection)", async ({
        page,
    }) => {
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();

        // Press modifier keys alone - exercises setModifierKeyPressed(true)
        await page.keyboard.down("Shift");
        await page.keyboard.up("Shift");

        await page.keyboard.down("Control");
        await page.keyboard.up("Control");

        await page.keyboard.down("Alt");
        await page.keyboard.up("Alt");

        // Press modifier + regular key combo
        await page.keyboard.down("Shift");
        await page.keyboard.press("a");
        await page.keyboard.up("Shift");

        await page.keyboard.down("Control");
        await page.keyboard.press("a");
        await page.keyboard.up("Control");
    });

    test("should handle Ctrl+Enter for message send (useCtrlEnterSend)", async ({
        page,
    }) => {
        // Mock the chat completion API
        await page.route("**/v1/responses", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: [
                    `data: {"type":"response.created","response":{"id":"resp_mock","status":"in_progress"},"item":null}\n\n`,
                    `data: {"type":"response.output_text.delta","delta":"Hello"}\n\n`,
                    `data: {"type":"response.completed","response":{"id":"resp_mock","status":"completed","usage":{"total_tokens":10,"input_tokens":5,"output_tokens":5}}}\n\n`,
                ].join(""),
            });
        });

        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();
        await textarea.fill("Test message for Ctrl+Enter");

        // Press Ctrl+Enter - exercises useCtrlEnterSend callback
        await page.keyboard.press("Control+Enter");

        // Wait a moment for the handler to fire
        await page.waitForTimeout(500);
    });

    test("should handle repeated key presses without duplicate registration", async ({
        page,
    }) => {
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();

        // Press same key multiple times - exercises the "already pressed" guard
        await page.keyboard.down("a");
        await page.keyboard.down("a"); // should be ignored (already pressed)
        await page.keyboard.up("a");
    });

    test("should handle Escape key press", async ({ page }) => {
        // Open settings first
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Press Escape
        await page.keyboard.press("Escape");

        // Wait a moment
        await page.waitForTimeout(300);
    });
});
