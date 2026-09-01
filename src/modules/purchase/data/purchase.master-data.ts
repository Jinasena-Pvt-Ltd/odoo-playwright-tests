import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the purchase module */
export const PURCHASE_TEST_CONFIG = {
  inventoryCreditPurchase: {
    warehouse: 'JAM Warehouse Ekala- (JM-EK): Receipts',
    requestedBy: 'Apsara Madubashini - BR-KU',
    vendor: 'A C PAUL & CO LTD',
    lines: [
      { product: '02BB 023', quantity: 10, unitPrice: 500 },
      { product: '02BB 025', quantity: 15, unitPrice: 600 },
    ],
    quotationFilePath: 'D:\\My Documents\\#Dummy Documents\\Quotation.pdf',
    requestedDeliveryDay: 22, // 22/08/2026 — see setRequestedDeliveryDate(day)
  },
} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getPurchaseDates() {
  const start = today();
  return { dateStart: start };
}
