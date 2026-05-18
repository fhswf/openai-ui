import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
dotenv.config();

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5173';
const previewCommand =
  process.env.PLAYWRIGHT_PREBUILT_DIST === '1'
    ? 'yarn preview --host 127.0.0.1 --port 5173 --strictPort'
    : 'yarn build && yarn preview --host 127.0.0.1 --port 5173 --strictPort';
const reporterOutputFile =
  process.env.PLAYWRIGHT_JSON_OUTPUT || 'playwright-report/results.json';
const crossBrowserSmokeTests = /.*[\\/](auth|chat|no-affiliation)\.spec\.ts$/;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: 'playwright/tests',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 3 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [['github'], ['html'], ['json', { outputFile: reporterOutputFile }]]
    : 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL,

    locale: 'de-DE',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    // Setup project
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json'
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json'
      },
      testMatch: crossBrowserSmokeTests,
      dependencies: ['setup'],
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/user.json'
      },
      testMatch: crossBrowserSmokeTests,
      dependencies: ['setup'],
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json'
      },
      testMatch: crossBrowserSmokeTests,
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'playwright/.auth/user.json'
      },
      testMatch: crossBrowserSmokeTests,
      dependencies: ['setup'],
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge', storageState: 'playwright/.auth/user.json' },
      testMatch: crossBrowserSmokeTests,
      dependencies: ['setup'],
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', storageState: 'playwright/.auth/user.json' },
      testMatch: crossBrowserSmokeTests,
      dependencies: ['setup'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: previewCommand,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
