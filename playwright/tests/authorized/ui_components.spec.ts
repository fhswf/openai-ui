import { test, expect } from "../baseFixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
    ({ isMobile, browserName }) => isMobile || browserName === "webkit",
    "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("UI Components Coverage", () => {
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

    test("should exercise Dialog component via InformationWindow", async ({
        page,
    }) => {
        // Open the about dialog - uses DialogContent, DialogRoot from dialog.tsx
        await page.getByTestId("aboutBtn").click();
        await expect(page.getByTestId("InformationWindow")).toBeVisible();

        // Wait for dialog animations
        await page.waitForTimeout(300);

        // Close dialog by pressing Escape (exercises DialogCloseTrigger / CloseButton)
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);

        // Re-open and close differently
        await page.getByTestId("aboutBtn").click();
        await expect(page.getByTestId("InformationWindow")).toBeVisible();

        // Click outside the dialog to close
        await page.locator("body").click({
            position: { x: 5, y: 5 },
            force: true,
        });
        await page.waitForTimeout(300);
    });

    test("should exercise Settings panel with sliders interaction", async ({
        page,
    }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Interact with MaxTokens slider - click on the slider track
        const maxTokensSlider = page.getByTestId("MaxTokensInput");
        await expect(maxTokensSlider).toBeVisible();
        // Click on the slider track at different positions
        const sliderBox = await maxTokensSlider.boundingBox();
        if (sliderBox) {
            await page.mouse.click(
                sliderBox.x + sliderBox.width * 0.3,
                sliderBox.y + sliderBox.height / 2
            );
            await page.waitForTimeout(200);
            await page.mouse.click(
                sliderBox.x + sliderBox.width * 0.7,
                sliderBox.y + sliderBox.height / 2
            );
        }

        // Interact with Temperature slider
        const tempSlider = page.getByTestId("SetTemperatureInput");
        await expect(tempSlider).toBeVisible();
        const tempBox = await tempSlider.boundingBox();
        if (tempBox) {
            await page.mouse.click(
                tempBox.x + tempBox.width * 0.5,
                tempBox.y + tempBox.height / 2
            );
        }

        // Interact with TopP slider
        const topPSlider = page.getByTestId("SetTopPInput");
        await expect(topPSlider).toBeVisible();
        const topPBox = await topPSlider.boundingBox();
        if (topPBox) {
            await page.mouse.click(
                topPBox.x + topPBox.width * 0.4,
                topPBox.y + topPBox.height / 2
            );
        }

        // Close settings
        await page.getByTestId("SettingsCloseBtn").click();
        await expect(page.getByTestId("SettingsHeader")).not.toBeVisible();
    });

    test("should exercise Settings panel with Select components", async ({
        page,
    }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Click on language select - exercises Select component rendering
        const languageSelect = page.getByTestId("SetLanguageSelect");
        await expect(languageSelect).toBeVisible();

        // Click the trigger to open dropdown
        const trigger = languageSelect.locator("button, [role='combobox']").first();
        if (await trigger.isVisible()) {
            await trigger.click();
            await page.waitForTimeout(300);
            // Press Escape to close
            await page.keyboard.press("Escape");
        }

        // Click on AI model select
        const modelSelect = page.getByTestId("ChangeAIModelSelect");
        await expect(modelSelect).toBeVisible();
        const modelTrigger = modelSelect.locator("button, [role='combobox']").first();
        if (await modelTrigger.isVisible()) {
            await modelTrigger.click();
            await page.waitForTimeout(300);
            await page.keyboard.press("Escape");
        }

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise theme radio cards in settings", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        const html = page.locator("html");

        // Force light mode
        await page.evaluate(() =>
            document.documentElement.setAttribute("data-theme", "light")
        );

        // Select dark theme via radio button
        await page.getByTestId("themeSelectdark").click({ force: true });
        await expect(html).toHaveAttribute("data-theme", "dark");

        // Select light theme
        await page.getByTestId("themeSelectlight").click({ force: true });
        await expect(html).toHaveAttribute("data-theme", "light");

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise UserInformation popover (uses Popover component)", async ({
        page,
    }) => {
        // Open user info popover
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).toBeVisible();

        // Verify user name is displayed (exercises Avatar with getInitials)
        const userInfo = page.getByTestId("UserInformation");
        await expect(userInfo).toContainText("Christian");

        // Close by clicking the button again
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).not.toBeVisible();
    });

    test("should exercise Settings form fields with various inputs", async ({
        page,
    }) => {
        await page.getByTestId("OpenConfigBtn").click();

        // Test API base URL (exercises Field component via Input in Field.Root)
        const apiUrlInput = page.getByTestId("ApiBaseURLInput");
        await apiUrlInput.clear();
        await apiUrlInput.fill("https://custom-api.example.com/v1");
        await expect(apiUrlInput).toHaveValue(
            "https://custom-api.example.com/v1"
        );

        // Test API key input
        const apiKeyInput = page.getByTestId("APIKeyInput");
        await apiKeyInput.clear();
        await apiKeyInput.fill("sk-test-key-12345");
        await expect(apiKeyInput).toHaveValue("sk-test-key-12345");

        // Test Organization ID
        const orgIdInput = page.getByTestId("APIOrganisationIDInput");
        await orgIdInput.clear();
        await orgIdInput.fill("org-test-123");
        await expect(orgIdInput).toHaveValue("org-test-123");

        // Close settings
        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should exercise Settings reset button", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Test Reset button (exercises re-init of all state — also closes settings)
        await page.getByTestId("SettingsRefreshBtn").click();
        await page.waitForTimeout(500);
    });

    test("should exercise window resize event (usePosition)", async ({
        page,
    }) => {
        // Resize the viewport to trigger resize handlers
        await page.setViewportSize({ width: 800, height: 600 });
        await page.waitForTimeout(300);

        await page.setViewportSize({ width: 1200, height: 800 });
        await page.waitForTimeout(300);

        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForTimeout(300);
    });
});
