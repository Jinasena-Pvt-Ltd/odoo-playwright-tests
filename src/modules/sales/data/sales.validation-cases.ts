/**
 * Blank-field validation cases for a new quotation. Each case leaves ONE field blank (or untouched)
 * and expects Odoo to refuse the save.
 */
export type QuotationOmission = 'customer' | 'quotationType' | 'salesTeam' | 'warehouse' | null;

export interface BlankFieldCase {
  /** Original step number, kept for traceability with earlier reports. */
  step: string;
  /** Human label of the field under test. */
  label: string;
  /** Odoo technical name of the field (read-only pre-check); null when it is not known. */
  field: string | null;
  /** Which part of the standard quotation fill to leave out. */
  omit: QuotationOmission;
  /** When true, a read-only pre-filled field skips the test (it cannot be left blank by a user). */
  skipIfReadOnly: boolean;
}

export const SALES_BLANK_FIELD_CASES: BlankFieldCase[] = [
  { step: '05.1', label: 'Customer',           field: 'partner_id',    omit: 'customer',      skipIfReadOnly: false },
  // 05.2 and 05.3 behave the same: the Quotation Type is left unset (Order Payment Type is never touched).
  { step: '05.2', label: 'Order Payment Type', field: null,            omit: 'quotationType', skipIfReadOnly: false },
  { step: '05.3', label: 'Quotation Type',     field: null,            omit: 'quotationType', skipIfReadOnly: false },
  { step: '05.4', label: 'Payment Terms',      field: 'payment_term_id', omit: null,          skipIfReadOnly: true },
  { step: '05.5', label: 'Salesperson',        field: 'user_id',       omit: null,            skipIfReadOnly: true },
  { step: '05.6', label: 'Sales Team',         field: 'team_id',       omit: 'salesTeam',     skipIfReadOnly: true },
  { step: '05.7', label: 'Company',            field: 'company_id',    omit: null,            skipIfReadOnly: true },
  { step: '05.8', label: 'Warehouse',          field: 'warehouse_id',  omit: 'warehouse',     skipIfReadOnly: true },
];

/** Amount / expiry combinations for the mandatory Bank Guarantee check on distributor customers. */
export interface BankGuaranteeCase {
  name: string;
  amount: string;
  /** null = leave the expiry date blank */
  expiry: string | null;
}

export const SALES_BANK_GUARANTEE_AMOUNT_VALID = '5000';
export const SALES_BANK_GUARANTEE_EXPIRY_VALID = { year: 2030, month: 12, day: 31 } as const;
