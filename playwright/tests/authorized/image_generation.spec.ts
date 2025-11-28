import { test, expect } from '../baseFixtures';

test('Image Generation', async ({ page }) => {
    // Mock the OpenAI API response
    await page.route('**/v1/responses', async route => {
        const responseBody = [
            {
                type: 'response.created',
                response: {
                    id: 'resp_mock_123',
                }
            },
            {
                type: 'response.output_item.done',
                item: {
                    id: 'item_mock_123',
                    output_format: 'png',
                    result: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // 1x1 red pixel
                }
            },
            {
                type: 'response.completed',
                response: {
                    usage: {
                        total_tokens: 10,
                        input_tokens: 5,
                        output_tokens: 5
                    }
                }
            }
        ];

        // Simulate SSE stream
        const stream = responseBody.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');

        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: stream,
        });
    });

    // Enable console logging
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));

    await page.goto("");

    // Ensure chat is ready
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    // Send a message to trigger image generation
    await page.getByTestId('ChatTextArea').fill('Generate a red pixel');
    await page.getByTestId('SendMessageBtn').click();

    // Check for error toast
    const errorToast = page.locator('.chakra-toast');
    if (await errorToast.isVisible()) {
        console.log('Error Toast found:', await errorToast.textContent());
    }

    // Verify the image is displayed
    // Verify the image is displayed
    // The key in message.images is the item id
    await expect(page.getByTestId('generated-image-item_mock_123')).toBeVisible({ timeout: 10000 });
});
