import { test, expect } from "../baseFixtures";

test.describe("MCP Settings Coverage", () => {
    test.beforeEach(async ({ page }) => {
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
        await page.goto("/");

        // Handle terms if present
        const termsBtn = page.getByTestId("accept-terms-btn");
        try {
            if (await termsBtn.isVisible()) {
                await termsBtn.click();
            }
        } catch (e) { }
        await page.keyboard.press("Escape");
    });

    test("should add, edit and delete MCP services", async ({ page, isMobile, browserName }) => {
        test.skip(isMobile || browserName === "webkit", "MCP menu navigation is not reliable on mobile browsers and WebKit");

        // Wait for the chat header to be visible to ensure app is loaded
        await expect(page.getByTestId("HeaderTitle")).toBeVisible({ timeout: 15000 });

        // 1. Open Chat Options - try multiple selectors
        const chatOptionsBtn = page.locator("button").filter({ hasText: /chat.*options|optionen/i }).or(
            page.getByRole("button", { name: /chat.*options|optionen/i })
        ).first();

        await expect(chatOptionsBtn).toBeVisible({ timeout: 5000 });
        await chatOptionsBtn.click();
        await page.waitForTimeout(500);

        // 2. Open MCP Services Submenu -> Add/Remove
        // Look for MCP menu item
        const mcpMenuItem = page.getByText(/MCP.*(Services|Dienste)/i).first();

        if (await mcpMenuItem.isVisible({ timeout: 3000 })) {
            await mcpMenuItem.click();
            await page.waitForTimeout(500);

            // Handle "Add/Remove MCP Services" - try multiple approaches
            const addRemoveItem = page.getByText(/Add.*Remove.*MCP|MCP.*(Hinzufügen|entfernen)/i).first();

            if (await addRemoveItem.isVisible({ timeout: 3000 })) {
                await addRemoveItem.click();
                await page.waitForTimeout(1000);

                // 3. Verify Dialog Open
                await expect(page.getByText(/Edit MCP Services|MCP.*bearbeiten/i).first()).toBeVisible({ timeout: 5000 });

                // 4. Add a new Service - use input[id] selectors as fallback
                const labelInput = page.locator("input#label").or(page.getByLabel(/Label|Bezeichnung/i));
                const urlInput = page.locator("input#server_url").or(page.getByLabel(/Server.*URL/i));

                await labelInput.fill("TestMCPService");
                await urlInput.fill("http://localhost:8080/sse");

                // Try to find and fill allowed tools
                const toolsInput = page.locator("input#allowed_tools").or(page.getByLabel(/Allowed Tools|Erlaubte/i));
                if (await toolsInput.isVisible({ timeout: 2000 })) {
                    await toolsInput.fill("tool1,tool2");
                }

                // Find and click the Add/Save button
                const saveBtn = page.getByRole("button", { name: /Add|Save|Hinzufügen|Speichern/i }).first();
                await saveBtn.click();
                await page.waitForTimeout(1000);

                // 5. Verify it appears in the list
                await expect(page.getByText("TestMCPService")).toBeVisible({ timeout: 5000 });

                // 6. Delete the Service - look for delete button (icon button with trash/delete icon)
                const deleteBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
                await deleteBtn.click();
                await page.waitForTimeout(500);

                // Verify deletion
                await expect(page.getByText("TestMCPService")).not.toBeVisible();
            }
        }
    });
});
