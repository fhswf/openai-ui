import { test, expect } from '../baseFixtures';

test('Tool Usage Popup', async ({ page }) => {

    // Mock the OpenAI API response
    await page.route('**/v1/responses', async route => {
        const mockResponse = [
            {
                type: 'response.created',
                response: { id: 'resp_mock_123' },
                item: { id: 'msg_mock_123', role: 'assistant' }
            },
            {
                type: 'response.output_item.added',
                item: {
                    type: 'function_call',
                    id: 'call_mock_1',
                    name: 'get_weather',
                    arguments: '{"location": "San Francisco"}',
                    output: 'Sunny, 25C'
                }
            },
            {
                type: 'response.output_item.done',
                item: {
                    type: 'function_call',
                    id: 'call_mock_1',
                    name: 'get_weather',
                    arguments: '{"location": "San Francisco"}',
                    output: 'Sunny, 25C'
                }
            },
            {
                type: 'response.output_item.added',
                item: {
                    type: 'reasoning',
                    id: 'call_mock_2',
                    summary: [{ text: '**Clarifying user intent** The user says "Test" again...' }, { text: 'Checking database' }]
                }
            },
            {
                type: 'response.output_item.added',
                item: {
                    type: 'image_generation_call',
                    id: 'call_mock_3',
                    arguments: '{"prompt": "A sunny day in SF"}',
                    items: 'Image generated' // Mocking items as string to simulate redundancy check if it was used
                }
            },
            {
                type: 'response.output_item.done',
                item: {
                    type: 'image_generation_call',
                    id: 'call_mock_3',
                    result: 'base64data' // Mock result
                }
            },
            {
                type: 'response.completed',
                response: {
                    usage: { input_tokens: 10, output_tokens: 20 }
                }
            }
        ];

        // Simulate a stream by sending events one by one
        // Note: This is a simplified mock. The actual client expects a specific stream format (SSE).
        // If the client uses standard fetch with a reader, we need to mock the body as a stream.

        const sseBody = mockResponse.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');

        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: sseBody
        });
    });

    await page.goto("");

    // Send a message to trigger the mocked response
    await page.getByTestId('ChatTextArea').click();
    await page.getByTestId('ChatTextArea').fill('What is the weather?');
    await page.getByTestId('SendMessageBtn').click();

    // Wait for the message to appear
    await expect(page.getByTestId('ChatMessage-1')).toBeVisible();

    // Check for the tool badge
    const toolBadge = page.getByTestId('tool-usage-badge-function_call');
    await expect(toolBadge).toBeVisible();

    // Click the badge to open the popup
    await toolBadge.click();

    // Verify popup content
    await expect(page.getByTestId('tool-usage-popup-content')).toBeVisible();

    // Check if it's an accordion or static box
    const trigger = page.getByTestId('tool-trigger-function_call-0');
    const staticBox = page.getByTestId('tool-item-function_call-0');

    if (await trigger.isVisible()) {
        await trigger.click();
        await expect(page.getByText('San Francisco')).toBeVisible();
        await expect(page.getByText('Sunny, 25C')).toBeVisible();
    } else {
        await expect(staticBox).toBeVisible();
        // If static, it means no info, but our mock HAS info.
        throw new Error("Expected accordion for tool with arguments, but got static box or nothing.");
    }

    // Verify Reasoning
    // Title should be extracted from bold text: "Clarifying user intent"
    await expect(page.getByText('Clarifying user intent')).toBeVisible();
    // Content should contain the rest of the first item: 'The user says "Test" again...'
    // And the second item: "Checking database"
    const reasoningTrigger = page.getByText('Clarifying user intent');
    await expect(reasoningTrigger).toBeVisible();
    await reasoningTrigger.click();
    await expect(page.getByText('The user says "Test" again...')).toBeVisible();
    await expect(page.getByText('Checking database')).toBeVisible();

    // Verify Image Generation
    // Title should be the prompt: "A sunny day in SF"
    await expect(page.getByText('A sunny day in SF')).toBeVisible();
    // It should be a static box because we set items to "Image generated" but our logic might hide it if it matches title?
    // No, our logic for image generation: info.items = (tool as any).items || t("No additional information available.");
    // We mocked items: 'Image generated'.
    // So it should be an accordion or static box depending on content.
    // If items is just a string, it might be rendered.
    // Let's check if "Image generated" is visible.
    // Wait, if items is not empty, it's an accordion.
    const imageTrigger = page.getByText('A sunny day in SF');
    await expect(imageTrigger).toBeVisible();
    await imageTrigger.click();
    await expect(page.getByText('Image generated')).toBeVisible();
});
