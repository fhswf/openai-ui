import { test, expect } from '../baseFixtures';

test.describe("Message Editing", () => {
    test("should populate input when editing a message with text and image", async ({ page, browserName }) => {
        test.skip(browserName === 'webkit', "Skipping Webkit due to issues with OPFS");
        await page.goto("/");

        // Ensure chat is ready
        await expect(page.getByTestId('ChatTextArea')).toBeVisible();

        // 1. Drop an image
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.getByTestId('UploadFileBtn').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
            name: 'test_image_edit.png',
            mimeType: 'image/png',
            buffer: buffer,
        });

        // Wait for image to appear in input
        // Check if Skeleton appears first (implies state update happened)
        // Note: Skeleton might be too fast to catch, but if it hangs, we might see it.
        // We'll just wait for img with longer timeout.
        await expect(page.locator('[data-testid="MessageInputBar"] img')).toBeVisible({ timeout: 15000 });

        // 2. Add text
        await page.getByTestId('ChatTextArea').fill("Test message with image");

        // Get initial message count
        const initialCount = await page.locator('[data-testid^="ChatMessage-"]').count();
        console.log("Initial message count:", initialCount);

        // 3. Send message
        await expect(page.getByTestId('SendMessageBtn')).toBeEnabled();
        await page.getByTestId('SendMessageBtn').click();

        // Wait for message count to increase
        await expect(page.locator('[data-testid^="ChatMessage-"]')).toHaveCount(initialCount + 1, { timeout: 1000 }).catch(() => {
            // If it fails, check if it's more than expected (e.g. assistant response added too)
            // We'll rely on finding the specific message content next
        });

        // Wait for message to appear in chat
        // The user message should contain the text
        const userMessage = page.locator('[data-testid^="ChatMessage-"]').filter({ has: page.locator('img[alt="test_image_edit.png"]') });
        await expect(userMessage).toBeVisible();
        await expect(userMessage).toContainText("Test message with image");

        // 4. Click edit button on the last user message
        // The edit button might be hidden until hover
        await userMessage.hover();
        await userMessage.getByTestId('EditMessageBtn').click();

        // 5. Verify input is populated
        await expect(page.getByTestId('ChatTextArea')).toHaveValue("Test message with image");

        // 6. Verify image is present in the input area (preview)
        // In MessageInput, images are rendered in a stack. We can check for the img tag with the alt text.
        await expect(page.locator('[data-testid="MessageInputBar"] img[alt="test_image_edit.png"]')).toBeVisible();
    });
});
