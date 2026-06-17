import { test, expect } from '../baseFixtures';

const noAffiliationUser = {
    name: 'Playwright No Affiliation',
    email: 'playwright-no-affiliation@example.com',
    sub: 'playwright-no-affiliation',
    preferred_username: 'playwright-no-affiliation',
    affiliations: {},
};

const userEndpointPattern = /\/(?:api\/)?user\/?(?:\?.*)?$/;

test('No Affiliation Access Denied', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.route(userEndpointPattern, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(noAffiliationUser),
        });
    });

    const userResponse = page.waitForResponse(userEndpointPattern);
    await page.goto("", { waitUntil: 'domcontentloaded' });
    await userResponse;
    const noAccessMessage = page.getByTestId('no-access-message');

    await expect(noAccessMessage).toBeVisible();
    await expect(noAccessMessage).toContainText(noAffiliationUser.preferred_username);
    await context.close();
});
