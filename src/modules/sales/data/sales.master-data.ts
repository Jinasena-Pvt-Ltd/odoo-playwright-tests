import { today } from '../../../core/utils/DateHelper';
export const SALES_TEST_CONFIG = {} as const;
export function getSalesDates() { return { dateStart: today() }; }
