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
    
    // Terms are guaranteed to show up because localStorage is empty on a fresh setup run
    await expect(termsButton).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('heading', { name: 'Datenschutzhinweise' })).toBeVisible();
    await termsButton.click();
    
    // Wait for terms status to be saved in localStorage SESSIONS
    await expect(async () => {
        const terms = await page.evaluate(() => {
            const raw = localStorage.getItem("SESSIONS");
            if (!raw) return false;
            try {
                const session = JSON.parse(raw);
                return !!session?.options?.account?.terms;
            } catch {
                return false;
            }
        });
        expect(terms).toBe(true);
    }).toPass({ timeout: 10000 });

    await expect(chatTextArea).toBeVisible();

    // Navigate back to localhost to write terms: true to the localhost origin as well
    await page.goto('');
    await page.evaluate(() => {
        const raw = localStorage.getItem("SESSIONS");
        if (raw) {
            try {
                const session = JSON.parse(raw);
                if (session.options) {
                    if (!session.options.account) session.options.account = {};
                    session.options.account.terms = true;
                    localStorage.setItem("SESSIONS", JSON.stringify(session));
                }
            } catch (e) {
                // Ignore
            }
        } else {
            localStorage.setItem("SESSIONS", JSON.stringify({
                options: {
                    account: {
                        terms: true
                    }
                }
            }));
        }
    });

    await page.context().storageState({ path: authFile });
});
