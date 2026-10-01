import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Reuses the main suite's .env and logged-in admin session — no separate credentials
// or login flow needed for this tool.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';

export default defineConfig({
  testDir: './generated/specs',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'generated/report', open: 'never' }],
  ],

  use: {
    baseURL,
    headless: process.env.HEADLESS !== 'false',
    storageState: path.resolve(__dirname, '../../auth-storage/admin.json'),
    screenshot: 'off', // the spec takes its own per-step screenshots for the manual
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },
});
