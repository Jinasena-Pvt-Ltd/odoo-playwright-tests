/**
 * Step 2 — Business flow: Cash and Credit sales for every Customer Group.
 *
 * For each Customer Group read from Odoo this creates a Cash customer and a Credit customer
 * (via RPC, as setup), then walks the order by UI, step by step:
 *   Cash:   quotation → confirm → delivery → invoice → cash payment
 *   Credit: quotation → request/give approvals → confirm → delivery → invoice
 * Every Odoo error dialog / warning is recorded as a bug instead of stopping the run;
 * the result is reports/sales-flow-bugs-<date>.md (+ .json).
 *
 * Creates REAL records (customers, orders, deliveries, invoices, payments) → opt-in:
 *   RUN_SALES_FLOWS=true npx playwright test sales.customer-flows --project=setup --project=admin
 * Optional: FLOW_GROUPS="DISTR,CAC" to limit groups; ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD
 * in .env for a separate approver login.
 */
import { test } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import type { OdooRPC } from '../../../../core/api/OdooRPC';
import { BugLog } from '../../flows/BugLog';
import {
  COMPANY, openSalesApp, switchCompany, createQuotation, approveAndConfirm,
  validateDelivery, unlockOrder, createInvoice, registerCashPayment, visibleHeaderButtons,
} from '../../flows/flowHelpers';

interface CustomerGroup { id: number; name: string }

const GROUP_MODEL = 'x_customer_group';
/** Company the flows run in; set by readGroups(). Customers are created in this company's context. */
let activeCompanyId = 0;
/** Receivable / payable accounts copied from a known-good customer, because RPC-created partners get none. */
let accountDefaults: Record<string, unknown> = {};
const GROUP_FIELD = 'x_studio_customer_group';

/**
 * Reads the Customer Groups of the active company (the groups are per company, restricted by a record rule),
 * and notes name differences against the other companies' groups as an observation.
 */
