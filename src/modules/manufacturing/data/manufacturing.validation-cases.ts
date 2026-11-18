/**
 * Mandatory field validation cases for the primary manufacturing Odoo model.
 * TODO: Replace with real field names and expected error messages.
 */
export const MANUFACTURING_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  // {
  //   module: 'MANUFACTURING',
  //   field: 'name',
  //   attemptedValue: '',
  //   expectedError: 'This field is required',
  // },
];

/** TODO: Add server-side constraint violation cases */
export const MANUFACTURING_VALIDATION_CASES: typeof MANUFACTURING_MANDATORY_FIELDS = [];
