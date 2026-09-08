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
  salesTeam: 'Colombo Sales Centre',
  warehouse: 'JAM Warehouse Ekala- (JM-EK)',
  product: 'BALL BEARING 6202-2RS',
} as const;

export function getSalesDates() {
  return { dateStart: today() };
}
