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
    const chatTextArea = page.getByTestId('ChatTextArea');

    await expect(termsBtn.or(chatTextArea).first()).toBeVisible({ timeout: 15000 });

    if (await termsBtn.isVisible()) {
        await expect(async () => {
            await termsBtn.scrollIntoViewIfNeeded();
            await termsBtn.click();
            await expect(informationWindow).toBeHidden({ timeout: 1000 });
        }).toPass({ timeout: 15000, intervals: [500, 1000] });

        await expect(
            page.locator('[data-scope="dialog"][data-part="positioner"]')
        ).toBeHidden({ timeout: 15000 });
    }
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

test('XSS and HTML Injection Sanitization', async ({ page }) => {
    const xssPayload = '<!DOCTYPE html><meta charset="utf-8" /><meta http-equiv="refresh" content="0; url=https://www.fh-swf.de"/><script>alert("xss")</script><b>Safe HTML</b>';

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
    await page.getByTestId('ChatTextArea').fill(xssPayload);
    await page.getByTestId('SendMessageBtn').click();
    
    // Check that we don't get redirected (we remain on the application page)
    await expect(page).toHaveURL(/localhost|127.0.0.1/);
    
    // The message element should be visible
    const messageContainer = page.getByTestId('ChatMessage-1');
    await expect(messageContainer).toBeVisible();

    // The script tag and meta redirect tags should be stripped, but safe HTML elements (like <b>) should remain
    const metaTag = messageContainer.locator('meta');
    await expect(metaTag).toHaveCount(0);
    const scriptTag = messageContainer.locator('script');
    await expect(scriptTag).toHaveCount(0);
    const boldTag = messageContainer.locator('b');
    await expect(boldTag).toBeVisible();
    await expect(boldTag).toHaveText('Safe HTML');
});
