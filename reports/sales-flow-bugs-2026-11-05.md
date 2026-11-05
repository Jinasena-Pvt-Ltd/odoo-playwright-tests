# Sales flow bug report — 2026-11-05

Cash and Credit flows walked step by step for every Customer Group.

| Steps passed | Bugs found | High | Medium | Low | Info |
|---|---|---|---|---|---|
| 28 | 5 | 0 | 4 | 0 | 1 |

Severity: **High** = Odoo showed an error / blocked the flow. **Medium** = a step could not be completed, needs a human to confirm. **Info** = data or configuration observation.

## Bugs

### BUG-001 — Customer Group names differ between companies

- **Group:** All  
- **Flow:** Setup  
- **Step:** Read Customer Groups  
- **Severity:** Info
- **Details:**

```
Groups exist per company. Only in "Jinasena Agricultural Machinery (Pvt) Ltd.": CAC, CENT-ISSUE, DISTR, DLRS, EXPT, LEGAL, SBU1, SVAT-CAC, SVAT-CRC, TC, WELFARE, COMM. Only in other companies: -.
```

### BUG-002 — Step could not be completed (needs review)

- **Group:** Control (existing customer "[TEST] Overdue Credit Customer"), CAC  
- **Flow:** Cash  
- **Step:** 5 Register cash payment  
- **Severity:** Medium
- **Details:**

```
"Customer Receipts - Cash" was not offered in the journal_id dropdown. Offered: No records
```
- **Screenshot:** `test-results/flow-bugs/Control_existing_customer_TEST_Overdue_Credit_Customer_Cash_5_Register_cash_payment.png`

### BUG-003 — Step could not be completed (needs review)

- **Group:** CAC  
- **Flow:** Credit  
- **Step:** 1 Create quotation (Credit)  
- **Severity:** Medium
- **Details:**

```
Quotation was not saved (title shows "New").
```
- **Screenshot:** `test-results/flow-bugs/CAC_Credit_1_Create_quotation_Credit_.png`

### BUG-004 — Validation check could not be completed (needs review)

- **Group:** CAC  
- **Flow:** Validation (Credit)  
- **Step:** Confirm order with zero quantity  
- **Severity:** Medium
- **Details:**

```
zero quantity: Quotation was not saved (title shows "New").
```

### BUG-005 — Validation check could not be completed (needs review)

- **Group:** CAC  
- **Flow:** Validation (Credit)  
- **Step:** Confirm order with zero unit price  
- **Severity:** Medium
- **Details:**

```
zero unit price: Quotation was not saved (title shows "New").
```

## Flow stopped here — not a bug

_None._

## Steps that passed

- Control (existing customer "[TEST] Overdue Credit Customer") / Cash / 1 Create quotation (Cash)
- Control (existing customer "[TEST] Overdue Credit Customer") / Cash / 2 Confirm order
- Control (existing customer "[TEST] Overdue Credit Customer") / Cash / 3 Validate delivery
- Control (existing customer "[TEST] Overdue Credit Customer") / Cash / 4 Create invoice
- CAC / Cash customer / create customer
- CAC / Cash / 1 Create quotation (Cash)
- CAC / Cash / 2 Confirm order
- CAC / Cash / 3 Validate delivery
- CAC / Cash / 4 Create invoice
- CAC / Credit customer / create customer
- CAC / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- CAC / Validation (Cash) / Save with blank Company: field-not-shown
- CAC / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- CAC / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- CAC / Validation (Credit) / Save with blank Customer: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Order Payment Type: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Quotation Type: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Payment Terms: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Salesperson: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Sales Team: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Warehouse: blocked by Odoo (OK)
- CAC / Validation (Credit) / Save with blank Company: field-not-shown
