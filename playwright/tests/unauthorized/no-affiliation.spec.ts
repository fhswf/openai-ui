import { test, expect } from '../baseFixtures';



test('No Affiliation Access Denied', async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });

    await page.goto('https://openai.ki.fh-swf.de');
    await expect(page.getByRole('button', { name: 'SSO Login mit der FH Kennung' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cluster Login' })).toBeVisible();
    await page.getByRole('button', { name: 'Cluster Login' }).click();
    await expect(page.getByRole('textbox', { name: 'Cluster Benutzername:' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Cluster Kennwort:' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).click();
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).fill('playwright-no-affiliation');
    await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).press('Tab');
    await page.getByRole('textbox', { name: 'Cluster Kennwort:' }).fill('test');
    await page.getByRole('button', { name: 'Login Cluster' }).click();
    await expect(page.locator('h1')).toContainText('Kein Zugriff');
});