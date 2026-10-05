import { test, expect } from '../baseFixtures';
import { acceptTermsIfVisible } from '../testHelpers';

// A 1x1 transparent PNG.
const PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const mockUser = {
    name: 'Playwright Paste',
    email: 'playwright.paste@fh-swf.de',
    sub: 'playwright-paste',
    preferred_username: 'playwright.paste',
    affiliations: {
        'fh-swf.de': ['member'],
    },
};

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;

async function pasteImage(page: import('@playwright/test').Page, name: string) {
    await page.getByTestId('ChatTextArea').evaluate((element, data) => {
        const binaryString = atob(data.buffer);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.codePointAt(i) || 0;
        }
        const file = new File([bytes], data.name, { type: 'image/png' });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        element.dispatchEvent(
            new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true,
            })
        );
    }, { buffer: PNG_BASE64, name });
}

test('Image Paste', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Skipping Webkit due to issues with OPFS');

    // Serve the user from a local mock so the test exercises the locally built
    // app. Without this the auth cookie (scoped to the deployed host) makes
    // /api/user return 401 on localhost and the app redirects to the login page.
    await page.route(userEndpointPattern, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockUser),
        });
    });

    // Keep the send flow hermetic: respond to the streaming request locally
    // instead of hitting the deployed backend.
    await page.route('**/v1/responses', async (route) => {
        const responseBody = [
            { type: 'response.created', response: { id: 'resp_paste_mock_123' } },
            {
                type: 'response.completed',
                response: {
                    usage: { total_tokens: 2, input_tokens: 1, output_tokens: 1 },
                },
            },
        ];

        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: responseBody.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
        });
    });

    await page.goto('');

    // Conditionally accept terms
    await acceptTermsIfVisible(page);

    // Ensure chat is ready
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    // Paste a named image into the textarea
    await pasteImage(page, 'test_image_paste.png');
    await expect(page.locator('img[alt="test_image_paste.png"]')).toBeVisible();

    // Send the message with the pasted image to make sure the OPFS image is
    // turned into base64 and sent without breaking the request.
    await page.getByTestId('ChatTextArea').fill('Test message with pasted image');
    await page.getByTestId('SendMessageBtn').click();

    const userMessage = page
        .locator('[data-testid^="ChatMessage-"]')
        .filter({ has: page.locator('img[alt="test_image_paste.png"]') });
    await expect(userMessage).toBeVisible();
    await expect(userMessage.locator('img[alt="test_image_paste.png"]')).toBeVisible({ timeout: 15000 });

    // Screenshots copied from the clipboard often have no filename. Pasting such
    // an image must still work and receive a generated name.
    await pasteImage(page, '');
    await expect(page.locator('img[alt^="pasted-image-"]')).toBeVisible();
});
