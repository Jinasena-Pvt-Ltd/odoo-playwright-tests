import { test as base, chromium } from '@playwright/test';
import { RUN_TAG, uniqueName } from '../utils/RandomDataGenerator';
import { SalesCustomerFormPage } from '../../modules/sales/pages/SalesPage';

export interface SalesMasterData {
  runTag: string;
  customerName: string;
}

export type SalesMasterDataWorkerFixtures = {
  salesMasterData: SalesMasterData;
};

const SKIP_ARCHIVE = process.env.SKIP_ARCHIVE === 'true';

/** Extracts the `id=<n>` param Odoo writes into the URL hash once a new record is saved. */
function currentResId(url: string): number | null {
  const match = url.match(/[?&#]id=(\d+)/);
  return match ? Number(match[1]) : null;
}

export const test = base.extend<{}, SalesMasterDataWorkerFixtures>({
  salesMasterData: [
    async ({}, use) => {
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║       SALES MASTER DATA — SETUP          ║');
      console.log(`║  Run Tag: ${RUN_TAG.padEnd(30)}║`);
      console.log('╚══════════════════════════════════════════╝');

      const browser = await chromium.launch();
      const context = await browser.newContext({ storageState: 'auth-storage/admin.json' });
      const page = await context.newPage();

      // ── Customer ──────────────────────────────────────────────────────────────
      // Products are deliberately NOT created here anymore — a freshly-created product
      // being priced for the first time under a customer's pricelist was found to hang
      // (or take far longer than any reasonable timeout) on this instance, confirmed by
      // swapping in an established, already-priced product and seeing it work reliably.
      // Tests now reference a real pre-existing product via SALES_TEST_CONFIG.product
      // (see sales.master-data.ts) instead of a fixture-created one.
      const customerPage = new SalesCustomerFormPage(page);
      await customerPage.navigate();
      const customerName = uniqueName('Test Customer');
      let customerResId: number | null = null;
      try {
        await customerPage.customerName.setValue(customerName);
        await customerPage.save();
        customerResId = currentResId(page.url());
      } catch (err) {
        console.error(`  ✘ Customer creation failed: ${(err as Error).message}`);
        throw err;
      }
      console.log(`  ✔ Customer created     → id=${customerResId}  "${customerName}"`);

      await context.close();
      await browser.close();

      if (SKIP_ARCHIVE) {
        console.log('\n  ℹ SKIP_ARCHIVE=true — records will NOT be archived after the run');
      }
      console.log('  ─────────────────────────────────────────');

      await use({ runTag: RUN_TAG, customerName });

      // ── Teardown ──────────────────────────────────────────────────────────────
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║       SALES MASTER DATA — TEARDOWN       ║');
      console.log('╚══════════════════════════════════════════╝');

      if (SKIP_ARCHIVE) {
        console.log(`  ℹ SKIP_ARCHIVE=true — skipping archive. Search "[TEST]" or run tag "${RUN_TAG}" to find them.\n`);
        return;
      }

      if (customerResId) {
        const teardownBrowser = await chromium.launch();
        const teardownContext = await teardownBrowser.newContext({ storageState: 'auth-storage/admin.json' });
        const teardownPage = await teardownContext.newPage();
        try {
          const customerPage = new SalesCustomerFormPage(teardownPage);
          await customerPage.openById(customerResId);
          await customerPage.archiveRecord();
          console.log(`  ✔ Archived Customer id=${customerResId}`);
        } catch (err) {
          console.warn(`  ✘ Could not archive Customer id=${customerResId}: ${(err as Error).message}`);
        }
        await teardownContext.close();
        await teardownBrowser.close();
      }
      console.log('');
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