async function readGroups(
  rpc: OdooRPC, bugs: BugLog,
): Promise<{ groups: CustomerGroup[]; foreign: CustomerGroup | null }> {
  const [company] = await rpc.searchRead<{ id: number }>('res.company', [['name', '=', COMPANY]], ['id'], { limit: 1 });
  if (!company) throw new Error(`Company "${COMPANY}" not found.`);
  activeCompanyId = company.id;
  const ref = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
  const [refPartner] = await rpc.callMethod<Array<Record<string, unknown>>>('res.partner', 'search_read',
    [[['name', '=', ref]]], {
      fields: ['property_account_receivable_id', 'property_account_payable_id'], limit: 1,
      context: { allowed_company_ids: [company.id], company_id: company.id },
    }).catch(() => []);
  const idOf = (v: unknown) => (Array.isArray(v) ? (v[0] as number) : false);
  if (refPartner) {
    accountDefaults = {
      property_account_receivable_id: idOf(refPartner.property_account_receivable_id),
      property_account_payable_id: idOf(refPartner.property_account_payable_id),
    };
  }
  const rows = await rpc.searchRead<{ id: number; display_name: string; x_studio_company_id: [number, string] | false }>(
    GROUP_MODEL, [['x_active', '=', true]], ['display_name', 'x_studio_company_id'], { order: 'id' });
  const mine = rows.filter(r => r.x_studio_company_id && r.x_studio_company_id[0] === company.id);
  const others = rows.filter(r => !r.x_studio_company_id || r.x_studio_company_id[0] !== company.id);

  const myNames = new Set(mine.map(r => r.display_name));
  const otherNames = new Set(others.map(r => r.display_name));
  const onlyMine = [...myNames].filter(n => !otherNames.has(n));
  const onlyOthers = [...otherNames].filter(n => !myNames.has(n));
  if (onlyMine.length || onlyOthers.length) {
    bugs.add({
      group: 'All', flow: 'Setup', step: 'Read Customer Groups', severity: 'Info',
      title: 'Customer Group names differ between companies',
      detail: `Groups exist per company. Only in "${COMPANY}": ${onlyMine.join(', ') || '-'}. ` +
        `Only in other companies: ${onlyOthers.join(', ') || '-'}.`,
    });
  }
  const dup = [...myNames].filter(n => mine.filter(r => r.display_name === n).length > 1);
  if (dup.length) {
    bugs.add({
      group: 'All', flow: 'Setup', step: 'Read Customer Groups', severity: 'Low',
      title: 'Duplicate Customer Group names inside one company',
      detail: `Same company has the same group name more than once: ${dup.join(', ')}.`,
    });
  }

  let groups = [...myNames].map(n => ({ id: mine.find(r => r.display_name === n)!.id, name: n }));
  const only = (process.env.FLOW_GROUPS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (only.length) groups = groups.filter(g => only.includes(g.name));
  const f = others.find(r => myNames.has(r.display_name));
  return { groups, foreign: f ? { id: f.id, name: `${f.display_name} (other company)` } : null };
}

/** Creates the partner in the active company's context (so company-dependent accounts/terms are stored for it). */
async function createPartner(rpc: OdooRPC, vals: Record<string, unknown>): Promise<number> {
  return rpc.callMethod<number>('res.partner', 'create', [{ ...accountDefaults, ...vals }], {
    context: { allowed_company_ids: [activeCompanyId], company_id: activeCompanyId },
  });
}

/** Creates a customer via RPC; if the server requires Bank Guarantee data for the group, records that and retries with it. */
async function createCustomer(
  rpc: OdooRPC, bugs: BugLog, group: CustomerGroup, kind: 'Cash' | 'Credit',
): Promise<string | null> {
  const name = uniqueName(`${group.name} ${kind}`);
  const base: Record<string, unknown> = {
    name, is_company: true, customer_rank: 1,
    [GROUP_FIELD]: group.id,
    x_studio_payment_method: kind,
    ...(kind === 'Credit' ? { use_partner_credit_limit: true, credit_limit: 1 } : {}),
  };
  const ctx = { group: group.name, flow: `${kind} customer`, step: 'Create customer' };
  try {
    await createPartner(rpc, base);
    bugs.ok(`${group.name} / ${kind} customer / create customer`);
    return name;
  } catch (e1) {
    const msg1 = e1 instanceof Error ? e1.message : String(e1);
    bugs.add({ ...ctx, severity: 'Medium', title: 'Customer cannot be created with only the basic fields',
      detail: msg1.slice(0, 600) });
    try {
      const fields = await rpc.callMethod<Record<string, { string: string; type: string }>>(
        'res.partner', 'fields_get', [], { attributes: ['string', 'type'] });
      const expiry = Object.entries(fields).find(([, v]) => /guarantee/i.test(v.string) && /expir|valid.*date|date/i.test(v.string) && v.type === 'date')?.[0]
        ?? Object.entries(fields).find(([, v]) => /expir/i.test(v.string) && v.type === 'date')?.[0];
      const next = new Date(); next.setFullYear(next.getFullYear() + 1);
      await createPartner(rpc, {
        ...base,
        x_studio_mandatory_bank_guarantee: true,
        x_studio_bank_guarantee_amount: 5_000_000,
        ...(expiry ? { [expiry]: next.toISOString().slice(0, 10) } : {}),
      });
      bugs.ok(`${group.name} / ${kind} customer / create customer (with bank guarantee)`);
      return name;
    } catch (e2) {
      bugs.add({ ...ctx, severity: 'High', title: 'Customer cannot be created even with Bank Guarantee data',
        detail: (e2 instanceof Error ? e2.message : String(e2)).slice(0, 600) });
      return null;
    }
  }
}

test.describe('Sales Cash & Credit flows by Customer Group @module:sales @step:business @e2e', () => {
  test.skip(process.env.RUN_SALES_FLOWS !== 'true',
    'Creates real customers/orders/invoices — set RUN_SALES_FLOWS=true to run');

  test('walk Cash and Credit flow for every Customer Group and collect bugs', async ({ page, browser, rpc }) => {
    test.setTimeout(0); // many groups × two UI flows; progress is written after every group
    const bugs = new BugLog();

    try {
      const { groups, foreign } = await readGroups(rpc, bugs);
      await page.goto('/web');
      await openSalesApp(page);
      await switchCompany(page, COMPANY);

      const cashFlow = async (label: string, customer: string) => {
        const c = { group: label, flow: 'Cash' };
        let orderUrl = '';
        let ok = await bugs.step(page, c, '1 Create quotation (Cash)', async () => {
          await createQuotation(page, { customer, paymentType: 'Cash' });
        });
        if (ok) ok = await bugs.step(page, c, '2 Confirm order', async () => {
          await approveAndConfirm(page, browser);
          orderUrl = page.url();
        });
        if (ok) ok = await bugs.step(page, c, '3 Validate delivery', async () => {
          try { await validateDelivery(page); }
          catch (e) {
            // Known issue: a locked order blocks the analytic distribution update. Log it, unlock, retry once.
            const text = e instanceof Error ? e.message : String(e);
            if (!/locked order|analytic distribution/i.test(text)) throw e;
            bugs.add({ ...c, step: '3 Validate delivery', severity: 'High',
              title: 'Delivery validation blocked: Analytic Distribution on a locked order', detail: text.slice(0, 600) });
            await page.goto(orderUrl, { waitUntil: 'domcontentloaded' });
            if (!(await unlockOrder(page))) throw e;
            await validateDelivery(page);
          }
        });
        if (ok) ok = await bugs.step(page, c, '4 Create invoice', async () => { await createInvoice(page); });
        if (ok) await bugs.step(page, c, '5 Register cash payment', async () => { await registerCashPayment(page); });
      };

      const creditFlow = async (label: string, customer: string) => {
        const c = { group: label, flow: 'Credit' };
        let ok = await bugs.step(page, c, '1 Create quotation (Credit)', async () => {
          await createQuotation(page, { customer, paymentType: 'Credit' });
        });
        if (ok) {
          const buttons = await visibleHeaderButtons(page);
          bugs.ok(`${label} / Credit / buttons before approval: ${buttons.join(' | ')}`);
        }
        if (ok) ok = await bugs.step(page, c, '2 Give approvals and confirm', async () => {
          const r = await approveAndConfirm(page, browser);
          bugs.ok(`${label} / Credit / approvals taken: ${r.taken.join(', ') || 'none needed'}`);
        });
        if (ok) ok = await bugs.step(page, c, '3 Validate delivery', async () => { await validateDelivery(page); });
        if (ok) await bugs.step(page, c, '4 Create invoice', async () => { await createInvoice(page); });
      };

      // Control run: an existing, known-good customer (used by the recorded tour). If the same step also fails here,
      // the problem is in the system, not in the freshly created test customers.
      const control = process.env.FLOW_CONTROL_CUSTOMER ?? 'abc';
      if (control !== 'none' && process.env.FLOW_NO_EXTRAS !== 'true') {
        await cashFlow(`Control (existing customer "${control}")`, control);
        bugs.writeReports();
      }

      // Cross-company check: a shared customer whose Customer Group belongs to another company.
      if (foreign && process.env.FLOW_NO_EXTRAS !== 'true') {
        const name = await createCustomer(rpc, bugs, foreign, 'Cash');
        if (name) {
          await bugs.step(page, { group: foreign.name, flow: 'Cross-company check' },
            'Select a customer whose Customer Group is of another company on a quotation', async () => {
              await createQuotation(page, { customer: name, paymentType: 'Cash' });
            });
        }
      }

      for (const group of groups) {
        const cashCustomer = await createCustomer(rpc, bugs, group, 'Cash');
        if (cashCustomer) await cashFlow(group.name, cashCustomer);
        const creditCustomer = await createCustomer(rpc, bugs, group, 'Credit');
        if (creditCustomer) await creditFlow(group.name, creditCustomer);
        bugs.writeReports(); // keep partial results if a later group crashes the run
      }
    } finally {
      const { md } = bugs.writeReports();
      await test.info().attach('sales-flow-bugs.md', { path: md, contentType: 'text/markdown' }).catch(() => {});
    }
  });
});
