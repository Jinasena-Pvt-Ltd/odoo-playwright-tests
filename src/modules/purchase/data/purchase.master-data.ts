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

  inventoryCashPurchase: {
    warehouse: 'JAM Warehouse Ekala- (JM-EK): Receipts',
    requestedBy: 'Apsara Madubashini - BR-KU',
    vendor: 'JINASENA (PVT) LTD - CASH PURCHASES',
    // Same products/quantities as inventoryCreditPurchase; cashUnitPrice is entered on
    // the Cash Purchase form, poUnitPrice is the "actual purchase" price entered on the
    // resulting RFQ afterwards (slightly different, as real vendor prices may differ).
    lines: [
      { product: '02BB 023', quantity: 10, cashUnitPrice: 500, poUnitPrice: 510 },
      { product: '02BB 025', quantity: 15, cashUnitPrice: 600, poUnitPrice: 610 },
    ],
    quotationFilePath: 'D:\\My Documents\\#Dummy Documents\\Quotation.pdf',
    requestedDeliveryDay: 22,
    // Deliberately higher than the auto-computed total (10*500 + 15*600 = 14,000) per
    // the flow's "enter a higher amount" instruction.
    issuedAmount: 15000,
    supplierInvoiceNumber: 'SUP_INV_123',
  },
} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function getPurchaseDates() {
  const start = today();
  return { dateStart: start };
}
