/**
 * Step 2 — Business Logic for the purchase module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { PurchaseFormPage } from '../../pages/PurchasePage';
import { PurchaseRequisitionFormPage } from '../../pages/PurchaseRequisitionPage';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { PURCHASE_TEST_CONFIG } from '../../data/purchase.master-data';

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

    const orderId = formPage.getRecordId();
    if (orderId) {
      await rpc.archive('purchase.order', [orderId]);
    }
    await rpc.archive('res.partner', [vendorId]);
  });

  test('completes the Inventory Credit Purchase cycle: PR -> RFQ -> PO -> Delivery -> Vendor Bill -> Payment @e2e', async ({ page, rpc }) => {
    const scenario = PURCHASE_TEST_CONFIG.inventoryCreditPurchase;

    // 1. Purchase Requisition — created from the "Purchase Requisition MGMT" app.
    const prPage = new PurchaseRequisitionFormPage(page);
    await prPage.navigate();
    // "Local" is already the default selected value for a new requisition.
    await expect(prPage.fieldWidget('x_studio_type')).toContainText('Local');
    await prPage.warehouse.setValue(scenario.warehouse);
    await prPage.setRequestedDeliveryDate(scenario.requestedDeliveryDay);
    await prPage.requestedBy.setValue(scenario.requestedBy);
    for (const [index, line] of scenario.lines.entries()) {
      await prPage.addProductLine(line.product, line.quantity, index === scenario.lines.length - 1);
    }
    await prPage.save();

    await prPage.confirm();
    await prPage.requestApproval();
    await prPage.approve();
    await expect(page.locator('.o_statusbar_status')).toContainText('Approved');

    // 2. Create RFQ from the approved requisition (selects vendor + all lines in the wizard).
    // createRfqFromLines leaves the browser on the newly created RFQ's form.
    await prPage.createRfqFromLines(scenario.vendor);
    const poPage = new PurchaseFormPage(page);
    // The wizard's vendor selection is flaky about persisting to the created record — set
    // it directly on the RFQ if it didn't stick, using the same reliable path as the
    // "creates an RFQ" test above.
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

    // Prior to confirming, the vendor's quotation must be attached under the
    // "Documents" tab.
    await poPage.uploadQuotation(scenario.quotationFilePath);

    // 3. RFQ -> Purchase Order -> Delivery -> Vendor Bill -> Register Payment.
    // The RFQ's lines come over with no unit price (the real vendor quote isn't known
    // yet) — Confirm Order silently no-ops on a zero-total order, so fill them in first.
    await poPage.setLineUnitPrices(scenario.lines.map((line) => line.unitPrice));
    // confirmOrder() already waits for the "Confirm Order" button to disappear as
    // confirmation proof — the statusbar always lists all three lifecycle labels
    // regardless of which is active, so checking its text would be a false positive.
    await poPage.confirmOrder();
    const poId = poPage.getRecordId();

    const deliveryPage = await poPage.openDelivery();
    await deliveryPage.validate();

    // openDelivery() navigated away from the PO via its smart button — return to it
    // before continuing the flow there.
    await poPage.openById(poId);

    const billPage = await poPage.createVendorBill();
    await billPage.confirm();
    await billPage.registerPayment();

    // Cleanup — archive the created chain via RPC (teardown only, never as test actions).
    if (poId) {
      await rpc.archive('purchase.order', [poId]);
    }
  });
});
