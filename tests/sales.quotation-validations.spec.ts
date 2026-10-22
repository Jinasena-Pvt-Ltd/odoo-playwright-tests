/**
 * Step 5 — Validations: does Odoo stop a quotation that must not be accepted?
 *
 * A. Required header fields (table-driven): on an otherwise complete quotation one header field is emptied and
 *    Save is pressed. Expected: Odoo blocks the save (required-field error / disabled Save).
 *    'not-blankable' (the field is read-only / auto-filled and cannot be emptied) also passes — the user cannot
 *    leave it blank. Only 'saved' is a failure; the stray quotation is deleted again.
 * B. Order lines: a line with zero quantity or zero unit price must not be confirmable.
 *    Part B can leave a real (confirmed) order behind when Odoo has no such control, so it is opt-in:
 *    RUN_SALES_FLOWS=true.
 *
 * Optional env: FLOW_CONTROL_CUSTOMER (cash customer, default "abc"), CREDIT_CUSTOMER (default "DIDULA MOTORES").
 */
import { test, expect } from '../src/core/fixtures/index';
import {
  COMPANY, BLANK_FIELDS, BlankField, openSalesApp, switchCompany, createQuotation,
  blankFieldAndTrySave, tryConfirmBadOrder,
} from '../src/modules/sales/flows/flowHelpers';
import { deleteDraftQuotations, currentQuotationNumber } from '../src/modules/sales/flows/quotationCleanup';

const CASH_CUSTOMER = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
const CREDIT_CUSTOMER = process.env.CREDIT_CUSTOMER ?? 'DIDULA MOTORES';

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

interface FieldCase { type: 'Cash' | 'Credit'; customer: string; fields: BlankField[] }

const FIELD_CASES: FieldCase[] = [
  { type: 'Cash', customer: CASH_CUSTOMER, fields: BLANK_FIELDS },
  // Credit orders: the fields that differ in meaning for a credit sale.
  { type: 'Credit', customer: CREDIT_CUSTOMER, fields: BLANK_FIELDS.filter(f => ['partner_id', 'x_studio_order_payment_method', 'payment_term_id'].includes(f.name)) },
];

test.describe('Sales quotation validations @module:sales @step:validations', () => {
  const created: string[] = [];

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test.afterEach(async ({ rpc }) => {
    const names = created.splice(0);
    const { kept } = await deleteDraftQuotations(rpc, names);
    if (kept.length) test.info().annotations.push({ type: 'left-behind', description: `Not deletable: ${kept.join(', ')}` });
  });

  // ── A. Required header fields ────────────────────────────────────────────────
  for (const c of FIELD_CASES) {
    test.describe(`${c.type} quotation: required fields`, () => {
      for (const f of c.fields) {
        test(`blank ${f.label} cannot be saved (${c.type})`, async ({ page }) => {
          test.setTimeout(180_000);
          await createQuotation(page, { customer: c.customer, paymentType: c.type, save: false });
          const result = await blankFieldAndTrySave(page, f);

          if (result === 'saved') created.push(await currentQuotationNumber(page));
          if (result === 'field-not-shown') test.skip(true, `${f.label} is not shown on the form in this configuration`);

          test.info().annotations.push({ type: 'outcome', description: `${f.label}: ${result}` });
          await test.step(`Odoo blocks the save when ${f.label} is blank (result: ${result})`, async () => {
            expect(result, `Odoo saved a ${c.type} quotation with a blank ${f.label} — the field should be mandatory`)
              .not.toBe('saved');
          });
        });
      }
    });
  }

  // ── B. Order lines ───────────────────────────────────────────────────────────
  test.describe('order lines: confirm blocked for invalid lines', () => {
    test.skip(process.env.RUN_SALES_FLOWS !== 'true',
      'May leave a confirmed order if Odoo has no such control — set RUN_SALES_FLOWS=true to run');

    // The server sometimes drops requests late in a long run ("Odoo did not load"); one retry separates that from a real failure.
    test.describe.configure({ retries: 1 });

    const BAD_LINES = [
      { what: 'zero quantity', opts: { quantity: 0 } },
      { what: 'zero unit price', opts: { unitPrice: 0 } },
    ];

    for (const bad of BAD_LINES) {
      test(`quotation with ${bad.what} cannot be confirmed`, async ({ page }) => {
        test.setTimeout(180_000);
        const number = await createQuotation(page, { customer: CASH_CUSTOMER, paymentType: 'Cash', ...bad.opts });
        created.push(number);

        const outcome = await tryConfirmBadOrder(page);
        test.info().annotations.push({ type: 'outcome', description: `${bad.what}: ${outcome}` });
        await test.step(`Confirm is hidden or blocked (result: ${outcome})`, async () => {
          expect(outcome, `${number}: Odoo confirmed an order with ${bad.what} — Confirm must be hidden or blocked`)
            .not.toBe('confirmed');
        });
      });
    }
  });
});
