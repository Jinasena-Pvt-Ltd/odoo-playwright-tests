import { today } from '../../../core/utils/DateHelper';

/**
 * Pre-existing environment master data referenced (not created) by sales tests —
 * these records/config values are expected to already exist in the target Odoo
 * instance's Sales module. Tests must treat their absence as config-dependent and
 * gracefully skip rather than fail (see SalesFormPage.selectIfExists/addOrderLines).
 */
export const SALES_TEST_CONFIG = {
  customer: 'Test Customer - Playwright 1',
  distributorCustomerGroup: 'DISTR',
  quotationType: 'Sales',
  salesTeam: 'Colombo Sales Centre',
  warehouse: 'JAM Warehouse Ekala- (JM-EK)',
  product1: 'CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S',
  product2: 'BALL BEARING 6202-2RS',
  tax18: 'VAT 18% (Sales)',
} as const;

export function getSalesDates() {
  return { dateStart: today() };
}
