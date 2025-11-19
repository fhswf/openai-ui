import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join('playwright/.auth/user.json');

setup('Cluster Login Test', async ({ page }, testInfo) => {
    //const authFile = testInfo.outputPath('user.json');


    await page.goto('https://openai.ki.fh-swf.de');
    await expect(page.getByRole('button', { name: 'SSO Login mit der FH Kennung' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cluster Login' })).toBeVisible();
    await page.getByRole('button', { name: 'Cluster Login' }).click();
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).click();
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).fill('playwright');
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).press('Tab');
    await page.getByRole('textbox', { name: 'Cluster Kennwort:' }).fill('test');
    await page.getByRole('button', { name: 'Login Cluster' }).click();
    await page.waitForURL('https://openai.ki.fh-swf.de');
    await expect(page.getByRole('heading', { name: 'Datenschutzhinweise' })).toBeVisible();
    await expect(page.getByTestId('accept-terms-btn')).toBeVisible();
    await page.getByTestId('accept-terms-btn').click();
    await expect(page.getByTestId('ChatTextArea')).toBeVisible();

    await page.context().storageState({ path: authFile });
});