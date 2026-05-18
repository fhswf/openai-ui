import { test as setup, expect } from '../baseFixtures';
import path from 'node:path';

const authFile = path.join('playwright/.auth/user.json');

const testHomeURL = (url: URL) => {
    return url.pathname === '/';
};

setup('Cluster Login Test', async ({ page }, testInfo) => {
    // Triple the default timeout to handle slow environment
    setup.slow();

    await page.goto('');
    console.log('Initial navigation to localhost complete. Current URL:', page.url());

    // Wait for potential redirect
    try {
        await expect(page.locator('.sso-login')).toBeVisible({ timeout: 10000 });
        console.log('SSO Login visible on:', page.url());
    } catch (e) {
        console.log('Timed out waiting for SSO Login. Current URL:', page.url());
        // Log the HTML content for debugging if it fails
        // console.log(await page.content()); 
        throw e;
    }
    await expect(page.locator('.cluster-login')).toBeVisible();

    await page.locator('.cluster-login').click();
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).click();
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).fill('playwright');
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).press('Tab');
    await page.getByRole('textbox', { name: 'Cluster Kennwort:' }).fill('test');
    await page.getByRole('button', { name: 'Login Cluster' }).click();
    await page.waitForURL(testHomeURL);

    const termsButton = page.getByTestId('accept-terms-btn');
    const chatTextArea = page.getByTestId('ChatTextArea');
    await expect(termsButton.or(chatTextArea).first()).toBeVisible({ timeout: 30000 });

    if (await termsButton.isVisible()) {
        await expect(page.getByRole('heading', { name: 'Datenschutzhinweise' })).toBeVisible();
        await termsButton.click();
    }

    await expect(chatTextArea).toBeVisible();

    await page.context().storageState({ path: authFile });
});
