import { test, expect } from '../baseFixtures';


test('Image Drop', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', "Skipping Webkit due to issues with OPFS");

    await page.goto("");

    // Ensure chat is ready
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    // Create a dummy image file
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

    // Test clicking the upload button
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('UploadFileBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'test_image_click.png',
        mimeType: 'image/png',
        buffer: buffer,
    });
    await expect(page.locator('img[alt="test_image_click.png"]')).toBeVisible();

    // Test drag and drop
    // We can use dispatchEvent to simulate a drop event on the dropzone
    const dataTransfer = await page.evaluateHandle((data) => {
        const dt = new DataTransfer();
        const binaryString = atob(data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.codePointAt(i) || 0;
        }
        const file = new File([bytes], 'test_image_drop.png', { type: 'image/png' });
        dt.items.add(file);
        return dt;
    }, { buffer: buffer.toString('base64') });

    await page.getByTestId('file-input').dispatchEvent('drop', { dataTransfer });
    await expect(page.locator('img[alt="test_image_drop.png"]')).toBeVisible();

    // Test sending the message with the image
    // This verifies that the OPFS image is correctly converted to base64 and sent to the API
    // without causing a 400 error.
    await page.getByTestId('ChatTextArea').fill("Test message with image");
    await page.getByTestId('SendMessageBtn').click();

    // Wait for the user message to appear in the chat history
    // It should contain the image
    const userMessage = page.locator('[data-testid^="ChatMessage-"]').filter({ has: page.locator('img[alt="test_image_drop.png"]') });
    await expect(userMessage).toBeVisible();
    await expect(userMessage.locator('img[alt="test_image_drop.png"]')).toBeVisible({ timeout: 15000 });
});
