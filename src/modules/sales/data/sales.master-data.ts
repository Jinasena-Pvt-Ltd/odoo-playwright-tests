import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the sales module */
// TODO: Add module-specific test configuration constants
export const SALES_TEST_CONFIG = {} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getSalesDates() {
  const start = today();
  return { dateStart: start };
}
