/** Pure helpers for Sales quotation maths. No Odoo access here. */

/** Parses an Odoo money/percent string such as "1,200.0000 Rs" or "22.90%" into a number. */
export function parseAmount(text: string | null | undefined): number {
  if (!text) return 0;
  return parseFloat(text.replace(/[^0-9.-]/g, '')) || 0;
}

/** Net amount of a line before tax: qty × unit price × (1 − discount%). */
export function lineNet(qty: number, unitPrice: number, discountPct = 0): number {
  return qty * unitPrice * (1 - discountPct / 100);
}

/** Margin % = (net − cost) / net × 100. Returns 0 when net is 0. */
export function marginPct(net: number, cost: number): number {
  return net !== 0 ? ((net - cost) / net) * 100 : 0;
}

/** VAT amount for a taxable base at `ratePct` percent. */
export function vatAmount(taxable: number, ratePct: number): number {
  return (taxable * ratePct) / 100;
}

export function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/** True when two money values differ by no more than `tolerance`. */
export function approxEqual(a: number, b: number, tolerance = 0.02): boolean {
  return Math.abs(a - b) <= tolerance;
}
