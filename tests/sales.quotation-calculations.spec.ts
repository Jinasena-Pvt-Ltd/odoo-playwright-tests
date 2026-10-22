/**
 * Step 2 — Business logic: quotation amount calculations.
 *
 * Creates a Cash quotation with one product line at a known quantity and unit price, then checks that what Odoo
 * shows follows the arithmetic in SalesCalculations:
 *   1. line "Tax excl." = quantity × unit price × (1 − discount %)
 *   2. Untaxed Amount   = sum of the lines' Tax excl.
 *   3. Total            = Untaxed Amount + Taxes
 * (2 and 3 are checked on the stored sale.order amounts, read back by RPC: this form's totals panel is not a plain
 *  table, so the stored values are the reliable source.)
 * The draft quotation is deleted afterwards.
 *
 * Optional env: FLOW_CONTROL_CUSTOMER (default "abc").
 */
import { test, expect } from '../src/core/fixtures/index';
import { COMPANY, openSalesApp, switchCompany, createQuotation } from '../src/modules/sales/flows/flowHelpers';
import { deleteDraftQuotations } from '../src/modules/sales/flows/quotationCleanup';
import { parseAmount, lineSubtotal, quotationTotals, round2 } from '../src/modules/sales/calculations/SalesCalculations';

const CUSTOMER = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
const QUANTITY = 3;
const UNIT_PRICE = 250;
const TOLERANCE = 0.02;

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

test.describe('Sales quotation calculations @module:sales @step:business', () => {
  let orderNumber = '';

  test.afterEach(async ({ rpc }) => {
    await deleteDraftQuotations(rpc, [orderNumber]);
    orderNumber = '';
  });

  test('line, untaxed and total amounts follow the quantity × price arithmetic', async ({ page, rpc }) => {
    test.setTimeout(180_000);
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
    orderNumber = await createQuotation(page, {
      customer: CUSTOMER, paymentType: 'Cash', quantity: QUANTITY, unitPrice: UNIT_PRICE,
    });

    const row = page.locator('.o_data_row').first();
    const qty = parseAmount(await row.locator('[name="product_uom_qty"]').textContent());
    const price = parseAmount(await row.locator('[name="price_unit"]').textContent());
    const discount = parseAmount(await row.locator('[name="discount"]').textContent().catch(() => '0'));
    const shownSubtotal = parseAmount(await row.locator('[name="price_subtotal"]').textContent());
    expect(qty).toBe(QUANTITY);
    expect(price).toBe(UNIT_PRICE);

    // 1. line amount
    const expectedLine = lineSubtotal({ quantity: qty, unitPrice: price, discountPct: discount });
    expect(Math.abs(shownSubtotal - expectedLine), `line Tax excl. ${shownSubtotal} vs ${expectedLine}`).toBeLessThanOrEqual(TOLERANCE);

    // 2 + 3. stored totals
    const expected = quotationTotals([{ quantity: qty, unitPrice: price, discountPct: discount }]);
    const [stored] = await rpc.searchRead<{ amount_untaxed: number; amount_tax: number; amount_total: number }>(
      'sale.order', [['name', '=', orderNumber]], ['amount_untaxed', 'amount_tax', 'amount_total'], { limit: 1 });
    expect(Math.abs(stored.amount_untaxed - expected.untaxed), `Untaxed ${stored.amount_untaxed} vs ${expected.untaxed}`).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(stored.amount_total - round2(stored.amount_untaxed + stored.amount_tax)),
      `Total ${stored.amount_total} vs untaxed + tax ${stored.amount_untaxed + stored.amount_tax}`).toBeLessThanOrEqual(TOLERANCE);
  });
});
