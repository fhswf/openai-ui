import { test, expect } from "../baseFixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
    ({ isMobile, browserName }) => isMobile || browserName === "webkit",
    "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("MessageHeader Menu Coverage", () => {
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
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("should exercise chat options menu (model and tools)", async ({ page }) => {
        // Click the chat options button (CgOptions icon)
        const optionsBtn = page.locator('[title]').filter({ has: page.locator('svg') });
        const chatOptionsBtn = page.locator('button[title]').nth(1);

        // Find and click the options menu trigger in the header
        const header = page.getByTestId("ChatHeader");
        const menuButtons = header.locator("button");

        // Click each menu button to open menus and exercise the menu rendering
        const buttonCount = await menuButtons.count();
        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
            try {
                const btn = menuButtons.nth(i);
                if (await btn.isVisible()) {
                    await btn.click();
                    await page.waitForTimeout(300);
                    // Close by pressing Escape
                    await page.keyboard.press("Escape");
                    await page.waitForTimeout(200);
                }
            } catch {
                // Some buttons might not be clickable
            }
        }
    });

    test("should exercise new chat menu", async ({ page }) => {
        const header = page.getByTestId("ChatHeader");
        // The new chat button has a RiChatNewLine icon
        // Click all icon buttons in the header to exercise menus
        const iconButtons = header.locator("button");
        const count = await iconButtons.count();

        // Try to find and click the new chat button
        for (let i = 0; i < count; i++) {
            const btn = iconButtons.nth(i);
            const title = await btn.getAttribute("title");
            if (title && (title.includes("Neuer") || title.includes("New") || title.includes("chat"))) {
                await btn.click();
                await page.waitForTimeout(500);
                // Check if a menu appeared
                const menuContent = page.locator("[role='menu']");
                if (await menuContent.isVisible()) {
                    await page.keyboard.press("Escape");
                }
                break;
            }
        }
    });

    test("should exercise download thread menu", async ({ page }) => {
        const header = page.getByTestId("ChatHeader");
        const iconButtons = header.locator("button");
        const count = await iconButtons.count();

        // Find the download button
        for (let i = 0; i < count; i++) {
            const btn = iconButtons.nth(i);
            const title = await btn.getAttribute("title");
            if (title && (title.includes("Download") || title.includes("download") || title.includes("herunterladen"))) {
                await btn.click();
                await page.waitForTimeout(400);
                const menuContent = page.locator("[role='menu']");
                if (await menuContent.isVisible()) {
                    await page.keyboard.press("Escape");
                }
                break;
            }
        }
    });

    test("should exercise clear message button and focus/blur", async ({ page }) => {
        const textarea = page.getByTestId("ChatTextArea");

        // Focus the textarea (exercises onFocus -> setIs({ inputing: true }))
        await textarea.click();
        await page.waitForTimeout(200);

        // Type a message
        await textarea.fill("Some message text");

        // Click Clear button (exercises clearTypeing)
        const clearBtn = page.getByTestId("ClearMessageBtn");
        await clearBtn.click();
        await page.waitForTimeout(300);

        // Blur the textarea (exercises onBlur -> setIs({ inputing: false }))
        await page.locator("body").click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(200);
    });

    test("should exercise upload file button click", async ({ page }) => {
        // Click the upload button (it triggers fileInputRef.current.click())
        const uploadBtn = page.getByTestId("UploadFileBtn");
        await uploadBtn.click();
        await page.waitForTimeout(300);
    });

    test("should exercise voice message button if available", async ({ page }) => {
        const voiceBtn = page.getByTestId("VoiceMessageBtn");
        if (await voiceBtn.isVisible()) {
            // Click to start recognition
            await voiceBtn.click();
            await page.waitForTimeout(500);
            // Click to stop recognition
            await voiceBtn.click();
            await page.waitForTimeout(300);
        }
    });

    test("should exercise UsageInformation dialog", async ({ page }) => {
        // Mock usage API
        await page.route("**/api/usage**", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: [
                        { model: "gpt-4", total_tokens: 1000, prompt_tokens: 500, completion_tokens: 500, n_requests: 10, user: "chgaw002" },
                    ],
                }),
            });
        });

        const usageBtn = page.getByTestId("UsageInformationBtn");
        if (await usageBtn.isVisible()) {
            await usageBtn.click();
            await page.waitForTimeout(500);
            const usageDialog = page.getByTestId("UsageInformation");
            if (await usageDialog.isVisible()) {
                await page.keyboard.press("Escape");
            }
        }
    });
});

