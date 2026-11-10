# Sales flow bug report — 2026-11-09

Cash and Credit flows walked step by step for every Customer Group.

| Steps passed | Bugs found | High | Medium | Low | Info |
|---|---|---|---|---|---|
| 130 | 6 | 0 | 5 | 0 | 1 |

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

- **Group:** CAC, CENT-ISSUE, DISTR, DLRS, EXPT, LEGAL, SBU1  
- **Flow:** Credit  
- **Step:** 1 Create quotation (Credit)  
- **Severity:** Medium
- **Details:**

```
Quotation was not saved (title shows "New").
```
- **Screenshot:** `test-results/flow-bugs/CAC_Credit_1_Create_quotation_Credit_.png`

### BUG-003 — Validation check could not be completed (needs review)

- **Group:** CAC  
- **Flow:** Validation (Credit)  
- **Step:** Confirm order with zero quantity  
- **Severity:** Medium
- **Details:**

```
zero quantity: Quotation was not saved (title shows "New").
```

### BUG-004 — Validation check could not be completed (needs review)

- **Group:** CAC  
- **Flow:** Validation (Credit)  
- **Step:** Confirm order with zero unit price  
- **Severity:** Medium
- **Details:**

```
zero unit price: Quotation was not saved (title shows "New").
```

### BUG-005 — Validation check could not be completed (needs review)

- **Group:** DISTR  
- **Flow:** Validation (Cash)  
- **Step:** Confirm order with zero quantity  
- **Severity:** Medium
- **Details:**

```
zero quantity: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed
```

### BUG-006 — Validation check could not be completed (needs review)

- **Group:** EXPT  
- **Flow:** Validation (Cash)  
- **Step:** Save with blank Company  
- **Severity:** Medium
- **Details:**

```
Company: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed
```

## Flow stopped here — not a bug

_None._

## Steps that passed

- Control (existing customer "abc") / Cash / 1 Create quotation (Cash)
- Control (existing customer "abc") / Cash / 2 Confirm order
- Control (existing customer "abc") / Cash / 3 Validate delivery
- Control (existing customer "abc") / Cash / 4 Create invoice
- Control (existing customer "abc") / Cash / 5 Register cash payment
- CAC / Cash customer / create customer
- CAC / Cash / 1 Create quotation (Cash)
- CAC / Cash / 2 Confirm order
- CAC / Cash / 3 Validate delivery
- CAC / Cash / 4 Create invoice
- CAC / Cash / 5 Register cash payment
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
- CENT-ISSUE / Cash customer / create customer
- CENT-ISSUE / Cash / 1 Create quotation (Cash)
- CENT-ISSUE / Cash / 2 Confirm order
- CENT-ISSUE / Cash / 3 Validate delivery
- CENT-ISSUE / Cash / 4 Create invoice
- CENT-ISSUE / Cash / 5 Register cash payment
- CENT-ISSUE / Credit customer / create customer
- CENT-ISSUE / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- CENT-ISSUE / Validation (Cash) / Save with blank Company: field-not-shown
- CENT-ISSUE / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- CENT-ISSUE / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- DISTR / Cash customer / create customer
- DISTR / Cash / 1 Create quotation (Cash)
- DISTR / Cash / 2 Confirm order
- DISTR / Cash / 3 Validate delivery
- DISTR / Cash / 4 Create invoice
- DISTR / Cash / 5 Register cash payment
- DISTR / Credit customer / create customer
- DISTR / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Company: field-not-shown
- DISTR / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- DLRS / Cash customer / create customer
- DLRS / Cash / 1 Create quotation (Cash)
- DLRS / Cash / 2 Confirm order
- DLRS / Cash / 3 Validate delivery
- DLRS / Cash / 4 Create invoice
- DLRS / Cash / 5 Register cash payment
- DLRS / Credit customer / create customer
- DLRS / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- DLRS / Validation (Cash) / Save with blank Company: field-not-shown
- DLRS / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- DLRS / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- EXPT / Cash customer / create customer
- EXPT / Cash / 1 Create quotation (Cash)
- EXPT / Cash / 2 Confirm order
- EXPT / Cash / 3 Validate delivery
- EXPT / Cash / 4 Create invoice
- EXPT / Cash / 5 Register cash payment
- EXPT / Credit customer / create customer
- EXPT / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- EXPT / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- LEGAL / Cash customer / create customer
- LEGAL / Cash / 1 Create quotation (Cash)
- LEGAL / Cash / 2 Confirm order
- LEGAL / Cash / 3 Validate delivery
- LEGAL / Cash / 4 Create invoice
- LEGAL / Cash / 5 Register cash payment
- LEGAL / Credit customer / create customer
- LEGAL / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Company: field-not-shown
- LEGAL / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- LEGAL / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- SBU1 / Cash customer / create customer
- SBU1 / Cash / 1 Create quotation (Cash)
- SBU1 / Cash / 2 Confirm order
- SBU1 / Cash / 3 Validate delivery
- SBU1 / Cash / 4 Create invoice
- SBU1 / Cash / 5 Register cash payment
- SBU1 / Credit customer / create customer
- SBU1 / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- SBU1 / Validation (Cash) / Save with blank Company: field-not-shown
- SBU1 / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- SBU1 / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
