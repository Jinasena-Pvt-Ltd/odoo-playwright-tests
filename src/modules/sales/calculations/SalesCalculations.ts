/**
 * Sales calculation helpers — the arithmetic Odoo applies to a quotation, used to verify what the UI shows.
 */

export interface QuotationLine {
  quantity: number;
  unitPrice: number;
  /** Discount in percent (0–100). */
  discountPct?: number;
  /** Tax rate in percent applied to this line (0 when untaxed). */
  taxPct?: number;
}

export interface QuotationTotals {
  untaxed: number;
  tax: number;
  total: number;
}

/** Parses an Odoo money/number string ("Rs 1,200.0000", "-5.00") to a number; 0 for empty/NaN. */
export function parseAmount(text: string | null | undefined): number {
  if (!text) return 0;
  return parseFloat(text.replace(/[^0-9.-]/g, '')) || 0;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Tax-excluded amount of one line: quantity × unit price × (1 − discount%). */
export function lineSubtotal(line: QuotationLine): number {
  return round2(line.quantity * line.unitPrice * (1 - (line.discountPct ?? 0) / 100));
}

/** Untaxed amount, tax and total for a set of lines. */
export function quotationTotals(lines: QuotationLine[]): QuotationTotals {
  const untaxed = round2(lines.reduce((sum, l) => sum + lineSubtotal(l), 0));
  const tax = round2(lines.reduce((sum, l) => sum + lineSubtotal(l) * ((l.taxPct ?? 0) / 100), 0));
  return { untaxed, tax, total: round2(untaxed + tax) };
}

/**
 * Credit check used by the Credit Limit control:
 * the sale fits when current balance + this sale does not exceed the credit limit.
 */
export function withinCreditLimit(currentBalance: number, thisSale: number, creditLimit: number): boolean {
  return currentBalance + thisSale <= creditLimit;
}

/** Margin % of a line: (net price − cost) / net price × 100, where net price is unit price after discount. */
export function marginPct(unitPrice: number, cost: number, discountPct = 0): number {
  const net = unitPrice * (1 - discountPct / 100);
  return net === 0 ? 0 : ((net - cost) / net) * 100;
}
