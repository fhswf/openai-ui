import { test, expect } from "../baseFixtures";

test.skip(
    ({ isMobile, browserName }) => isMobile || browserName === "webkit",
    "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("Code Coverage Tests", () => {
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

        // Intercept Gravatar to avoid external requests
        await page.route("**/gravatar.com/**", (route) =>
            route.fulfill({ status: 200 })
        );

        // Visit page
        await page.goto("/");

        // Wait for user to be loaded and access granted
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({
            timeout: 10000,
        });

        // Conditionally accept terms
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("should interact with chat settings - Select and Slider components", async ({
        page,
    }) => {
        // Open settings
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();

        // Test sliders - verify they exist and are interactive
        const maxTokensSlider = page.getByTestId("MaxTokensInput");
        await expect(maxTokensSlider).toBeVisible();

        const tempSlider = page.getByTestId("SetTemperatureInput");
        await expect(tempSlider).toBeVisible();

        const topPSlider = page.getByTestId("SetTopPInput");
        await expect(topPSlider).toBeVisible();

        // Close settings
        await page.getByTestId("SettingsCloseBtn").click();
        await expect(page.getByTestId("SettingsHeader")).not.toBeVisible();
    });

    test("should display user avatar and information", async ({ page }) => {
        // Test user information toggle
        await expect(page.getByTestId("UserInformation")).not.toBeVisible();
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).toBeVisible();
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).not.toBeVisible();
    });

    test("should test dark mode toggle", async ({ page }) => {
        const html = page.locator("html");

        // Set to light mode
        await page.evaluate(() =>
            document.documentElement.setAttribute("data-theme", "light")
        );
        await expect(html).toHaveAttribute("data-theme", "light");

        // Toggle to dark
        await page.getByTestId("OptionDarkModeSelect").click();
        await expect(html).toHaveAttribute("data-theme", "dark");

        // Toggle back to light
        await page.getByTestId("OptionDarkModeSelect").click();
        await expect(html).toHaveAttribute("data-theme", "light");
    });

    test("should test settings inputs - API configuration", async ({ page }) => {
        // Open settings
        await page.getByTestId("OpenConfigBtn").click();

        // Test API Base URL input
        const apiUrlInput = page.getByTestId("ApiBaseURLInput");
        await apiUrlInput.clear();
        await expect(apiUrlInput).toHaveValue("");
        await apiUrlInput.fill("https://test.example.com");
        await expect(apiUrlInput).toHaveValue("https://test.example.com");

        // Test API Key input
        const apiKeyInput = page.getByTestId("APIKeyInput");
        await apiKeyInput.clear();
        await expect(apiKeyInput).toHaveValue("");
        await apiKeyInput.fill("test-api-key-123");
        await expect(apiKeyInput).toHaveValue("test-api-key-123");

        // Test Organization ID input
        const orgIdInput = page.getByTestId("APIOrganisationIDInput");
        await orgIdInput.clear();
        await expect(orgIdInput).toHaveValue("");
        await orgIdInput.fill("test-org-id");
        await expect(orgIdInput).toHaveValue("test-org-id");

        // Close settings
        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should test theme selection in settings", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        const html = page.locator("html");

        // Force light to start
        await page.evaluate(() =>
            document.documentElement.setAttribute("data-theme", "light")
        );
        await expect(html).toHaveAttribute("data-theme", "light");

        // Select Dark in settings
        await page.getByTestId("themeSelectdark").click({ force: true });
        await expect(html).toHaveAttribute("data-theme", "dark");

        // Select Light in settings
        await page.getByTestId("themeSelectlight").click({ force: true });
        await expect(html).toHaveAttribute("data-theme", "light");

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should interact with information window", async ({ page }) => {
        await expect(page.getByTestId("InformationWindow")).not.toBeVisible();
        await page.getByTestId("aboutBtn").click();
        await expect(page.getByTestId("InformationWindow")).toBeVisible();
    });

    test("should test header title", async ({ page }) => {
        await expect(page.getByTestId("HeaderTitle")).toContainText("K!mpuls");
    });

    test("should test Select component with language selection", async ({
        page,
    }) => {
        await page.getByTestId("OpenConfigBtn").click();

        // Verify language select is visible
        const languageSelect = page.getByTestId("SetLanguageSelect");
        await expect(languageSelect).toBeVisible();

        await page.getByTestId("SettingsCloseBtn").click();
    });

    test("should test context and navigation", async ({ page }) => {
        // Test navigation through app
        await expect(page).toHaveURL("/");

        // Open and close settings (exercises context)
        await page.getByTestId("OpenConfigBtn").click();
        await expect(page.getByTestId("SettingsHeader")).toBeVisible();
        await page.getByTestId("SettingsCloseBtn").click();

        // Open and close user info (exercises context)
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).toBeVisible();
        await page.getByTestId("UserInformationBtn").click();

        // Verify we're still on the same page
        await expect(page).toHaveURL("/");
    });
});
