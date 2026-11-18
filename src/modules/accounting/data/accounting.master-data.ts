import { today } from '../../../core/utils/DateHelper';
export const ACCOUNTING_TEST_CONFIG = {} as const;
export function getAccountingDates() { return { dateStart: today() }; }
