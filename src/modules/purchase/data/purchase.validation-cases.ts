/**
 * Mandatory field validation cases for the primary purchase Odoo model.
 * TODO: Replace with real field names and expected error messages.
 */
export const PURCHASE_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  // {
  //   module: 'PURCHASE',
  //   field: 'name',
  //   attemptedValue: '',
  //   expectedError: 'This field is required',
  // },
];

/** TODO: Add server-side constraint violation cases */
export const PURCHASE_VALIDATION_CASES: typeof PURCHASE_MANDATORY_FIELDS = [];
