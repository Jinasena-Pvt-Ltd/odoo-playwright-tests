import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the helpdesk module */
// TODO: Add module-specific test configuration constants
export const HELPDESK_TEST_CONFIG = {} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getHelpdeskDates() {
  const start = today();
  return { dateStart: start };
}
