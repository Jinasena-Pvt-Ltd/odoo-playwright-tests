/**
 * Business calculation helpers for the Sales module — pure functions mirroring
 * the arithmetic Odoo's `sale.order` performs, so tests can assert UI-read
 * values against an independently-computed expectation.
 */

export interface OrderLineAmounts {
  quantity: number;
  unitPrice: number;
  /** Percentage (e.g. 18 for 18%), or 0 when the line is untaxed. */
  taxRatePercent: number;
}

/** Net amount ("Tax excl.") for a single order line: Qty × Unit Price. */
export function computeLineNetAmount(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

/** Tax amount for a single line: Tax excl. × tax rate %. */
export function computeLineTaxAmount(netAmount: number, taxRatePercent: number): number {
  return (netAmount * taxRatePercent) / 100;
}

/** "Untaxed Amount" grand total: sum of every line's Tax excl. value. */
export function computeUntaxedAmount(lines: { netAmount: number }[]): number {
  return lines.reduce((sum, line) => sum + line.netAmount, 0);
}

/** Total tax grand total: sum of every line's computed tax amount. */
export function computeTotalTax(lines: OrderLineAmounts[]): number {
  return lines.reduce((sum, line) => {
    const netAmount = computeLineNetAmount(line.quantity, line.unitPrice);
    return sum + computeLineTaxAmount(netAmount, line.taxRatePercent);
  }, 0);
}

/** Grand Total: Untaxed Amount + Total Tax. */
export function computeGrandTotal(untaxedAmount: number, totalTax: number): number {
  return untaxedAmount + totalTax;
}

/**
 * Margin % for a single order line:
 *   NetAmount = UnitPrice - (UnitPrice × Discount%)
 *   Margin%   = (NetAmount - Cost) / NetAmount × 100
 */
export function computeMarginPercent(unitPrice: number, discountPercent: number, cost: number): number {
  const discountAmount = unitPrice * (discountPercent / 100);
  const netAmount = unitPrice - discountAmount;
  if (netAmount === 0) return 0;
  return ((netAmount - cost) / netAmount) * 100;
}

/** True when a line's margin falls below the configured minimum sales margin. */
export function isBelowMinimumMargin(marginPercent: number, minimumMarginPercent: number): boolean {
  return marginPercent < minimumMarginPercent;
}

/** Combined balance if a new sale is confirmed: current overdue balance + this sale's total. */
export function computeCombinedBalance(currentBalance: number, thisSaleTotal: number): number {
  return currentBalance + thisSaleTotal;
}

/** True when the combined balance stays within the customer's credit limit. */
export function isWithinCreditLimit(combinedBalance: number, creditLimit: number): boolean {
  return combinedBalance <= creditLimit;
}

/** True when two monetary values match within a small rounding tolerance (default 0.02). */
export function isWithinTolerance(calculated: number, actual: number, tolerance = 0.02): boolean {
  return Math.abs(calculated - actual) <= tolerance;
}

/** Parses Odoo-formatted currency/number text (e.g. "1,234.56") into a plain number. */
export function parseAmount(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}
