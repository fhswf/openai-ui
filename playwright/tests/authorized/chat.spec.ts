import { test, expect } from '../baseFixtures';
import type { Page } from '@playwright/test';

const mockUser = {
    name: 'Playwright Chat',
    email: 'playwright.chat@fh-swf.de',
    sub: 'playwright-chat',
    preferred_username: 'playwright.chat',
    affiliations: {
        'fh-swf.de': ['member'],
    },
};

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;

async function acceptTermsIfVisible(page: Page) {
    const termsBtn = page.getByTestId('accept-terms-btn');
    const informationWindow = page.getByTestId('InformationWindow');
    if ((await termsBtn.count()) === 0) return;

    await expect(termsBtn).toBeVisible();
    await termsBtn.scrollIntoViewIfNeeded();
    await termsBtn.click();
    await expect(informationWindow).toBeHidden();
}



test('Chat Message Send', async ({ page }) => {
    await page.route(userEndpointPattern, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockUser),
        });
    });

    await page.route('**/v1/responses', async (route) => {
        const responseBody = [
            {
                type: 'response.created',
                response: { id: 'resp_chat_mock_123' },
            },
            {
                type: 'response.completed',
                response: {
                    usage: {
                        total_tokens: 2,
                        input_tokens: 1,
                        output_tokens: 1,
                    },
                },
            },
        ];

        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: responseBody.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''),
        });
    });

    await page.goto("");
    await expect(page.getByTestId('ChatMessage-0')).toBeVisible();
    await acceptTermsIfVisible(page);
    await page.getByTestId('ChatTextArea').click();
    await page.getByTestId('ChatTextArea').fill('Test');
    await page.getByTestId('SendMessageBtn').click();
    await expect(page.getByTestId('SendMessageBtn')).toBeDisabled();
    await expect(page.getByTestId('ChatTextArea')).toBeEnabled();
    await expect(page.getByTestId('ChatMessage-1')).toBeVisible();
    await expect(page.getByTestId('ChatMessage-2')).toBeVisible();
});
