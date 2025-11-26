import { test as setup, expect } from '../baseFixtures';
import { url } from 'node:inspector';
import path from 'node:path';

const authFile = path.join('playwright/.auth/user.json');

const testHomeURL = (url: URL) => {
    return url.pathname === '/';
};

setup('Cluster Login Test', async ({ page }, testInfo) => {

    await page.goto('');
    await expect(page.getByRole('button', { name: 'SSO Login mit der FH Kennung' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cluster Login' })).toBeVisible();
    await page.getByRole('button', { name: 'Cluster Login' }).click();
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