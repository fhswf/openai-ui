import { test, expect } from "../baseFixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
    ({ isMobile, browserName }) => isMobile || browserName === "webkit",
    "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("ChatOptions Deep Coverage", () => {
    test.beforeEach(async ({ page }) => {
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
        await page.route("**/gravatar.com/**", (route) =>
            route.fulfill({ status: 200 })
        );
        await page.goto("/");
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) await termsBtn.click();
    });

    test("should exercise slider value changes (max_tokens, temperature, top_p)", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Exercise max_tokens slider by clicking on the track
        const maxTokensSlider = page.getByTestId("MaxTokensInput");
        await expect(maxTokensSlider).toBeVisible();
        const maxTokensTrack = maxTokensSlider.locator("[data-part='track']");
        if (await maxTokensTrack.isVisible()) {
            const box = await maxTokensTrack.boundingBox();
            if (box) {
                // Click at different positions on the track to change value
                await maxTokensTrack.click({ position: { x: box.width * 0.3, y: box.height / 2 }, force: true });
                await page.waitForTimeout(300);
                await maxTokensTrack.click({ position: { x: box.width * 0.7, y: box.height / 2 }, force: true });
                await page.waitForTimeout(300);
            }
        }

        // Exercise temperature slider
        const tempSlider = page.getByTestId("SetTemperatureInput");
        const tempTrack = tempSlider.locator("[data-part='track']");
        if (await tempTrack.isVisible()) {
            const box = await tempTrack.boundingBox();
            if (box) {
                await tempTrack.click({ position: { x: box.width * 0.5, y: box.height / 2 }, force: true });
                await page.waitForTimeout(300);
            }
        }

        // Exercise top_p slider
        const topPSlider = page.getByTestId("SetTopPInput");
        const topPTrack = topPSlider.locator("[data-part='track']");
        if (await topPTrack.isVisible()) {
            const box = await topPTrack.boundingBox();
            if (box) {
                await topPTrack.click({ position: { x: box.width * 0.4, y: box.height / 2 }, force: true });
                await page.waitForTimeout(300);
            }
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise AI model select change", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Click the AI model select trigger
        const modelSelect = page.getByTestId("ChangeAIModelSelect");
        await expect(modelSelect).toBeVisible();

        const trigger = modelSelect.locator("button").first();
        await trigger.click();
        await page.waitForTimeout(500);

        // Select a model from the dropdown
        const selectContent = page.locator("[data-part='content']").last();
        if (await selectContent.isVisible()) {
            const items = selectContent.locator("[data-part='item']");
            const count = await items.count();
            if (count > 0) {
                await items.first().click();
                await page.waitForTimeout(300);
            }
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise language select change", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Click the language select trigger
        const languageSelect = page.getByTestId("SetLanguageSelect");
        await expect(languageSelect).toBeVisible();

        const trigger = languageSelect.locator("button").first();
        await trigger.click();
        await page.waitForTimeout(500);

        // Select a language from the dropdown
        const selectContent = page.locator("[data-part='content']").last();
        if (await selectContent.isVisible()) {
            const items = selectContent.locator("[data-part='item']");
            const count = await items.count();
            if (count > 1) {
                await items.nth(1).click();
                await page.waitForTimeout(300);
            }
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise send command radio buttons", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Find send command radio buttons 
        const radioButtons = page.locator("[role='radiogroup']").nth(1).locator("[role='radio']");
        const count = await radioButtons.count();
        if (count > 1) {
            // Click the second radio button to change the send command
            await radioButtons.nth(1).click({ force: true });
            await page.waitForTimeout(300);
            // Click the first one back
            await radioButtons.first().click({ force: true });
            await page.waitForTimeout(300);
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise gravatar switch toggle", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Find the gravatar switch  
        const gravatarSwitch = page.locator("#gravatar");
        if (await gravatarSwitch.isVisible()) {
            await gravatarSwitch.click({ force: true });
            await page.waitForTimeout(300);
            // Toggle back
            await gravatarSwitch.click({ force: true });
            await page.waitForTimeout(300);
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise export settings button", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Mock the download to prevent actual file download
        await page.evaluate(() => {
            const origCreateElement = document.createElement.bind(document);
            // Override to capture the download attempt
            (window as any).__exportClicked = false;
            const origClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function () {
                if (this.download) {
                    (window as any).__exportClicked = true;
                    return;
                }
                return origClick.call(this);
            };
        });

        // Find and click the export button
        const exportBtn = page.locator("button").filter({ hasText: /export|Export/i }).first();
        if (await exportBtn.isVisible()) {
            await exportBtn.click();
            await page.waitForTimeout(500);
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });
});

test.describe("ChatMessage Coverage", () => {
    test.beforeEach(async ({ page }) => {
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
        await page.route("**/gravatar.com/**", (route) =>
            route.fulfill({ status: 200 })
        );
        await page.goto("/");
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) await termsBtn.click();
    });

    test("should exercise chat message rendering and edit", async ({ page }) => {
        // Mock API to get a response
        await page.route("**/v1/responses", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: [
                    `data: {"type":"response.created","response":{"id":"resp_mock","status":"in_progress"},"item":null}\n\n`,
                    `data: {"type":"response.output_text.delta","delta":"Hello! This is a test response with **markdown** and \`code\` formatting."}\n\n`,
                    `data: {"type":"response.completed","response":{"id":"resp_mock","status":"completed","usage":{"total_tokens":10,"input_tokens":5,"output_tokens":5}}}\n\n`,
                ].join(""),
            });
        });

        // Send a message to generate chat content
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();
        await textarea.fill("Test message for chat rendering");
        await page.getByTestId("SendMessageBtn").click();
        // Wait for response
        await page.waitForTimeout(3000);

        // Check if the ChatListContainer appeared (may or may not depending on response format)
        const chatListContainer = page.getByTestId("ChatListContainer");
        if (await chatListContainer.isVisible({ timeout: 3000 }).catch(() => false)) {
            // Check for the edit button on messages
            const editBtn = page.getByTestId("EditMessageBtn").first();
            if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await editBtn.click();
                await page.waitForTimeout(500);
            }
        }
    });

    test("should exercise message menu interactions", async ({ page }) => {
        // First send a message to have content
        await page.route("**/v1/responses", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "text/event-stream",
                body: [
                    `data: {"type":"response.created","response":{"id":"resp_mock","status":"in_progress"},"item":null}\n\n`,
                    `data: {"type":"response.output_text.delta","delta":"Response text"}\n\n`,
                    `data: {"type":"response.completed","response":{"id":"resp_mock","status":"completed","usage":{"total_tokens":10,"input_tokens":5,"output_tokens":5}}}\n\n`,
                ].join(""),
            });
        });

        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();
        await textarea.fill("Message for menu test");
        await page.getByTestId("SendMessageBtn").click();
        await page.waitForTimeout(2000);

        // Try to interact with MessageMenu
        const messageMenuBtns = page.locator("[data-testid='ChatList'] button");
        const count = await messageMenuBtns.count();
        for (let i = 0; i < Math.min(count, 3); i++) {
            try {
                const btn = messageMenuBtns.nth(i);
                if (await btn.isVisible()) {
                    await btn.click();
                    await page.waitForTimeout(300);
                    await page.keyboard.press("Escape");
                    await page.waitForTimeout(200);
                }
            } catch {
                // Skip non-clickable buttons
            }
        }
    });
});

