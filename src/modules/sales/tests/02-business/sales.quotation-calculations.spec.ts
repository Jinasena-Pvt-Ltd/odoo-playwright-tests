/**
 * Step 2 — Business logic: quotation amount calculations.
 *
 * Creates a Cash quotation with one product line at a known quantity and unit price, then checks that what Odoo
 * shows follows the arithmetic in SalesCalculations:
 *   1. line "Tax excl." = quantity × unit price × (1 − discount %)
 *   2. Untaxed Amount   = sum of the lines' Tax excl.
 *   3. Total            = Untaxed Amount + taxes shown in the totals panel
 *   4. the UI totals equal the stored sale.order amounts (read back by RPC)
 * The draft quotation is deleted afterwards.
 *
 * Optional env: FLOW_CONTROL_CUSTOMER (default "abc").
 */
import { test, expect } from '../../../../core/fixtures/index';
import type { Page } from '@playwright/test';
import { COMPANY, openSalesApp, switchCompany, createQuotation } from '../../flows/flowHelpers';
import { deleteDraftQuotations } from '../../flows/quotationCleanup';
import { parseAmount, lineSubtotal, quotationTotals, round2 } from '../../calculations/SalesCalculations';

const CUSTOMER = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
const QUANTITY = 3;
const UNIT_PRICE = 250;
const TOLERANCE = 0.02;

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

interface ShownTotals { untaxed: number; taxes: number; total: number }

/** Reads the totals panel; labels carry CSS-injected colons, so match on words only. */
async function readTotals(page: Page): Promise<ShownTotals> {
  const table = page.locator('table').filter({ hasText: /Untaxed Amount/i }).last();
  await expect(table).toBeVisible({ timeout: 15_000 });
  await table.scrollIntoViewIfNeeded();
  const rows = await table.locator('tr').evaluateAll(trs => trs.map(tr => ({
    label: (tr.querySelector('td, th')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    value: (tr.querySelector('td:last-child')?.textContent ?? '').trim(),
  })));
  let untaxed = 0; let total = 0; let taxes = 0;
  for (const r of rows) {
    if (/untaxed amount/i.test(r.label)) untaxed = parseAmount(r.value);
    else if (/^total\b/i.test(r.label)) total = parseAmount(r.value);
    else if (r.label && /\d/.test(r.value)) taxes += parseAmount(r.value);
  }
  return { untaxed, taxes: round2(taxes), total };
}

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

    // 2 + 3. totals panel
    const shown = await readTotals(page);
    const expected = quotationTotals([{ quantity: qty, unitPrice: price, discountPct: discount }]);
    expect(Math.abs(shown.untaxed - expected.untaxed), `Untaxed ${shown.untaxed} vs ${expected.untaxed}`).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(shown.total - round2(shown.untaxed + shown.taxes)), `Total ${shown.total} vs untaxed + taxes ${shown.untaxed + shown.taxes}`).toBeLessThanOrEqual(TOLERANCE);

    // 4. stored amounts
    const [stored] = await rpc.searchRead<{ amount_untaxed: number; amount_total: number }>(
      'sale.order', [['name', '=', orderNumber]], ['amount_untaxed', 'amount_total'], { limit: 1 });
    expect(Math.abs(stored.amount_untaxed - shown.untaxed)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(stored.amount_total - shown.total)).toBeLessThanOrEqual(TOLERANCE);
  });
});
