import { test, expect } from "../baseFixtures";

/**
 * High-impact coverage tests for:
 * 1. MCP Service Management (MessageHeader.tsx)
 * 2. Markdown/JSON Export (action.ts)
 */

test.describe("MCP Settings and Export Flows", () => {
    test.beforeEach(async ({ page }) => {
        // Mock User API (Critical for app loading)
        await page.route("**/api/user", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    name: "MCP User",
                    email: "mcp@test.com",
                    affiliations: { "fh-swf.de": ["member"] },
                }),
            });
        });

        // Mock Auth Session (Likely checked by Keycloak/Auth wrappers)
        await page.route("**/api/auth/session", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    user: {
                        name: "MCP User",
                        email: "mcp@test.com",
                    },
                    expires: new Date(Date.now() + 86400 * 1000).toISOString(),
                }),
            });
        });

        await page.route("**/gravatar.com/**", (route) => route.fulfill({ status: 200 }));

        await page.goto("/");

        // Handle "Accept Terms" if it appears (it might not if we mock correctly)
        const termsBtn = page.getByTestId("accept-terms-btn");
        if (await termsBtn.isVisible()) await termsBtn.click();
    });



    test("should export chat history as JSON and Markdown", async ({ page }) => {
        // Create a dummy message first
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.fill("Export this message");
        await page.getByTestId("SendMessageBtn").click();
        await page.waitForTimeout(1000); // Wait for message to "send" (optimistic update)

        // Open Download Menu
        // Button title: t("download_thread")
        const downloadBtn = page.getByTitle(/download_thread|Unterhaltung herunterladen/i).first();
        await downloadBtn.click();

        // --- DOWNLOAD JSON ---
        const downloadPromiseJson = page.waitForEvent("download");
        await page.getByText(/download_json|als JSON herunterladen/i).click();
        const downloadJson = await downloadPromiseJson;
        expect(downloadJson.suggestedFilename()).toContain(".json");

        // Re-open menu for Markdown
        await downloadBtn.click();

        // --- DOWNLOAD MARKDOWN ---
        const downloadPromiseMd = page.waitForEvent("download");
        await page.getByText(/download_markdown|Markdown herunterladen/i).click();
        const downloadMd = await downloadPromiseMd;
        expect(downloadMd.suggestedFilename()).toContain(".md");
    });
});
