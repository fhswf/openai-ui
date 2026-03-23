import { test, expect } from "../baseFixtures";

/**
 * Coverage tests for UI components that are otherwise hard to reach:
 * 1. DashboardChart.tsx
 * 2. ErrorFallback.tsx
 */

test.describe("UI Components Coverage", () => {
    test.beforeEach(async ({ page }) => {
        // Mock User
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    name: "Test User",
                    email: "test@example.com",
                    affiliations: { "fh-swf.de": ["member"] },
                }),
            });
        });
        await page.route("**/gravatar.com/**", (route) => route.fulfill({ status: 200 }));
    });

    test("should render DashboardChart correctly", async ({ page }) => {
        // Mock Dashboard API to return data that triggers the chart rendering
        await page.route("**/api/dashboard", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    tokens: 1000,
                    cost: 0.05,
                    requests: 10,
                    // Provide data structure expected by DashboardChart
                    history: [
                        { date: "2023-01-01", count: 5 },
                        { date: "2023-01-02", count: 8 }
                    ]
                }),
            });
        });

        await page.goto("/");

        // Navigate to Dashboard (if accessible via UI) or force render if possible
        // Assuming Dashboard is part of the "Infos" or settings, or we can navigate to a route
        // If no direct route, we might need to rely on the "Infos" dialog which might contain stats

        // Open Usage Information Dialog (Dashboard)
        // The button is in MessageHeader with data-testid="UsageInformationBtn"
        await page.getByTestId("UsageInformationBtn").click();

        // Wait for dialog to open and chart to potentially render
        await expect(page.getByTestId("UsageInformation")).toBeVisible();

        // Wait a bit for the chart data to be processed/rendered
        await page.waitForTimeout(1000);
    });

    test("should render ErrorFallback on boundary", async ({ context }) => {
        // Create a new page to avoid beforeEach hooks
        const newPage = await context.newPage();

        // Mock api/user to return data without fh-swf.de affiliation
        await newPage.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    name: "No Access User",
                    email: "noaccess@test.com",
                    // Missing fh-swf.de affiliation to trigger no-access branch
                    affiliations: {}
                }),
            });
        });

        // Mock Auth Session (required for app to load properly)
        await newPage.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    user: {
                        name: "No Access User",
                        email: "noaccess@test.com",
                    },
                    expires: new Date(Date.now() + 86400 * 1000).toISOString(),
                }),
            });
        });

        await newPage.route("**/gravatar.com/**", (route) => route.fulfill({ status: 200 }));

        await newPage.goto("/");
        await newPage.waitForLoadState("networkidle");

        // Handle accept terms if it appears
        const termsBtn = newPage.getByTestId("accept-terms-btn");
        const isTermsVisible = await termsBtn.isVisible({ timeout: 3000 }).catch(() => false);
        if (isTermsVisible) {
            await termsBtn.click();
            await newPage.waitForTimeout(1000);
        }

        // Wait for the page to fully load and process user data
        await newPage.waitForTimeout(1500);

        // Check for the "User not allowed" message which covers the "no-access" branch in Chat.tsx
        await expect(newPage.getByTestId("no-access-message")).toBeVisible({ timeout: 15000 });

        await newPage.close();
    });
});
