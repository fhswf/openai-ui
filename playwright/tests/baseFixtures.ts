import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { test as baseTest } from '@playwright/test';

const istanbulCLIOutput = path.join(process.cwd(), '.nyc_output');

export function generateUUID(): string {
    return crypto.randomBytes(16).toString('hex');
}

export const test = baseTest.extend({
    context: async ({ context }, use, testInfo) => {
        await context.addInitScript(() =>
            window.addEventListener('beforeunload', () =>
                (() => {
                    const collect = (window as any).collectIstanbulCoverage;
                    const coverage = (window as any).__coverage__;
                    if (typeof collect === 'function' && coverage)
                        collect(JSON.stringify(coverage));
                })()
            ),
        );
        await fs.promises.mkdir(istanbulCLIOutput, { recursive: true });
        await context.exposeFunction('collectIstanbulCoverage', (coverageJSON: string) => {
            if (coverageJSON)
                fs.writeFileSync(path.join(istanbulCLIOutput, `playwright_coverage_${generateUUID()}.json`), coverageJSON);
        });
        await use(context);
        if (testInfo.status === 'timedOut')
            return;
        for (const page of context.pages()) {
            if (page.isClosed())
                continue;
            try {
                page.setDefaultTimeout(1000);
                await page.evaluate(() => {
                    const collect = (window as any).collectIstanbulCoverage;
                    const coverage = (window as any).__coverage__;
                    if (typeof collect === 'function' && coverage)
                        collect(JSON.stringify(coverage));
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : `${error}`;
                if (
                    !message.includes('Test ended') &&
                    !message.includes('Timeout') &&
                    !message.includes('Execution context was destroyed') &&
                    !message.includes('Target page, context or browser has been closed')
                )
                    throw error;
            }
        }
    }
});

export const expect = test.expect;
