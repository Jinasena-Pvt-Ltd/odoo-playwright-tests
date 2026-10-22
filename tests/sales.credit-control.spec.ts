/**
 * Step 6 — Edge cases: Credit Limit control on Credit quotations.
 *
 * Which buttons Odoo shows on a saved Credit quotation depends on the customer's credit position:
 *   within limit, not overdue  → Confirm visible;  Request Credit Limit Approval and View Credit Limit Overdue Details hidden
 *   over the credit limit      → Confirm hidden;   Request Credit Limit Approval and View Credit Limit Overdue Details visible
 *   customer has overdue invoices → Confirm hidden and an overdue / credit-limit approval request is offered
 * Quotations are only saved, never confirmed; they are deleted again afterwards.
 *
 * Optional env: OVER_LIMIT_QUANTITY (default 1,000,000,000 — must exceed the credit limit at the product's price),
 *   CREDIT_CUSTOMER (within limit, no overdue; default "DIDULA MOTORES"),
 *   OVERDUE_CUSTOMER (a Credit customer with overdue invoices; found automatically when not set).
 */
import { test, expect } from '../src/core/fixtures/index';
import type { Page } from '@playwright/test';
import type { OdooRPC } from '../src/core/api/OdooRPC';
import { COMPANY, openSalesApp, switchCompany, createQuotation, headerButtons } from '../src/modules/sales/flows/flowHelpers';
import { deleteDraftQuotations } from '../src/modules/sales/flows/quotationCleanup';

const CREDIT_CUSTOMER = process.env.CREDIT_CUSTOMER ?? 'DIDULA MOTORES';
/** Large enough to exceed any realistic credit limit, whatever the customer's configured limit is. */
const OVER_LIMIT_QUANTITY = Number(process.env.OVER_LIMIT_QUANTITY ?? 1_000_000_000);

const REQUEST_APPROVAL = /^request credit limit approval$/i;
/** An overdue customer is held back by its own approval (Overdue and/or Credit Limit). */
const REQUEST_OVERDUE_OR_CREDIT = /^request .*(overdue|credit limit).* approval$/i;
const VIEW_OVERDUE = /^view credit limit overdue details$/i;
const CONFIRM = /^confirm$/i;

test.use({ actionTimeout: 20_000, navigationTimeout: 60_000, video: 'off', trace: 'off' });

/** A Credit customer that currently has overdue posted invoices, or null when there is none. */
async function findOverdueCreditCustomer(rpc: OdooRPC): Promise<string | null> {
  if (process.env.OVERDUE_CUSTOMER) return process.env.OVERDUE_CUSTOMER;
  const today = new Date().toISOString().slice(0, 10);
  const moves = await rpc.searchRead<{ partner_id: [number, string] | false }>('account.move', [
    ['move_type', '=', 'out_invoice'], ['state', '=', 'posted'],
    ['payment_state', 'in', ['not_paid', 'partial']], ['invoice_date_due', '<', today],
  ], ['partner_id'], { limit: 200, order: 'invoice_date_due' });
  const ids = [...new Set(moves.map(m => (m.partner_id ? m.partner_id[0] : 0)).filter(Boolean))];
  if (!ids.length) return null;
  const partners = await rpc.searchRead<{ name: string; x_studio_payment_method: string | false }>(
    'res.partner', [['id', 'in', ids], ['x_studio_payment_method', '=', 'Credit']], ['name', 'x_studio_payment_method'], { limit: 1 });
  return partners[0]?.name ?? null;
}

async function shown(page: Page): Promise<{ confirm: boolean; request: boolean; requestAny: boolean; overdue: boolean; all: string[] }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const texts = (await headerButtons(page)).map(b => b.text);
  return {
    confirm: texts.some(t => CONFIRM.test(t)),
    request: texts.some(t => REQUEST_APPROVAL.test(t)),
    requestAny: texts.some(t => REQUEST_OVERDUE_OR_CREDIT.test(t)),
    overdue: texts.some(t => VIEW_OVERDUE.test(t)),
    all: texts,
  };
}

test.describe('Sales credit limit control @module:sales @step:edge', () => {
  const created: string[] = [];

  test.beforeEach(async ({ page }) => {
    await openSalesApp(page);
    await switchCompany(page, COMPANY);
  });

  test.afterEach(async ({ rpc }) => {
    await deleteDraftQuotations(rpc, created.splice(0));
  });

  test('within the credit limit: Confirm is available, no approval needed', async ({ page }) => {
    test.setTimeout(180_000);
    created.push(await createQuotation(page, { customer: CREDIT_CUSTOMER, paymentType: 'Credit' }));
    const b = await shown(page);
    expect(b.confirm, `Confirm should be visible. Buttons: ${b.all.join(' | ')}`).toBe(true);
    expect(b.request, 'Request Credit Limit Approval should be hidden within the limit').toBe(false);
    expect(b.overdue, 'View Credit Limit Overdue Details should be hidden within the limit').toBe(false);
  });

  test('over the credit limit: Confirm is blocked, approval must be requested', async ({ page }) => {
    test.setTimeout(240_000);
    created.push(await createQuotation(page, {
      customer: CREDIT_CUSTOMER, paymentType: 'Credit', quantity: OVER_LIMIT_QUANTITY,
    }));
    const b = await shown(page);
    expect(b.confirm, `Confirm must be hidden above the credit limit. Buttons: ${b.all.join(' | ')}`).toBe(false);
    expect(b.request, 'Request Credit Limit Approval should be visible above the limit').toBe(true);
    expect(b.overdue, 'View Credit Limit Overdue Details should be visible above the limit').toBe(true);
  });

  test('customer with overdue invoices: Confirm is blocked, approval must be requested', async ({ page, rpc }) => {
    test.setTimeout(240_000);
    const overdueCustomer = await findOverdueCreditCustomer(rpc);
    if (!overdueCustomer) test.skip(true, 'No Credit customer with overdue invoices exists — nothing to check');

    created.push(await createQuotation(page, { customer: overdueCustomer!, paymentType: 'Credit' }));
    const b = await shown(page);
    expect(b.confirm, `${overdueCustomer} has overdue invoices, Confirm must be hidden. Buttons: ${b.all.join(' | ')}`).toBe(false);
    expect(b.requestAny, `An overdue / credit limit approval request should be offered. Buttons: ${b.all.join(' | ')}`).toBe(true);
  });
});
