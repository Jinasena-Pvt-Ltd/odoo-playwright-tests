import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the purchase module */
// TODO: Add module-specific test configuration constants
export const PURCHASE_TEST_CONFIG = {} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getPurchaseDates() {
  const start = today();
  return { dateStart: start };
}
