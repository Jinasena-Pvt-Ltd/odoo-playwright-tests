import { today } from '../../../core/utils/DateHelper';
export const INVENTORY_TEST_CONFIG = {} as const;
export function getInventoryDates() { return { dateStart: today() }; }
