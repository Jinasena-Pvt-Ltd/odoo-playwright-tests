/**
 * Mandatory field validation cases for the primary imports Odoo model.
 * TODO: Replace with real field names and expected error messages.
 */
export const IMPORTS_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  // {
  //   module: 'IMPORTS',
  //   field: 'name',
  //   attemptedValue: '',
  //   expectedError: 'This field is required',
  // },
];

/** TODO: Add server-side constraint violation cases */
export const IMPORTS_VALIDATION_CASES: typeof IMPORTS_MANDATORY_FIELDS = [];
