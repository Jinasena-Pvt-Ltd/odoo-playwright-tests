import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the imports module */
// TODO: Add module-specific test configuration constants
export const IMPORTS_TEST_CONFIG = {} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getImportsDates() {
  const start = today();
  return { dateStart: start };
}
