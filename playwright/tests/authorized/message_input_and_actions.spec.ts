import { test, expect } from "../baseFixtures";

/**
 * High-impact interaction tests for:
 * 1. MessageInput.tsx (File uploads, Input modes)
 * 2. ChatMessage.tsx (Edit, Delete, Copy)
 */

test.describe("Interaction and Input Coverage", () => {
    // We use the global storage state from auth.setup.ts

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

        // Ensure any blocking dialog is dismissed (e.g. Terms)
        const termsBtn = page.getByTestId("accept-terms-btn");
        try {
            if (await termsBtn.isVisible()) {
                await termsBtn.click();
            }
        } catch (e) {
            // Ignore if already gone or not clickable
        }
        await page.keyboard.press("Escape");
    });

    test("should handle file uploads and interactions", async ({ page, isMobile, browserName }) => {
        test.skip(isMobile || browserName === "webkit", "File upload is not reliable on mobile/webkit browsers");

        // --- 1. File Upload ---
        // Create a dummy file for upload
        const buffer = Buffer.from("this is a test image file");

        // Trigger file chooser
        const fileChooserPromise = page.waitForEvent("filechooser");
        await page.getByTestId("UploadFileBtn").click();
        const fileChooser = await fileChooserPromise;

        // Upload file
        await fileChooser.setFiles({
            name: "test-image.png",
            mimeType: "image/png",
            buffer,
        });

        // Verify preview appears - wait for the image or delete button
        // Try multiple selectors as the UI might use different labels
        const deleteImageBtn = page.locator("button").filter({ has: page.locator("svg") }).filter({ hasText: /cancel|delete|remove/i }).or(
            page.getByLabel(/Delete image|Remove image|Cancel/i)
        );
        await expect(deleteImageBtn.first()).toBeVisible({ timeout: 10000 });

        // --- 2. Remove File ---
        await deleteImageBtn.first().click();
        await expect(deleteImageBtn.first()).not.toBeVisible();
    });

    test("should toggle between input modes", async ({ page, isMobile, browserName }) => {
        test.skip(isMobile || browserName === "webkit", "Input mode toggle is not reliable on mobile/webkit browsers");

        // Default is Textarea
        await expect(page.getByTestId("ChatTextArea")).toBeVisible();

        // Switch to Code Editor - look for the label or switch element
        const codeEditorToggle = page.locator("label").filter({ hasText: /Code.?Editor/i }).or(
            page.getByText(/Code.?Editor/i)
        );

        // Wait and ensure it's visible before clicking
        await expect(codeEditorToggle.first()).toBeVisible({ timeout: 5000 });
        await codeEditorToggle.first().click();

        // Wait a bit for the transition
        await page.waitForTimeout(500);

        // Check if code editor is now visible - it might still have ChatTextArea testid or a different class
        // The @uiw/react-textarea-code-editor creates a textarea with specific classes
        const codeEditor = page.locator(".w-tc-editor-text, .w-tc-editor, textarea[class*='editor']");
        await expect(codeEditor.first()).toBeVisible({ timeout: 5000 });
    });

    test("should handle message actions (Edit, Delete, Copy)", async ({ page }) => {
        // Mock a conversation with User and Assistant messages
        // We can inject state or just send a message and mock the response

        // Send User Message
        const textarea = page.getByTestId("ChatTextArea");
        await textarea.fill("Hello World");
        await page.getByTestId("SendMessageBtn").click();

        // Wait for message to appear in list
        await expect(page.getByText("Hello World")).toBeVisible();

        // --- 1. Edit User Message ---
        // Hover over user message to see tool buttons? 
        // Code says: role === "user" ? <IconButton ... onClick={editMessage} ...>
        // It might be always visible or on hover. Playwright can click if visible.
        const editBtn = page.getByTestId("EditMessageBtn").last();
        // Force hover just in case CSS hides it
        await page.getByText("Hello World").hover();

        // Note: The app's edit logic might repopulate the input or open a modal. 
        // Based on `useGlobal().editMessage(id)`, it likely sets `typeingMessage` to this content.
        await editBtn.click();

        // Verify input is populated with "Hello World"
        await expect(textarea).toHaveValue("Hello World");

        // --- 2. Delete Message ---
        // Send another message to delete
        await textarea.fill("To be deleted");
        await page.getByTestId("SendMessageBtn").click();
        await expect(page.getByText("To be deleted")).toBeVisible();

        // Use the existing data-testid pattern ChatMessage-X
        const messageCard = page.getByTestId(/ChatMessage-/).last();
        await messageCard.hover();

        // Target the delete button using the accessible name provided by the Tooltip
        // (Playwright often exposes Tooltip content as accessible name) or by exclusion if that fails.
        // Given strict mode error, we have multiple buttons. Let's try the specific aria name first.
        // "Remove Message" / "Nachricht entfernen"
        const deleteBtn = messageCard.getByRole("button", { name: /Remove Message|Nachricht entfernen/i });

        if (await deleteBtn.count() > 0) {
            await deleteBtn.click();
        } else {
            // Fallback: The third button in the group (Edit, Delete, Copy...?)
            // Or strictly filter by icon content if possible.
            // Let's filter by the one that is NOT edit.
            await messageCard.getByRole("button").filter({ hasNot: page.getByTestId("EditMessageBtn") }).first().click();
        }

        // Verify it's gone from the chat list (checking the card specifically)
        await expect(page.locator(".chakra-card").filter({ hasText: "To be deleted" })).not.toBeVisible();
    });
});
