import { test, expect } from '../baseFixtures';



test('Chat Message Send', async ({ page }) => {
    await page.goto("");
    await expect(page.getByTestId('ChatMessage-0')).toBeVisible();
    await page.getByTestId('ChatTextArea').click();
    await page.getByTestId('ChatTextArea').fill('Test');
    await page.getByTestId('SendMessageBtn').click();
    await expect(page.getByTestId('SendMessageBtn')).toBeDisabled();
    await expect(page.getByTestId('ChatTextArea')).toBeEnabled();
    await expect(page.getByTestId('ChatMessage-1')).toBeVisible();
    await expect(page.getByTestId('ChatMessage-2')).toBeVisible();
});