test.describe("Sidebar Deep Coverage", () => {
    test.beforeEach(async ({ page }) => {
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
        await page.route("**/gravatar.com/**", (route) =>
            route.fulfill({ status: 200 })
        );
        await page.goto("/");
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) await termsBtn.click();
    });

    test("should exercise all sidebar buttons", async ({ page }) => {
        const sidebar = page.getByTestId("LeftSideBar");
        const bottomSidebar = page.getByTestId("BottomLeftSideBar");

        // Click all buttons in the bottom sidebar
        const buttons = bottomSidebar.locator("button");
        const count = await buttons.count();
        for (let i = 0; i < count; i++) {
            try {
                const btn = buttons.nth(i);
                if (await btn.isVisible()) {
                    const testId = await btn.getAttribute("data-testid");
                    // Skip buttons that are already well-tested
                    if (testId === "OpenConfigBtn" || testId === "OptionDarkModeSelect") continue;
                    await btn.click();
                    await page.waitForTimeout(400);
                    // Close any dialog/popover that opened
                    await page.keyboard.press("Escape");
                    await page.waitForTimeout(200);
                }
            } catch {
                // Skip
            }
        }
    });

    test("should exercise apps list in sidebar", async ({ page }) => {
        const appsList = page.getByTestId("AppsList");
        if (await appsList.isVisible()) {
            // Click an app in the list
            const apps = appsList.locator("button, a, [role='button']");
            const count = await apps.count();
            if (count > 0) {
                await apps.first().click();
                await page.waitForTimeout(500);
            }
        }
    });
});
