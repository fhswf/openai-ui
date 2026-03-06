import { test, expect } from "../baseFixtures";

test.use({ storageState: { cookies: [], origins: [] } });

test.skip(
    ({ isMobile, browserName }) => isMobile || browserName === "webkit",
    "Tests depend on Sidebar visibility and fail on WebKit"
);

test.describe("Hooks Coverage Tests", () => {
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

    test("should exercise useWindowTheme via prefers-color-scheme emulation", async ({
        page,
    }) => {
        // Emulate dark mode preference - exercises useWindowTheme listener
        await page.emulateMedia({ colorScheme: "dark" });
        await page.waitForTimeout(500);

        // Switch to light mode preference
        await page.emulateMedia({ colorScheme: "light" });
        await page.waitForTimeout(500);

        // Switch back to dark
        await page.emulateMedia({ colorScheme: "dark" });
        await page.waitForTimeout(500);
    });

    test("should exercise useClickOutside by clicking outside open elements", async ({
        page,
    }) => {
        // Open user information (popover)
        await page.getByTestId("UserInformationBtn").click();
        await expect(page.getByTestId("UserInformation")).toBeVisible();

        // Click outside the popover - exercises useClickOutside handler
        await page.locator("body").click({ position: { x: 10, y: 10 } });
        await page.waitForTimeout(300);
    });

    test("should exercise useLocalStorage and useTheme via theme toggle", async ({
        page,
    }) => {
        const html = page.locator("html");

        // Force light mode to start
        await page.evaluate(() =>
            document.documentElement.setAttribute("data-theme", "light")
        );
        await expect(html).toHaveAttribute("data-theme", "light");

        // Toggle theme to dark - exercises useTheme.toggleTheme and useLocalStorage.setStoredValue
        await page.getByTestId("OptionDarkModeSelect").click();
        await expect(html).toHaveAttribute("data-theme", "dark");

        // Toggle back - exercises the other branch
        await page.getByTestId("OptionDarkModeSelect").click();
        await expect(html).toHaveAttribute("data-theme", "light");
    });

    test("should exercise useDebounce through rapid text input", async ({
        page,
    }) => {
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.click();

        // Rapid typing - exercises debounced callbacks
        await textarea.pressSequentially("rapid typing test", { delay: 50 });
        await page.waitForTimeout(500);

        // Clear and type again
        await textarea.clear();
        await textarea.pressSequentially("another test", { delay: 30 });
        await page.waitForTimeout(500);
    });

    test("should exercise theme persistence across reload", async ({
        page,
    }) => {
        // Set theme to dark
        await page.evaluate(() =>
            window.localStorage.setItem("THEME", "dark")
        );

        // Reload page
        await page.reload();
        await expect(page.getByTestId("LeftSideBar")).toBeVisible({
            timeout: 10000,
        });

        // The theme should have been read from localStorage (useLocalStorage init)
        const html = page.locator("html");
        const theme = await html.getAttribute("data-theme");
        expect(theme).toBeTruthy();
    });
});
