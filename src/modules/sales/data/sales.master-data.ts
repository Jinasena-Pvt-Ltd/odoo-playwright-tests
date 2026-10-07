/**
 * Existing Odoo master data the Sales tests SELECT (they never create these records).
 * Each value can be overridden from .env, e.g. SALES_CUSTOMER="My Customer".
 * These records must exist in the target Odoo database — see notes/sales.notes.md.
 */
export const SALES_MASTER_DATA = {
  company: process.env.SALES_COMPANY ?? 'Jinasena Agricultural Machinery (Pvt) Ltd.',
  customer: process.env.SALES_CUSTOMER ?? 'Test Customer - Playwright 1',
  quotationType: process.env.SALES_QUOTATION_TYPE ?? 'Sales',
  salesTeam: process.env.SALES_TEAM ?? 'Colombo Sales Centre',
  warehouse: process.env.SALES_WAREHOUSE ?? 'JAM Warehouse Ekala- (JM-EK)',
  product1: process.env.SALES_PRODUCT_1 ?? 'CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S',
  product2: process.env.SALES_PRODUCT_2 ?? 'BALL BEARING 6202-2RS',
  salesTax: process.env.SALES_TAX ?? 'VAT 18% (Sales)',
  distributorGroup: process.env.SALES_CUSTOMER_GROUP ?? 'DISTR',
} as const;

/** Quantity that pushes any quotation far above a customer's credit limit. */
export const OVER_LIMIT_QUANTITY = 1_000_000;

/** Unit price (below product cost) used to trigger the insufficient-margin approval. */
export const BELOW_COST_UNIT_PRICE = 100;

/**
 * Optional login of the user who must approve credit limits. When set, the approval test signs in
 * as that user in a second browser, approves, and then confirms the order as the requester.
 */
export const APPROVER_LOGIN = {
  email: process.env.ODOO_APPROVER_EMAIL ?? '',
  password: process.env.ODOO_APPROVER_PASSWORD ?? '',
};
