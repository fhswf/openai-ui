import { test, expect } from "@playwright/test";

test("migrates chat history to separate localStorage key", async ({ page }) => {
    // 1. Setup old state in localStorage
    const oldState = {
        current: 0,
        chat: [
            {
                title: "Migration Test Chat",
                id: 1,
                ct: Date.now(),
                thread: "",
                botStarts: false,
                messages: [
                    {
                        content: "Hello Migration",
                        sentTime: Math.floor(Date.now() / 1000),
                        role: "user",
                        id: 123,
                    },
                ],
                app: 0,
            },
        ],
        currentChat: 0,
        currentApp: { id: 0, title: "Chat", desc: "", content: "", botStarts: false, category: 0 },
        options: {
            account: { name: "Test", avatar: "", terms: true },
            general: { language: "en", theme: "dark", sendCommand: "Enter", size: "normal", codeEditor: false, gravatar: false },
            openai: { baseUrl: "", apiKey: "", tools: {}, toolsEnabled: [], model: "gpt-4" }
        },
        is: {},
        typeingMessage: {},
        user: {
            affiliations: {
                "fh-swf.de": true
            }
        },
        version: "0.1.0",
    };

    // Enable console logging
    page.on("console", (msg) => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on("pageerror", (err) => console.log(`BROWSER ERROR: ${err}`));

    // Mock user API
    await page.route("**/api/user", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                name: "Test User",
                email: "test@fh-swf.de",
                affiliations: { "fh-swf.de": true },
            }),
        });
    });

    // We need to set localStorage before the app loads fully, or load then set then reload.
    // Since we are in authorized tests, we might already be logged in.
    await page.goto("/");

    await page.evaluate((state) => {
        // We need to handle Map/Set serialization if we use JSON.stringify directly for complex objects
        // But our test data is simple JSON.
        // However, the app uses a custom replacer/reviver.
        // Let's just use simple JSON and hope the app's reviver handles it (it checks for dataType="Map").
        // If we pass plain objects, reviver returns them as is.
        localStorage.setItem("SESSIONS", JSON.stringify(state));
        localStorage.removeItem("CHAT_HISTORY"); // Ensure clean slate
        console.log("Test: Set SESSIONS in localStorage");
    }, oldState);

    // Verify it was set
    const preReloadState = await page.evaluate(() => localStorage.getItem("SESSIONS"));
    console.log("Test: Pre-reload SESSIONS length:", preReloadState?.length);

    // 2. Reload to trigger migration
    await page.reload();

    // Wait for app to load
    await page.waitForLoadState("networkidle");

    // Check HeaderTitle
    try {
        await page.getByTestId("HeaderTitle").textContent({ timeout: 2000 });
    } catch (e) {
        // ignore
    }

    // 3. Verify localStorage split
    // Wait for save to happen (it should be automatic on load)
    await page.waitForTimeout(1000);

    const storage = await page.evaluate(() => {
        return {
            sessions: localStorage.getItem("SESSIONS"),
            chatHistory: localStorage.getItem("CHAT_HISTORY"),
        };
    });

    expect(storage.chatHistory).toBeTruthy();
    const chatHistory = JSON.parse(storage.chatHistory!);
    expect(chatHistory).toHaveLength(1);
    expect(chatHistory[0].title).toBe("Migration Test Chat");

    const sessions = JSON.parse(storage.sessions!);
    expect(sessions.chat).toBeUndefined(); // Should be removed from SESSIONS
    expect(sessions.options.general.theme).toBe("dark");

    // 4. Verify chat is visible
    await expect(page.getByTestId("HeaderTitle")).toHaveText("Migration Test Chat", { timeout: 5000 });
    await expect(page.getByText("Hello Migration")).toBeVisible({ timeout: 5000 });
});
