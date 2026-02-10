import { test, expect } from '../baseFixtures';

test('test page components render and interact correctly', async ({ page }) => {
    // Navigate to Test Page
    await page.goto('/?test=true');
    await expect(page.locator('text=Test Page for Coverage')).toBeVisible();

    // Avatar
    await expect(page.locator('text=Avatar')).toBeVisible();
    await expect(page.locator('.chakra-avatar').first()).toBeVisible();

    // Checkbox
    const checkbox = page.locator('label:has-text("Checkbox Label")');
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    // CloseButton
    await expect(page.locator('button[aria-label="Close"]')).toBeVisible();

    // Dialog
    await page.click('text=Open Dialog');
    await expect(page.locator('text=Dialog Title')).toBeVisible();
    await page.click('text=Cancel');
    await expect(page.locator('text=Dialog Title')).not.toBeVisible();

    // Drawer
    await page.click('text=Open Drawer');
    await expect(page.locator('text=Drawer Title')).toBeVisible();
    await page.click('text=Cancel');
    await expect(page.locator('text=Drawer Title')).not.toBeVisible();

    // Field
    await expect(page.locator('text=Field Label')).toBeVisible();
    await expect(page.locator('text=Helper text')).toBeVisible();
    await expect(page.locator('text=Error text')).toBeVisible();

    // InputGroup
    await expect(page.locator('text=$')).toBeVisible();

    // Menu
    await page.click('text=Open Menu');
    await expect(page.locator('div[role="menuitem"]:has-text("Item 1")')).toBeVisible();
    // Click an item to close menu or just click outside
    await page.click('body');

    // NumberInput
    await expect(page.locator('text=Number Input')).toBeVisible();
    await expect(page.locator('input[type="text"]').last()).toBeVisible(); // NumberInput might be text or number type

    // Popover
    await page.click('text=Open Popover');
    await expect(page.locator('text=Popover Title')).toBeVisible();
    await page.click('button[aria-label="Close"]').last(); // Popover close button

    // Error Component
    await page.click('#trigger-error-btn');
    // Error component renders error details. 
    // Based on Error.jsx: {chatError.code} ...
    // Test data: code: "TEST_ERR_001"
    await expect(page.locator('text=TEST_ERR_001')).toBeVisible();
    await expect(page.locator('text=This is a test error message')).toBeVisible();

    await page.click('#clear-error-btn');
    await expect(page.locator('text=TEST_ERR_001')).not.toBeVisible();

    // Apps
    await expect(page.locator('text=Apps')).toBeVisible();
    // Apps renders AppContainer -> Category -> Heading
    // Need to inspect what prompts/apps are default. Usually there is some default app content or category.
    // We can check for Test ID or specific class.
    await expect(page.getByTestId('AppsList')).toBeVisible();

    // AbortController
    await page.click('text=Test Abort');
    await expect(page.locator('text=Status: Aborted')).toBeVisible();

    // Config
    await expect(page.locator('text=Models:')).toBeVisible();
    await expect(page.locator('text=text-davinci-003')).toBeVisible();
});
