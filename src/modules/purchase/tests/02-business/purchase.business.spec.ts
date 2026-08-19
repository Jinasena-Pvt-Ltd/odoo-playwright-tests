/**
 * Step 2 — Business Logic for the purchase module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { PurchaseFormPage } from '../../pages/PurchasePage';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

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

    const [, orderId] = page.url().match(/\/purchase\/(\d+)/) ?? [];
    if (orderId) {
      await rpc.archive('purchase.order', [Number(orderId)]);
    }
    await rpc.archive('res.partner', [vendorId]);
  });
});
