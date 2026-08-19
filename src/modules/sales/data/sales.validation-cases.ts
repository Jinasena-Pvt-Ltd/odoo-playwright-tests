/**
 * Mandatory field validation cases for the primary sales Odoo model (sale.order).
 * TODO: Replace with real field names and expected error messages.
 */
export const SALES_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  // {
  //   module: 'SALES',
  //   field: 'partner_id',
  //   attemptedValue: '',
  //   expectedError: 'This field is required',
  // },
];

/** TODO: Add server-side constraint violation cases */
export const SALES_VALIDATION_CASES: typeof SALES_MANDATORY_FIELDS = [];
