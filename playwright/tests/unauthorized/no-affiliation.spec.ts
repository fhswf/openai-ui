import { test, expect } from '../baseFixtures';
test('No Affiliation Access Denied', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto("");
    const noAccessMessage = page.getByTestId('no-access-message');

    if (!(await noAccessMessage.isVisible().catch(() => false))) {
        await expect(page.locator('.sso-login')).toBeVisible({ timeout: 60000 });
        await expect(page.locator('.cluster-login')).toBeVisible();
        await page.locator('.cluster-login').click();
        await expect(page.getByRole('textbox', { name: 'Cluster Benutzername:' })).toBeVisible();
        await expect(page.getByRole('textbox', { name: 'Cluster Kennwort:' })).toBeVisible();
        await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).click();
        await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).fill('playwright-no-affiliation');
        await page.getByRole('textbox', { name: 'Cluster Benutzername:' }).press('Tab');
        await page.getByRole('textbox', { name: 'Cluster Kennwort:' }).fill('test');
        await page.getByRole('button', { name: 'Login Cluster' }).click();
    }

    await expect(noAccessMessage).toBeVisible();
    await context.close();
});
