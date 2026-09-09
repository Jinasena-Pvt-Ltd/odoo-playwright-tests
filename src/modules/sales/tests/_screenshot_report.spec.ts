import { test } from '@playwright/test';
import path from 'path';

test('screenshot master report', async ({ page }) => {
  const reportPath = path.resolve(__dirname, '../../../../reports/master-report-2026-09-09.html');
  await page.goto(`file://${reportPath}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'master-report-screenshot.png', fullPage: false });
});
