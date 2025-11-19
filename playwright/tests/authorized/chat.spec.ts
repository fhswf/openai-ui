import { test, expect } from '@playwright/test';



test('Chat Message Send', async ({ page }) => {
    await page.goto('https://openai.ki.fh-swf.de');
    await page.getByTestId('ChatTextArea').click();
    await page.getByTestId('ChatTextArea').fill('Test');
    await page.getByTestId('SendMessageBtn').click();
    await expect(page.getByTestId('SendMessageBtn')).toBeDisabled();
    await expect(page.getByTestId('ChatTextArea')).toBeEnabled();
    // Assert assistant reply by visible text instead of relying on a missing data-testid
    await expect(page.getByText(/[Tt]est/)).toBeVisible();
});