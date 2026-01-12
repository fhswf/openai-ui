import { test as setup, expect } from '../baseFixtures';
import { url } from 'node:inspector';
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
        await expect(page.locator('.sso-login')).toBeVisible({ timeout: 60000 });
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
    await expect(page.getByRole('heading', { name: 'Datenschutzhinweise' })).toBeVisible();
    await expect(page.getByTestId('accept-terms-btn')).toBeVisible();
    await page.getByTestId('accept-terms-btn').click();
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    await page.context().storageState({ path: authFile });
});