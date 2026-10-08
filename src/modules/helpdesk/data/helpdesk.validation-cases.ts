/**
 * Mandatory field validation cases for the primary helpdesk Odoo model.
 * TODO: Replace with real field names and expected error messages.
 */
export const HELPDESK_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  // {
  //   module: 'HELPDESK',
  //   field: 'name',
  //   attemptedValue: '',
  //   expectedError: 'This field is required',
  // },
];

/** TODO: Add server-side constraint violation cases */
export const HELPDESK_VALIDATION_CASES: typeof HELPDESK_MANDATORY_FIELDS = [];
