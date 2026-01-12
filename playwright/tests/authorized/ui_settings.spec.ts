import { test, expect } from "../baseFixtures";

test.skip(({ isMobile, browserName }) => isMobile || browserName === "webkit", "Tests depend on Sidebar visibility and fail on WebKit");

test.describe("User Interface", () => {

    test.beforeEach(async ({ page }) => {
        // Mock user
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    "name": "Christian Gawron",
                    "email": "gawron.christian@fh-swf.de",
                    "sub": "8414053a-25d6-482b-901f-b676d810ebca",
                    "preferred_username": "chgaw002",
                    "affiliations": {
                        "fh-swf.de": ["affiliate", "faculty", "employee", "member"]
                    }
                }),
            });
        });

        // Intercept Gravatar to avoid external requests
        await page.route("**/gravatar.com/**", route => route.fulfill({ status: 200 }));

        // Visit page
        await page.goto("/");

        // Wait for user to be loaded and access granted (SideBar is part of main layout)
        // If this fails, it means specific user mock is not accepted or fetch failed
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });

        // Conditionally accept terms (if not already accepted in storage state)
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("Check the headline", async ({ page }) => {
        await expect(page.getByTestId("HeaderTitle")).toContainText("K!mpuls");
    });

    test("Show infos", async ({ page }) => {
        await expect(page.getByTestId("InformationWindow")).not.toBeVisible();
        await page.getByTestId("aboutBtn").click();
        await expect(page.getByTestId("InformationWindow")).toBeVisible();
    });
});

test.describe("Dark Mode", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                // Using minimal user object
                body: JSON.stringify({
                    "name": "Christian Gawron",
                    "email": "gawron.christian@fh-swf.de",
                    "sub": "8414053a-25d6-482b-901f-b676d810ebca",
                    "preferred_username": "chgaw002",
                    "affiliations": {
                        "fh-swf.de": ["affiliate", "faculty", "employee", "member"]
                    }
                }),
            });
        });
        // Visit page
        await page.goto("/");
        // Wait for user to be loaded
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });

        // Conditionally accept terms
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("Down Left Button (Theme toggle)", async ({ page }) => {
        const html = page.locator("html");

        // Force light to start to match Cypress assumption
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
        await expect(html).toHaveAttribute("data-theme", "light");

        await page.getByTestId("OptionDarkModeSelect").click();
        await expect(html).toHaveAttribute("data-theme", "dark");

        await page.getByTestId("OptionDarkModeSelect").click();
        await expect(html).toHaveAttribute("data-theme", "light");
    });

    test("In Settings", async ({ page }) => {
        await page.getByTestId("OpenConfigBtn").click();
        const html = page.locator("html");

        // Force light to start
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
        await expect(html).toHaveAttribute("data-theme", "light");

        // Select Dark in settings (Radio Group)
        await page.getByTestId("themeSelectdark").click({ force: true });
        await expect(html).toHaveAttribute("data-theme", "dark");

        // Select Light in settings
        await page.getByTestId("themeSelectlight").click({ force: true });
        await expect(html).toHaveAttribute("data-theme", "light");
    });
});

test.describe("User Information", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    "name": "Christian Gawron",
                    "email": "gawron.christian@fh-swf.de",
                    "sub": "8414053a-25d6-482b-901f-b676d810ebca",
                    "preferred_username": "chgaw002",
                    "affiliations": {
                        "fh-swf.de": ["affiliate", "faculty", "employee", "member"]
                    }
                }),
            });
        });
        await page.goto("/");
        // Wait for user to be loaded
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });

        // Conditionally accept terms
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }
    });

    test("Open and close user information", async ({ page }) => {
        await expect(page.getByTestId("UserInformation")).not.toBeVisible();
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).toBeVisible();
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).not.toBeVisible();
    });
});


test.describe("Config Menu", () => {
    test.beforeEach(async ({ page }) => {
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                body: JSON.stringify({
                    "name": "Christian Gawron",
                    "email": "gawron.christian@fh-swf.de",
                    "sub": "8414053a-25d6-482b-901f-b676d810ebca",
                    "preferred_username": "chgaw002",
                    "affiliations": {
                        "fh-swf.de": ["affiliate", "faculty", "employee", "member"]
                    }
                }),
            });
        });
        // Visit page
        await page.goto("/");
        // Wait for user to be loaded
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({ timeout: 10000 });

        // Conditionally accept terms
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) {
            await termsBtn.click();
        }

        await page.getByTestId("OpenConfigBtn").click();
    });

    test("Set api base url input", async ({ page }) => {
        const input = page.getByTestId("ApiBaseURLInput");
        await input.clear();
        await expect(input).toHaveValue("");
        await input.fill("a_playwright_input_test");
        await expect(input).toHaveValue("a_playwright_input_test");
    });

    test("Set api key input", async ({ page }) => {
        const input = page.getByTestId("APIKeyInput");
        await input.clear();
        await expect(input).toHaveValue("");
        await input.fill("a_playwright_input_test");
        await expect(input).toHaveValue("a_playwright_input_test");
    });

    test("Set organisation id input", async ({ page }) => {
        const input = page.getByTestId("APIOrganisationIDInput");
        await input.clear();
        await expect(input).toHaveValue("");
        await input.fill("a_playwright_id_test");
        await expect(input).toHaveValue("a_playwright_id_test");
    });

    test("Close the settings", async ({ page }) => {
        await page.getByTestId("SettingsCloseBtn").click();
        // Verifying Settings is closed. 
        await expect(page.getByTestId("SettingsHeader")).not.toBeVisible();
    });

});
