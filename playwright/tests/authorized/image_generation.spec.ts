import { test, expect } from '../baseFixtures';
import { acceptTermsIfVisible, mockUserEndpoint } from '../testHelpers';

test('Image Generation', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', "Skipping Webkit due to issues with OPFS");

    await mockUserEndpoint(page);

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
                type: 'response.output_item.added',
                item: {
                    type: 'image_generation_call',
                    id: 'item_mock_123',
                    output_format: 'png',
                }
            },
            {
                type: 'response.output_item.done',
                item: {
                    type: 'image_generation_call',
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
        const stream = responseBody
            .map(event => `data: ${JSON.stringify(event)}\n\n`)
            .join('');

        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: stream,
        });
    });

    // Enable console logging

    await page.goto("");

    // Conditionally accept terms
    await acceptTermsIfVisible(page);

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

test('Image Generation stores streamed images in OPFS', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', "Skipping Webkit due to issues with OPFS");

    await mockUserEndpoint(page);

    const generatedImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.route('**/v1/responses', async route => {
        const responseBody = [
            {
                type: 'response.created',
                response: { id: 'resp_streamed_image' },
            },
            {
                type: 'response.output_item.added',
                item: {
                    type: 'image_generation_call',
                    id: 'ig_streamed_image',
                    output_format: 'png',
                },
            },
            {
                type: 'response.image_generation_call.partial_image',
                item_id: 'ig_streamed_image',
                output_index: 0,
                partial_image_index: 0,
                partial_image_b64: generatedImageBase64,
            },
            {
                type: 'response.image_generation_call.completed',
                item_id: 'ig_streamed_image',
                output_index: 0,
                image_b64: generatedImageBase64,
            },
            {
                type: 'response.completed',
                response: {
                    usage: { total_tokens: 10, input_tokens: 5, output_tokens: 5 },
                },
            },
        ];
        const stream = responseBody.map(event => `data: ${JSON.stringify(event)}\n\n`).join('');

        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: stream,
        });
    });

    await page.goto("");
    await acceptTermsIfVisible(page);
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    await page.getByTestId('ChatTextArea').fill('Generate a streamed image');
    await page.getByTestId('SendMessageBtn').click();

    const generatedImage = page.getByTestId('generated-image-ig_streamed_image');
    await expect(generatedImage).toBeVisible({ timeout: 10000 });
    await page.locator('#chat_list').evaluate((scrollView: HTMLDivElement) => {
        scrollView.scrollTop = scrollView.scrollHeight;
    });
    await expect.poll(
        () => generatedImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
        { timeout: 10000 },
    ).toBeGreaterThan(0);

    await expect.poll(
        () => page.evaluate(async () => {
            try {
                const root = await navigator.storage.getDirectory();
                const handle = await root.getFileHandle('ig_streamed_image.png');
                return (await handle.getFile()).size;
            } catch {
                return 0;
            }
        }),
        { timeout: 10000 },
    ).toBeGreaterThan(0);
    await expect.poll(
        () => page.evaluate(() => localStorage.getItem('CHAT_HISTORY') || ''),
        { timeout: 10000 },
    ).toContain('opfs://ig_streamed_image.png');

    await page.reload();
    await acceptTermsIfVisible(page);
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    const restoredImage = page.getByTestId('generated-image-ig_streamed_image');
    await expect(restoredImage).toBeVisible({ timeout: 10000 });
    await page.locator('#chat_list').evaluate((scrollView: HTMLDivElement) => {
        scrollView.scrollTop = scrollView.scrollHeight;
    });
    await expect.poll(
        () => restoredImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
        { timeout: 10000 },
    ).toBeGreaterThan(0);
});
