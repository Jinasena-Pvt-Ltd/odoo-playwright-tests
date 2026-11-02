# Sales flow bug report — 2026-11-02

Cash and Credit flows walked step by step for every Customer Group.

| Steps passed | Bugs found | High | Medium | Low | Info |
|---|---|---|---|---|---|
| 203 | 7 | 0 | 6 | 0 | 1 |

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

- **Group:** Control (existing customer "abc"), CAC, CENT-ISSUE, DISTR, DLRS, EXPT, LEGAL, SBU1, SVAT-CAC, SVAT-CRC, TC, WELFARE, COMM  
- **Flow:** Cash  
- **Step:** 5 Register cash payment  
- **Severity:** Medium
- **Details:**

```
"Customer Receipts - Cash" was not offered in the journal_id dropdown. Offered: No records
```
- **Screenshot:** `test-results/flow-bugs/Control_existing_customer_abc_Cash_5_Register_cash_payment.png`

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

- **Group:** TC  
- **Flow:** Validation (Cash)  
- **Step:** Confirm order with zero unit price  
- **Severity:** Medium
- **Details:**

```
zero unit price: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed
```

### BUG-007 — Customer cannot be created with only the basic fields

- **Group:** WELFARE  
- **Flow:** Cash customer  
- **Step:** Create customer  
- **Severity:** Medium
- **Details:**

```
apiRequestContext.post: Timeout 20000ms exceeded.
Call log:
[2m  - → POST https://jinasena-upgrade-testing-39894820.dev.odoo.com/web/dataset/call_kw[22m
[2m    - user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.12 Safari/537.36[22m
[2m    - accept: */*[22m
[2m    - accept-encoding: gzip,deflate,br[22m
[2m    - content-type: application/json[22m
[2m    - content-length: 303[22m
[2m    - cookie: frontend_lang=en_US; tz=UTC; im_livechat_history=["/web/login"]; session_id=8fd0143e3f90d6f8040d8dd5928c938cdc8e91c7; cids=2[22
```

## Flow stopped here — not a bug

_None._

## Steps that passed

- Control (existing customer "abc") / Cash / 1 Create quotation (Cash)
- Control (existing customer "abc") / Cash / 2 Confirm order
- Control (existing customer "abc") / Cash / 3 Validate delivery
- Control (existing customer "abc") / Cash / 4 Create invoice
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
- DLRS / Cash / 3 Validate delivery
- DLRS / Cash / 4 Create invoice
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
- LEGAL / Cash / 3 Validate delivery
- LEGAL / Cash / 4 Create invoice
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
- SVAT-CAC / Cash / 3 Validate delivery
- SVAT-CAC / Cash / 4 Create invoice
- SVAT-CAC / Credit customer / create customer
- SVAT-CAC / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- SVAT-CAC / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
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
- SVAT-CRC / Cash / 3 Validate delivery
- SVAT-CRC / Cash / 4 Create invoice
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
- TC / Cash / 3 Validate delivery
- TC / Cash / 4 Create invoice
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
- WELFARE / Cash customer / create customer (with bank guarantee)
- WELFARE / Cash / 1 Create quotation (Cash)
- WELFARE / Cash / 2 Confirm order
- WELFARE / Cash / 3 Validate delivery
- WELFARE / Cash / 4 Create invoice
- WELFARE / Credit customer / create customer
- WELFARE / Validation (Cash) / Save with blank Customer: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Order Payment Type: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Quotation Type: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Payment Terms: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Salesperson: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Sales Team: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Warehouse: blocked by Odoo (OK)
- WELFARE / Validation (Cash) / Save with blank Company: field-not-shown
- WELFARE / Validation (Cash) / Confirm order with zero quantity: confirm-hidden (OK)
- WELFARE / Validation (Cash) / Confirm order with zero unit price: confirm-hidden (OK)
- COMM / Cash customer / create customer
- COMM / Cash / 1 Create quotation (Cash)
- COMM / Cash / 2 Confirm order
- COMM / Cash / 3 Validate delivery
- COMM / Cash / 4 Create invoice
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
