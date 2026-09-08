import { today } from '../../../core/utils/DateHelper';

/**
 * Remaining pre-existing environment config referenced by sales tests.
 *
 * Customer and Products are no longer listed here — they're created fresh each run
 * by the `salesMasterData` worker fixture (see src/core/fixtures/salesMasterData.fixtures.ts)
 * and consumed via that fixture instead. Sales Team and Warehouse stay as pre-existing
 * config by deliberate choice: creating a Warehouse has real Odoo side effects
 * (auto-generated stock locations/routes/picking types) with no proven UI-archive path
 * in this repo yet, so it isn't safe to create-and-tear-down per run. Quotation Type is
 * a fixed Studio selection-widget enum value, not a creatable record.
 */
export const SALES_TEST_CONFIG = {
  quotationType: 'Sales',
  salesTeam: 'Colombo Sales Centre',
  warehouse: 'JAM Warehouse Ekala- (JM-EK)',
} as const;

export function getSalesDates() {
  return { dateStart: today() };
}
