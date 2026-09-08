import { test as base, chromium } from '@playwright/test';
import { RUN_TAG, uniqueName } from '../utils/RandomDataGenerator';
import { SalesCustomerFormPage, ProductFormPage } from '../../modules/sales/pages/SalesPage';

export interface SalesMasterData {
  runTag: string;
  customerName: string;
  product1Name: string;
  product2Name: string;
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

      const created: Array<{ label: string; resId: number }> = [];

      // ── Customer ──────────────────────────────────────────────────────────────
      const customerPage = new SalesCustomerFormPage(page);
      await customerPage.navigate();
      const customerName = uniqueName('Test Customer');
      try {
        await customerPage.customerName.setValue(customerName);
        await customerPage.save();
      } catch (err) {
        console.error(`  ✘ Customer creation failed: ${(err as Error).message}`);
        throw err;
      }
      const customerResId = currentResId(page.url());
      if (customerResId) created.push({ label: 'Customer', resId: customerResId });
      console.log(`  ✔ Customer created     → id=${customerResId}  "${customerName}"`);

      // ── Products ──────────────────────────────────────────────────────────────
      async function createProduct(baseName: string): Promise<string> {
        const productPage = new ProductFormPage(page);
        await productPage.navigate();
        const name = uniqueName(baseName);
        // Not required at the model level, but this instance's view enforces both as
        // required anyway (see ProductFormPage doc comment) — derive a compact unique
        // value from the same name rather than introducing a separate code generator.
        const code = name.replace(/[^A-Za-z0-9]/g, '');
        try {
          await productPage.productName.setValue(name);
          await productPage.internalReference.setValue(code);
          await productPage.barcode.setValue(code);
          await productPage.save();
        } catch (err) {
          console.error(`  ✘ Product creation failed ("${baseName}"): ${(err as Error).message}`);
          throw err;
        }
        const resId = currentResId(page.url());
        if (resId) created.push({ label: `Product (${baseName})`, resId });
        console.log(`  ✔ Product created      → id=${resId}  "${name}"`);
        return name;
      }

      const product1Name = await createProduct('Test Product 1');
      const product2Name = await createProduct('Test Product 2');

      await context.close();
      await browser.close();

      if (SKIP_ARCHIVE) {
        console.log('\n  ℹ SKIP_ARCHIVE=true — records will NOT be archived after the run');
      }
      console.log('  ─────────────────────────────────────────');

      await use({ runTag: RUN_TAG, customerName, product1Name, product2Name });

      // ── Teardown ──────────────────────────────────────────────────────────────
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║       SALES MASTER DATA — TEARDOWN       ║');
      console.log('╚══════════════════════════════════════════╝');

      if (SKIP_ARCHIVE) {
        console.log(`  ℹ SKIP_ARCHIVE=true — skipping archive. Search "[TEST]" or run tag "${RUN_TAG}" to find them.\n`);
        return;
      }

      const teardownBrowser = await chromium.launch();
      const teardownContext = await teardownBrowser.newContext({ storageState: 'auth-storage/admin.json' });
      const teardownPage = await teardownContext.newPage();

      for (const record of [...created].reverse()) {
        try {
          if (record.label.startsWith('Product')) {
            const productPage = new ProductFormPage(teardownPage);
            await productPage.openById(record.resId);
            await productPage.archiveRecord();
          } else {
            const customerPage = new SalesCustomerFormPage(teardownPage);
            await customerPage.openById(record.resId);
            await customerPage.archiveRecord();
          }
          console.log(`  ✔ Archived ${record.label} id=${record.resId}`);
        } catch (err) {
          console.warn(`  ✘ Could not archive ${record.label} id=${record.resId}: ${(err as Error).message}`);
        }
      }

      await teardownContext.close();
      await teardownBrowser.close();
      console.log('');
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
