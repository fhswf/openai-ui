import { test, expect } from '../baseFixtures';

test('send message via keyboard shortcut', async ({ page }) => {
    await page.goto('/');

    // Wait for the chat input to be visible
    const chatInput = page.getByTestId('ChatTextArea');
    await expect(chatInput).toBeVisible();

    // Type a message
    await chatInput.fill('Hello via shortcut');

    // Press the shortcut (Control+Enter)
    await chatInput.press('Control+Enter');

    // Verify the message is sent
    // The input should be cleared
    await expect(chatInput).toHaveValue('');

    // Verify the message appears in the chat
    // Assuming the message appears in a container with a specific class or test id
    // We can look for the text "Hello via shortcut"
    await expect(page.getByText('Hello via shortcut')).toBeVisible();
});
