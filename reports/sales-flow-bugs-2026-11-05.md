# Sales flow bug report — 2026-11-05

Cash and Credit flows walked step by step for every Customer Group.

| Steps passed | Bugs found | High | Medium | Low | Info |
|---|---|---|---|---|---|
| 179 | 10 | 0 | 9 | 0 | 1 |

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

- **Group:** Control (existing customer "[TEST] Overdue Credit Customer"), CAC, CENT-ISSUE  
- **Flow:** Cash  
- **Step:** 5 Register cash payment  
- **Severity:** Medium
- **Details:**

```
"Customer Receipts - Cash" was not offered in the journal_id dropdown. Offered: No records
```
- **Screenshot:** `test-results/flow-bugs/Control_existing_customer_TEST_Overdue_Credit_Customer_Cash_5_Register_cash_payment.png`

### BUG-003 — Step could not be completed (needs review)

- **Group:** CAC, CENT-ISSUE, DISTR, DLRS, EXPT, LEGAL, SBU1, SVAT-CAC, SVAT-CRC, TC, WELFARE, COMM  
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

### BUG-006 — Validation check could not be completed (needs review)

- **Group:** CENT-ISSUE  
- **Flow:** Validation (Cash)  
- **Step:** Save with blank Customer  
- **Severity:** Medium
- **Details:**

```
Customer: Odoo did not load (neither the navbar nor the login form appeared). Check ODOO_BASE_URL.
```

### BUG-007 — Validation check could not be completed (needs review)

- **Group:** CENT-ISSUE, SVAT-CAC  
- **Flow:** Validation (Cash)  
- **Step:** Save with blank Order Payment Type  
- **Severity:** Medium
- **Details:**

```
Order Payment Type: Odoo did not load (neither the navbar nor the login form appeared). Check ODOO_BASE_URL.
```

### BUG-008 — Step could not be completed (needs review)

- **Group:** DISTR, DLRS, EXPT, LEGAL, SBU1, SVAT-CAC, SVAT-CRC, TC, WELFARE, COMM  
- **Flow:** Cash  
- **Step:** 3 Validate delivery  
- **Severity:** Medium
- **Details:**

```
Could not create serial SNMW3BQGKS in the Create Move Line popup (Create option never accepted; dropdown showed: SNMW3BQGKS | Search More... | Start typing...)
```
- **Screenshot:** `test-results/flow-bugs/DISTR_Cash_3_Validate_delivery.png`

### BUG-009 — Validation check could not be completed (needs review)

- **Group:** LEGAL  
- **Flow:** Validation (Cash)  
- **Step:** Save with blank Payment Terms  
- **Severity:** Medium
- **Details:**

```
Payment Terms: locator.click: Timeout 20000ms exceeded.
```

### BUG-010 — Validation check could not be completed (needs review)

- **Group:** WELFARE  
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
- CENT-ISSUE / Cash customer / create customer
- CENT-ISSUE / Cash / 1 Create quotation (Cash)
- CENT-ISSUE / Cash / 2 Confirm order
- CENT-ISSUE / Cash / 3 Validate delivery
- CENT-ISSUE / Cash / 4 Create invoice
- CENT-ISSUE / Credit customer / create customer
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
- DISTR / Credit customer / create customer
- DISTR / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- DISTR / Validation (Cash) / Save with blank Company: field-not-shown
- DISTR / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- DISTR / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- DLRS / Cash customer / create customer
- DLRS / Cash / 1 Create quotation (Cash)
- DLRS / Cash / 2 Confirm order
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
- EXPT / Credit customer / create customer
- EXPT / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- EXPT / Validation (Cash) / Save with blank Company: field-not-shown
- EXPT / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- EXPT / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- LEGAL / Cash customer / create customer
- LEGAL / Cash / 1 Create quotation (Cash)
- LEGAL / Cash / 2 Confirm order
- LEGAL / Credit customer / create customer
- LEGAL / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- LEGAL / Validation (Cash) / Save with blank Company: field-not-shown
- LEGAL / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- LEGAL / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- SBU1 / Cash customer / create customer
- SBU1 / Cash / 1 Create quotation (Cash)
- SBU1 / Cash / 2 Confirm order
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
- SVAT-CAC / Cash customer / create customer
- SVAT-CAC / Cash / 1 Create quotation (Cash)
- SVAT-CAC / Cash / 2 Confirm order
- SVAT-CAC / Credit customer / create customer
- SVAT-CAC / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Company: field-not-shown
- SVAT-CAC / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- SVAT-CAC / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- SVAT-CRC / Cash customer / create customer
- SVAT-CRC / Cash / 1 Create quotation (Cash)
- SVAT-CRC / Cash / 2 Confirm order
- SVAT-CRC / Credit customer / create customer
- SVAT-CRC / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- SVAT-CRC / Validation (Cash) / Save with blank Company: field-not-shown
- SVAT-CRC / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- SVAT-CRC / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- TC / Cash customer / create customer
- TC / Cash / 1 Create quotation (Cash)
- TC / Cash / 2 Confirm order
- TC / Credit customer / create customer
- TC / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- TC / Validation (Cash) / Save with blank Company: field-not-shown
- TC / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- TC / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- WELFARE / Cash customer / create customer
- WELFARE / Cash / 1 Create quotation (Cash)
- WELFARE / Cash / 2 Confirm order
- WELFARE / Credit customer / create customer
- WELFARE / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- WELFARE / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- COMM / Cash customer / create customer
- COMM / Cash / 1 Create quotation (Cash)
- COMM / Cash / 2 Confirm order
- COMM / Credit customer / create customer
- COMM / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- COMM / Validation (Cash) / Save with blank Company: field-not-shown
- COMM / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- COMM / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
