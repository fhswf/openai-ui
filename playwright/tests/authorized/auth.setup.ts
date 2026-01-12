import { test as setup, expect } from '../baseFixtures';
import { url } from 'node:inspector';
import path from 'node:path';

const authFile = path.join('playwright/.auth/user.json');

const testHomeURL = (url: URL) => {
    return url.pathname === '/';
};

setup('Cluster Login Test', async ({ page }, testInfo) => {

    await page.goto('', { waitUntil: 'domcontentloaded' });

    // Brute-force: Wait for some content, then stop loading to kill hanging requests
    await page.waitForTimeout(2000);

    // Verify and click Cluster Login
    const clusterBtn = page.getByRole('button', { name: 'Cluster Login' });
    await expect(clusterBtn).toBeVisible();
    await clusterBtn.click({ force: true });
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