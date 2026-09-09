import { today } from '../../../core/utils/DateHelper';

/**
 * Remaining pre-existing environment config referenced by sales tests.
 *
 * Customer is created fresh each run by the `salesMasterData` worker fixture (see
 * src/core/fixtures/salesMasterData.fixtures.ts). Product is deliberately NOT
 * fixture-created: pricing a brand-new product for the first time under a customer's
 * pricelist was found to hang (or take far longer than any reasonable timeout) on this
 * instance — confirmed by swapping in this established, already-priced product and
 * seeing order-line creation work reliably. Sales Team and Warehouse stay as
 * pre-existing config too: creating a Warehouse has real Odoo side effects
 * (auto-generated stock locations/routes/picking types) with no proven UI-archive path
 * in this repo yet. Quotation Type is a fixed Studio selection-widget enum value, not a
 * creatable record.
 */
export const SALES_TEST_CONFIG = {
  quotationType: 'Sales',
  // Separate field from Quotation Type (x_studio_order_payment_method) — confirmed via
  // live DOM inspection they are two independently-required Studio fields, not one
  // (a prior assumption that merged them was wrong; see SalesFormPage.setQuotationType
  // doc comment). Options on this instance: "Cash" or "Credit".
  orderPaymentType: 'Cash',
  salesTeam: 'Colombo Sales Centre',
  warehouse: 'JAM Warehouse Ekala- (JM-EK)',
  product: 'BALL BEARING 6202-2RS',
  // A second, DISTINCT product — needed wherever a test adds two order lines. Using the
  // same product for both lines was found to make Odoo merge/reuse the existing row
  // instead of creating a second one, silently dropping the second line.
  // NOT "CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S" (tried first): that product sits in
  // the generic "All" product category, which has no matching Analytic Account for this
  // order's Analytic Plan — adding it triggers a real Odoo error dialog ("Oh snap! ...
  // required analytic plan(s) have no matching account ... Product Group"), confirmed
  // live. This product shares BALL BEARING 6202-2RS's properly-configured category
  // (RM-GE-02-JAM) and was confirmed live to save with no such error.
  product2: 'BALL BEARING 6004',
} as const;

export function getSalesDates() {
  return { dateStart: today() };
}
