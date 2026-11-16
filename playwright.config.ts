import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['./src/core/reporters/ValidationTableReporter.ts', { outputDir: 'reports/validation-table' }],
  ],

  use: {
    baseURL,
    headless: process.env.HEADLESS !== 'false',
    screenshot: 'only-on-failure',
    launchOptions: {
      slowMo: Number(process.env.SLOW_MO ?? 0),
      // Headed runs open a second window for the customer portal; Chromium then throttles
      // the Odoo window behind it (timers, rendering), so its buttons never re-render and
      // screenshots stall. Keep every window running as if it were in front.
      args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    },
    // Off by default: on long repair flows the context close kept waiting for the video file
    // and hung for the whole test timeout (no page open, video never written). Failures still
    // keep their trace and step screenshots. PW_VIDEO=retain-on-failure turns it back on.
    video: (process.env.PW_VIDEO ?? 'off') as 'off' | 'on' | 'retain-on-failure' | 'on-first-retry',
    // Without DOM snapshots: on long repair flows (hundreds of steps) writing them when the
    // context closed never finished and the test hung for its whole timeout. The step log and
    // the screencast frames are still recorded. PW_TRACE_SNAPSHOTS=1 turns snapshots back on.
    trace: {
      mode: 'retain-on-failure',
      snapshots: process.env.PW_TRACE_SNAPSHOTS === '1',
      screenshots: true,
      sources: false,
    },
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  projects: [
    // Step 1: Create auth storage files
    {
      name: 'setup',
      testMatch: '**/fixtures/auth.setup.ts',
    },

    // Role-based projects — all depend on setup
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'auth-storage/admin.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'manager',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'auth-storage/manager.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'employee',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'auth-storage/employee.json',
      },
      dependencies: ['setup'],
    },
  ],
});
