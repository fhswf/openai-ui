import { test, expect } from '../baseFixtures';

test('Image Delete', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', "Skipping Webkit due to issues with OPFS");

    await page.goto("");

    // Ensure chat is ready
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    // Create a dummy image file
    const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

    // Upload an image
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('UploadFileBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'test_image_delete.png',
        mimeType: 'image/png',
        buffer: buffer,
    });

    // Verify image is visible
    const imageLocator = page.locator('img[alt="test_image_delete.png"]');
    await expect(imageLocator).toBeVisible();

    // Click delete button
    await page.getByLabel('Delete image').click();

    // Verify image is gone
    await expect(imageLocator).not.toBeVisible();
});
