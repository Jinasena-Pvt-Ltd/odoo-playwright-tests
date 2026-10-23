/**
 * Removes the draft quotations a test created, so validation / control checks leave no clutter in Odoo.
 * Quotations in draft / cancelled state are deleted; an order a test got confirmed by mistake is cancelled first.
 */
import type { OdooRPC } from '../../../core/api/OdooRPC';

export async function deleteDraftQuotations(rpc: OdooRPC, names: string[]): Promise<{ deleted: string[]; kept: string[] }> {
  const result = { deleted: [] as string[], kept: [] as string[] };
  const wanted = names.filter(n => /^S\d+/.test(n));
  if (!wanted.length) return result;
  const rows = await rpc.searchRead<{ id: number; name: string; state: string }>(
    'sale.order', [['name', 'in', wanted]], ['name', 'state']);
  for (const r of rows) {
    // A test that wrongly got an order confirmed (e.g. zero unit price) must not leave it open: cancel it first.
    if (r.state === 'sale') {
      // A confirmed order is locked; unlock it, then Odoo 17 cancels it through the "sale.order.cancel" confirmation wizard
      await rpc.callMethod('sale.order', 'action_unlock', [[r.id]]).catch(() => false);
      const wizard = await rpc.callMethod<number>('sale.order.cancel', 'create', [{ order_id: r.id }]).catch(() => 0);
      if (wizard) await rpc.callMethod('sale.order.cancel', 'action_cancel', [[wizard]]).catch(() => false);
      else await rpc.callMethod('sale.order', 'action_cancel', [[r.id]]).catch(() => false);
    }
    const [cur] = await rpc.searchRead<{ state: string }>('sale.order', [['id', '=', r.id]], ['state']);
    if (cur && ['draft', 'sent', 'cancel'].includes(cur.state)) {
      const ok = await rpc.unlink('sale.order', [r.id]).then(() => true).catch(() => false);
      (ok ? result.deleted : result.kept).push(r.name);
    } else {
      result.kept.push(r.name);
    }
  }
  return result;
}

/** Reads the quotation number currently shown in the form title ("" when still New). */
export async function currentQuotationNumber(page: import('@playwright/test').Page): Promise<string> {
  const t = ((await page.locator('.o_form_view [name="name"]').first().textContent().catch(() => '')) ?? '').trim();
  return /^S\d+/.test(t) ? t : '';
}
