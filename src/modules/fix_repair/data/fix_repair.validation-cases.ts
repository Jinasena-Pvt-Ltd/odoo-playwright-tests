/**
 * Ticket fields Fix-repair makes required once a repair type is set (helpdesk_ticket._get_view);
 * Job Location is left out: it is read-only at that point, so Odoo does not check it on save.
 * field = what the case checks, attemptedValue = the field's technical name (Clear-DB name;
 * .trial-src translates it), expectedError = the label expected in Odoo's "Invalid fields"
 * notification.
 */
export const FIX_REPAIR_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  { module: 'Repair ticket', field: 'Customer', attemptedValue: 'partner_id', expectedError: 'Customer' },
  { module: 'Repair ticket', field: 'Repair Reason', attemptedValue: 'repair_reason', expectedError: 'Repair Reason' },
  { module: 'Repair ticket', field: 'Product', attemptedValue: 'product_id', expectedError: 'Product' },
  {
    module: 'Repair ticket',
    field: 'Return Receipt Location',
    attemptedValue: 'return_receipt_location',
    expectedError: 'Return Receipt Location',
  },
];

export const FIX_REPAIR_VALIDATION_CASES: typeof FIX_REPAIR_MANDATORY_FIELDS = [];
