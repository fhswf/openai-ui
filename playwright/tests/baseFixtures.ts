import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { test as baseTest } from '@playwright/test';

const istanbulCLIOutput = path.join(process.cwd(), '.nyc_output');

export function generateUUID(): string {
    return crypto.randomBytes(16).toString('hex');
}

export const test = baseTest.extend({
    context: async ({ context }, use) => {
        // Authorized UI tests run against the static preview without the SSO
        // cookie used by the deployed app. Keep the default user lookup local
        // for every page in this context; tests that exercise auth failures
        // can override it with a page-level route.
        await context.route(/\/(?:api\/)?user\/?(?:\?.*)?$/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'Playwright User',
                    email: 'playwright@fh-swf.de',
                    sub: 'playwright',
                    preferred_username: 'playwright',
                    affiliations: { 'fh-swf.de': ['member'] },
                }),
            });
        });
        await context.addInitScript(() =>
            window.addEventListener('beforeunload', () =>
                (window as any).collectIstanbulCoverage(JSON.stringify((window as any).__coverage__))
            ),
        );
        await fs.promises.mkdir(istanbulCLIOutput, { recursive: true });
        await context.exposeFunction('collectIstanbulCoverage', (coverageJSON: string) => {
            if (coverageJSON)
                fs.writeFileSync(path.join(istanbulCLIOutput, `playwright_coverage_${generateUUID()}.json`), coverageJSON);
        });
        await use(context);
        for (const page of context.pages()) {
            if (page.isClosed()) continue;
            try {
                await page.evaluate(() => {
                    const collectIstanbulCoverage = (window as any).collectIstanbulCoverage;
                    if (typeof collectIstanbulCoverage === 'function') {
                        collectIstanbulCoverage(JSON.stringify((window as any).__coverage__));
                    }
                });
            } catch (error) {
                console.warn('Skipping Istanbul coverage collection after page teardown:', error);
            }
        }
    }
});

export const expect = test.expect;
