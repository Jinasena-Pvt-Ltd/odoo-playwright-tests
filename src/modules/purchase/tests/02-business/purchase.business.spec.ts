/**
 * Step 2 — Business Logic for the purchase module.
 */
import { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { PurchaseFormPage } from '../../pages/PurchasePage';
import { PurchaseRequisitionFormPage } from '../../pages/PurchaseRequisitionPage';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { PURCHASE_TEST_CONFIG } from '../../data/purchase.master-data';

/** Records OK/Error per named step and prints a brief summary at the end of the run. */
function createStepRunner(page: Page, testInfo: TestInfo) {
  const entries: { group: string; name: string; status: 'OK' | 'Error'; error?: string; screenshot?: string }[] = [];

  return {
    async run(group: string, name: string, fn: () => Promise<void>): Promise<void> {
      try {
        await fn();
        entries.push({ group, name, status: 'OK' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const fileName = `${group}-${name}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase() + '.png';
        const screenshotPath = testInfo.outputPath(fileName);
        await page.screenshot({ path: screenshotPath }).catch(() => {});
        entries.push({ group, name, status: 'Error', error: message, screenshot: screenshotPath });
        throw err;
      }
    },
    printSummary(): void {
      const lines: string[] = ['', '========== Purchase E2E Test Summary =========='];
      let currentGroup = '';
      for (const e of entries) {
        if (e.group !== currentGroup) {
          currentGroup = e.group;
          lines.push(`${currentGroup}:`);
        }
        if (e.status === 'OK') {
          lines.push(`  ${e.name}: OK`);
        } else {
          lines.push(`  ${e.name}: Error - ${e.error}`);
          if (e.screenshot) lines.push(`    Screenshot: ${e.screenshot}`);
        }
      }
      lines.push('================================================', '');
      console.log(lines.join('\n'));
    },
  };
}

test.describe('Purchase Business Logic @module:purchase @step:business', () => {

  test('creates an RFQ and saves @smoke', async ({ page, rpc }) => {
    const vendorName = uniqueName('Test Vendor');
    const vendorId = await rpc.create<{ name: string }>('res.partner', { name: vendorName });

    const formPage = new PurchaseFormPage(page);
    await formPage.navigate();
    await formPage.vendor.setValue(vendorName);
    await formPage.save();

    // A saved RFQ leaves edit mode and is assigned a real sequence number
    // (e.g. "P00001") in place of the "New" placeholder shown before save.
    await expect(page.locator('.o_field_widget[name="name"]')).not.toContainText('New');

    // This instance's purchase.order model has no "active" field (a Studio
    // customization), so the standard archive() teardown isn't applicable to it.
    await rpc.archive('res.partner', [vendorId]);
  });

  test('completes the Inventory Credit Purchase cycle: PR -> RFQ -> PO -> Delivery -> Vendor Bill -> Payment @e2e', async ({ page }, testInfo) => {
    const scenario = PURCHASE_TEST_CONFIG.inventoryCreditPurchase;
    const steps = createStepRunner(page, testInfo);
    const prPage = new PurchaseRequisitionFormPage(page);
    const poPage = new PurchaseFormPage(page);
    let poId = 0;

    try {
      // 1. Purchase Requisition — created from the "Purchase Requisition MGMT" app.
      await steps.run('Purchase Requisition', 'Create', async () => {
        await prPage.navigate();
        // "Local" is already the default selected value for a new requisition.
        await expect(prPage.fieldWidget('x_studio_type')).toContainText('Local');
      });

      await steps.run('Purchase Requisition', 'Fill fields', async () => {
        await prPage.warehouse.setValue(scenario.warehouse);
        await prPage.setRequestedDeliveryDate(scenario.requestedDeliveryDay);
        await prPage.requestedBy.setValue(scenario.requestedBy);
        for (const [index, line] of scenario.lines.entries()) {
          await prPage.addProductLine(line.product, line.quantity, index === scenario.lines.length - 1);
        }
      });

      await steps.run('Purchase Requisition', 'Save', async () => {
        await prPage.save();
      });

      await steps.run('Purchase Requisition', 'Confirm', async () => {
        await prPage.confirm();
      });

      await steps.run('Purchase Requisition', 'Request Approval', async () => {
        await prPage.requestApproval();
      });

      await steps.run('Purchase Requisition', 'Approve', async () => {
        await prPage.approve();
        await expect(page.locator('.o_statusbar_status')).toContainText('Approved');
      });

      // 2. Create RFQ from the approved requisition (selects vendor + all lines in the wizard).
      // createRfqFromLines leaves the browser on the newly created RFQ's form.
      await steps.run('Purchase Requisition', 'Create RFQ', async () => {
        await prPage.createRfqFromLines(scenario.vendor);
      });

      await steps.run('RFQ', 'Set Vendor', async () => {
        // The wizard's vendor selection is flaky about persisting to the created record —
        // set it directly on the RFQ if it didn't stick, using the same reliable path as
        // the "creates an RFQ" test above.
        const vendorOnPo = await page.locator('.o_form_view').innerText();
        if (!vendorOnPo.includes(scenario.vendor)) {
          await poPage.vendor.setValue(scenario.vendor);
          // Selecting the dropdown option doesn't commit until the field loses focus —
          // pressing Tab forces that commit before save() reads the field's current value.
          await page.keyboard.press('Tab');
          await expect.poll(() => poPage.vendor.getValue(), { timeout: 8_000 }).toBe(scenario.vendor);
          await poPage.save();
        }
        await expect.poll(() => poPage.vendor.getValue(), { timeout: 20_000 }).toBe(scenario.vendor);
      });

      // Prior to confirming, the vendor's quotation must be attached under the
      // "Documents" tab.
      await steps.run('RFQ', 'Upload Quotation', async () => {
        await poPage.uploadQuotation(scenario.quotationFilePath);
      });

      // The RFQ's lines come over with no unit price (the real vendor quote isn't known
      // yet) — Confirm Order silently no-ops on a zero-total order, so fill them in first.
      await steps.run('RFQ', 'Set Unit Prices', async () => {
        await poPage.setLineUnitPrices(scenario.lines.map((line) => line.unitPrice));
      });

      // confirmOrder() already waits for "Create Bill" to appear as confirmation proof —
      // the statusbar always lists all three lifecycle labels regardless of which is
      // active, so checking its text would be a false positive.
      await steps.run('RFQ', 'Confirm Order', async () => {
        await poPage.confirmOrder();
        poId = poPage.getRecordId();
        expect(poId, 'PO record id could not be read from the URL').toBeGreaterThan(0);
      });

      await steps.run('Delivery', 'Validate', async () => {
        const deliveryPage = await poPage.openDelivery();
        await deliveryPage.validate();
      });

      await steps.run('Vendor Bill', 'Reopen Purchase Order', async () => {
        // openDelivery() navigated away from the PO via its smart button — return to it
        // before continuing the flow there.
        await poPage.openById(poId);
        await expect(page.getByRole('button', { name: 'Create Bill', exact: true }))
          .toBeVisible({ timeout: 15_000 });
      });

      let billPage!: Awaited<ReturnType<typeof poPage.createVendorBill>>;
      await steps.run('Vendor Bill', 'Create', async () => {
        billPage = await poPage.createVendorBill();
      });

      await steps.run('Vendor Bill', 'Confirm', async () => {
        await billPage.confirm();
      });

      await steps.run('Vendor Bill', 'Register Payment', async () => {
        await billPage.registerPayment();
      });

      // Cleanup — this instance's purchase.order model has no "active" field (a Studio
      // customization), so the standard archive() teardown isn't applicable here. The
      // order is left in place, identifiable by its "[TEST]" data for manual cleanup.
    } finally {
      steps.printSummary();
    }
  });
});