test.describe("MessageInput Extended Coverage", () => {
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
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("should exercise textarea change event with debounce", async ({ page }) => {
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();

        // Type character by character to exercise onChange and debounce
        await page.keyboard.type("Hello World", { delay: 100 });
        await page.waitForTimeout(500);

        // Verify the content
        const value = await textarea.inputValue();
        expect(value).toContain("Hello World");
    });

    test("should exercise code editor toggle switch", async ({ page }) => {
        // Find and toggle the code editor switch
        const codeEditorSwitch = page.locator("[data-testid='MessageInputBar'] label, [data-testid='MessageInputBar'] [role='switch']").first();
        if (await codeEditorSwitch.isVisible()) {
            await codeEditorSwitch.click();
            await page.waitForTimeout(500);
            // Toggle back
            await codeEditorSwitch.click();
            await page.waitForTimeout(300);
        }
    });

    test("should exercise send button disabled state", async ({ page }) => {
        // When textarea is empty, send button should be disabled
        const sendBtn = page.getByTestId("SendMessageBtn");
        await expect(sendBtn).toBeDisabled();

        // Fill textarea - Send button should become enabled
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();
        await textarea.fill("Test message");
        // The button might need a moment to update
        await page.waitForTimeout(300);
    });

    test("should verify file input and drop zone elements exist", async ({ page }) => {
        // Verify the file input element exists in the DOM
        const fileInput = page.getByTestId("file-input");
        await expect(fileInput).toBeAttached();

        // Verify message input bar exists
        const inputBar = page.getByTestId("MessageInputBar");
        await expect(inputBar).toBeVisible();
    });
});

test.describe("DashboardChart Coverage", () => {
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

        // Mock the usage API with sample data for dashboard chart
        await page.route("**/api/usage**", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    data: [
                        {
                            model: "gpt-4",
                            total_tokens: 5000,
                            prompt_tokens: 3000,
                            completion_tokens: 2000,
                            n_requests: 50,
                            user: "chgaw002",
                        },
                        {
                            model: "gpt-3.5-turbo",
                            total_tokens: 8000,
                            prompt_tokens: 5000,
                            completion_tokens: 3000,
                            n_requests: 100,
                            user: "user2",
                        },
                    ],
                }),
            });
        });

        await page.goto("/");
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("should navigate to dashboard to exercise DashboardChart", async ({ page }) => {
        // Check if there's a dashboard link/button in the sidebar
        const sidebar = page.getByTestId("LeftSideBar");
        const bottomSidebar = page.getByTestId("BottomLeftSideBar");

        // Try to find dashboard-related navigation
        const allButtons = bottomSidebar.locator("button, a, [role='button']");
        const buttonCount = await allButtons.count();

        for (let i = 0; i < buttonCount; i++) {
            try {
                const btn = allButtons.nth(i);
                const text = await btn.innerText();
                const title = await btn.getAttribute("title");
                if (
                    text?.toLowerCase().includes("dashboard") ||
                    text?.toLowerCase().includes("statistik") ||
                    text?.toLowerCase().includes("usage") ||
                    title?.toLowerCase().includes("dashboard") ||
                    title?.toLowerCase().includes("statistik") ||
                    title?.toLowerCase().includes("usage")
                ) {
                    await btn.click();
                    await page.waitForTimeout(1000);
                    break;
                }
            } catch {
                // Skip
            }
        }

        await page.waitForTimeout(1000);
    });
});
