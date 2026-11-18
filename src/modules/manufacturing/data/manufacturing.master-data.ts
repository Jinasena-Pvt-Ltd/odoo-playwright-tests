import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the manufacturing module */
// TODO: Add module-specific test configuration constants
export const MANUFACTURING_TEST_CONFIG = {} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getManufacturingDates() {
  const start = today();
  return { dateStart: start };
}
