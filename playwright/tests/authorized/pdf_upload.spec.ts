import { test, expect } from '../baseFixtures';
import { acceptTermsIfVisible } from '../testHelpers';

// A minimal single-page PDF document.
const PDF_BASE64 =
    'JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzAwIDMwMF0+PmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1MiAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCnRyYWlsZXI8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoxNjcKJSVFT0Y=';

test('PDF Upload', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Skipping Webkit due to issues with OPFS');

    await page.goto('');

    // Conditionally accept terms
    await acceptTermsIfVisible(page);

    // Ensure chat is ready
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    const buffer = Buffer.from(PDF_BASE64, 'base64');

    // Test clicking the upload button
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTestId('UploadFileBtn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'test_document_click.pdf',
        mimeType: 'application/pdf',
        buffer,
    });
    await expect(page.getByTestId('file-preview-test_document_click.pdf')).toBeVisible();

    // Test drag and drop
    const dataTransfer = await page.evaluateHandle((data) => {
        const dt = new DataTransfer();
        const binaryString = atob(data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.codePointAt(i) || 0;
        }
        const file = new File([bytes], 'test_document_drop.pdf', { type: 'application/pdf' });
        dt.items.add(file);
        return dt;
    }, { buffer: PDF_BASE64 });

    await page.getByTestId('file-input').dispatchEvent('drop', { dataTransfer });
    await expect(page.getByTestId('file-preview-test_document_drop.pdf')).toBeVisible();

    // Send the message and verify the PDF attachment is rendered in the chat.
    await page.getByTestId('ChatTextArea').fill('Summarize the attached document');
    await page.getByTestId('SendMessageBtn').click();

    const userMessage = page
        .locator('[data-testid^="ChatMessage-"]')
        .filter({ has: page.getByTestId('file-preview-test_document_drop.pdf') });
    await expect(userMessage).toBeVisible();
    await expect(userMessage.getByTestId('file-preview-test_document_drop.pdf')).toBeVisible({ timeout: 15000 });
});
