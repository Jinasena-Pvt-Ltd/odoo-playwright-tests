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
    },
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
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
