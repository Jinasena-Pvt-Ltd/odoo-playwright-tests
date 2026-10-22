/**
 * Removes the draft quotations a test created, so validation / control checks leave no clutter in Odoo.
 * Only quotations in draft or cancelled state can be deleted; anything already confirmed is reported, not touched.
 */
import type { OdooRPC } from '../../../core/api/OdooRPC';

export async function deleteDraftQuotations(rpc: OdooRPC, names: string[]): Promise<{ deleted: string[]; kept: string[] }> {
  const result = { deleted: [] as string[], kept: [] as string[] };
  const wanted = names.filter(n => /^S\d+/.test(n));
  if (!wanted.length) return result;
  const rows = await rpc.searchRead<{ id: number; name: string; state: string }>(
    'sale.order', [['name', 'in', wanted]], ['name', 'state']);
  const deletable = rows.filter(r => ['draft', 'sent', 'cancel'].includes(r.state));
  if (deletable.length) {
    await rpc.unlink('sale.order', deletable.map(r => r.id)).catch(() => false);
    result.deleted.push(...deletable.map(r => r.name));
  }
  result.kept.push(...rows.filter(r => !deletable.includes(r)).map(r => r.name));
  return result;
}

/** Reads the quotation number currently shown in the form title ("" when still New). */
export async function currentQuotationNumber(page: import('@playwright/test').Page): Promise<string> {
  const t = ((await page.locator('.o_form_view [name="name"]').first().textContent().catch(() => '')) ?? '').trim();
  return /^S\d+/.test(t) ? t : '';
}
