# Sales flow bug report — 2026-10-19

Cash and Credit flows walked step by step for every Customer Group.

| Steps passed | Bugs found | High | Medium | Low | Info |
|---|---|---|---|---|---|
| 154 | 4 | 0 | 3 | 0 | 1 |

Severity: **High** = Odoo showed an error / blocked the flow. **Medium** = a step could not be completed, needs a human to confirm. **Info** = data or configuration observation.

## Bugs

### BUG-001 — Customer Group names differ between companies

- **Group:** All  
- **Flow:** Setup  
- **Step:** Read Customer Groups  
- **Severity:** Info
- **Details:**

```
Groups exist per company. Only in "Jinasena Agricultural Machinery (Pvt) Ltd.": TC. Only in other companies: TC-SC.
```

### BUG-002 — Step could not be completed (needs review)

- **Group:** CENT-ISSUE  
- **Flow:** Credit  
- **Step:** 3 Validate delivery  
- **Severity:** Medium
- **Details:**

```
Could not receive serial SNMVEUX0SJ into stock: Serial SNMVEUX0SJ was not created
```
- **Screenshot:** `test-results/flow-bugs/CENT_ISSUE_Credit_3_Validate_delivery.png`

### BUG-003 — Customer cannot be created with only the basic fields

- **Group:** DISTR  
- **Flow:** Cash customer  
- **Step:** Create customer  
- **Severity:** Medium
- **Details:**

```
Odoo RPC error: Bank Guarantee Amount must be Specified for Distributors.
```

### BUG-004 — Customer cannot be created with only the basic fields

- **Group:** DISTR  
- **Flow:** Credit customer  
- **Step:** Create customer  
- **Severity:** Medium
- **Details:**

```
Odoo RPC error: Bank Guarantee Amount must be Specified for Distributors.
```

## Flow stopped here — not a bug

_None._

## Steps that passed

- CAC / Cash customer / create customer
- CAC / Cash / 1 Create quotation (Cash)
- CAC / Cash / 2 Confirm order
- CAC / Cash / 3 Validate delivery
- CAC / Cash / 4 Create invoice
- CAC / Cash / 5 Register cash payment
- CAC / Credit customer / create customer
- CAC / Credit / 1 Create quotation (Credit)
- CAC / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- CAC / Credit / approvals taken: none needed
- CAC / Credit / 2 Give approvals and confirm
- CAC / Credit / 3 Validate delivery
- CAC / Credit / 4 Create invoice
- CENT-ISSUE / Cash customer / create customer
- CENT-ISSUE / Cash / 1 Create quotation (Cash)
- CENT-ISSUE / Cash / 2 Confirm order
- CENT-ISSUE / Cash / 3 Validate delivery
- CENT-ISSUE / Cash / 4 Create invoice
- CENT-ISSUE / Cash / 5 Register cash payment
- CENT-ISSUE / Credit customer / create customer
- CENT-ISSUE / Credit / 1 Create quotation (Credit)
- CENT-ISSUE / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- CENT-ISSUE / Credit / approvals taken: none needed
- CENT-ISSUE / Credit / 2 Give approvals and confirm
- DISTR / Cash customer / create customer (with bank guarantee)
- DISTR / Cash / 1 Create quotation (Cash)
- DISTR / Cash / 2 Confirm order
- DISTR / Cash / 3 Validate delivery
- DISTR / Cash / 4 Create invoice
- DISTR / Cash / 5 Register cash payment
- DISTR / Credit customer / create customer (with bank guarantee)
- DISTR / Credit / 1 Create quotation (Credit)
- DISTR / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- DISTR / Credit / approvals taken: none needed
- DISTR / Credit / 2 Give approvals and confirm
- DISTR / Credit / 3 Validate delivery
- DISTR / Credit / 4 Create invoice
- DLRS / Cash customer / create customer
- DLRS / Cash / 1 Create quotation (Cash)
- DLRS / Cash / 2 Confirm order
- DLRS / Cash / 3 Validate delivery
- DLRS / Cash / 4 Create invoice
- DLRS / Cash / 5 Register cash payment
- DLRS / Credit customer / create customer
- DLRS / Credit / 1 Create quotation (Credit)
- DLRS / Credit / buttons before approval: Send Bank Guarantee Validity Notification | Confirm | Preview | Sales Order | Quotation Sent | Quotation
- DLRS / Credit / approvals taken: none needed
- DLRS / Credit / 2 Give approvals and confirm
- DLRS / Credit / 3 Validate delivery
- DLRS / Credit / 4 Create invoice
- EXPT / Cash customer / create customer
- EXPT / Cash / 1 Create quotation (Cash)
- EXPT / Cash / 2 Confirm order
- EXPT / Cash / 3 Validate delivery
- EXPT / Cash / 4 Create invoice
- EXPT / Cash / 5 Register cash payment
- EXPT / Credit customer / create customer
- EXPT / Credit / 1 Create quotation (Credit)
- EXPT / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- EXPT / Credit / approvals taken: none needed
- EXPT / Credit / 2 Give approvals and confirm
- EXPT / Credit / 3 Validate delivery
- EXPT / Credit / 4 Create invoice
- LEGAL / Cash customer / create customer
- LEGAL / Cash / 1 Create quotation (Cash)
- LEGAL / Cash / 2 Confirm order
- LEGAL / Cash / 3 Validate delivery
- LEGAL / Cash / 4 Create invoice
- LEGAL / Cash / 5 Register cash payment
- LEGAL / Credit customer / create customer
- LEGAL / Credit / 1 Create quotation (Credit)
- LEGAL / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- LEGAL / Credit / approvals taken: none needed
- LEGAL / Credit / 2 Give approvals and confirm
- LEGAL / Credit / 3 Validate delivery
- LEGAL / Credit / 4 Create invoice
- SBU1 / Cash customer / create customer
- SBU1 / Cash / 1 Create quotation (Cash)
- SBU1 / Cash / 2 Confirm order
- SBU1 / Cash / 3 Validate delivery
- SBU1 / Cash / 4 Create invoice
- SBU1 / Cash / 5 Register cash payment
- SBU1 / Credit customer / create customer
- SBU1 / Credit / 1 Create quotation (Credit)
- SBU1 / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- SBU1 / Credit / approvals taken: none needed
- SBU1 / Credit / 2 Give approvals and confirm
- SBU1 / Credit / 3 Validate delivery
- SBU1 / Credit / 4 Create invoice
- SVAT-CAC / Cash customer / create customer
- SVAT-CAC / Cash / 1 Create quotation (Cash)
- SVAT-CAC / Cash / 2 Confirm order
- SVAT-CAC / Cash / 3 Validate delivery
- SVAT-CAC / Cash / 4 Create invoice
- SVAT-CAC / Cash / 5 Register cash payment
- SVAT-CAC / Credit customer / create customer
- SVAT-CAC / Credit / 1 Create quotation (Credit)
- SVAT-CAC / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- SVAT-CAC / Credit / approvals taken: none needed
- SVAT-CAC / Credit / 2 Give approvals and confirm
- SVAT-CAC / Credit / 3 Validate delivery
- SVAT-CAC / Credit / 4 Create invoice
- SVAT-CRC / Cash customer / create customer
- SVAT-CRC / Cash / 1 Create quotation (Cash)
- SVAT-CRC / Cash / 2 Confirm order
- SVAT-CRC / Cash / 3 Validate delivery
- SVAT-CRC / Cash / 4 Create invoice
- SVAT-CRC / Cash / 5 Register cash payment
- SVAT-CRC / Credit customer / create customer
- SVAT-CRC / Credit / 1 Create quotation (Credit)
- SVAT-CRC / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- SVAT-CRC / Credit / approvals taken: none needed
- SVAT-CRC / Credit / 2 Give approvals and confirm
- SVAT-CRC / Credit / 3 Validate delivery
- SVAT-CRC / Credit / 4 Create invoice
- TC / Cash customer / create customer
- TC / Cash / 1 Create quotation (Cash)
- TC / Cash / 2 Confirm order
- TC / Cash / 3 Validate delivery
- TC / Cash / 4 Create invoice
- TC / Cash / 5 Register cash payment
- TC / Credit customer / create customer
- TC / Credit / 1 Create quotation (Credit)
- TC / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- TC / Credit / approvals taken: none needed
- TC / Credit / 2 Give approvals and confirm
- TC / Credit / 3 Validate delivery
- TC / Credit / 4 Create invoice
- WELFARE / Cash customer / create customer
- WELFARE / Cash / 1 Create quotation (Cash)
- WELFARE / Cash / 2 Confirm order
- WELFARE / Cash / 3 Validate delivery
- WELFARE / Cash / 4 Create invoice
- WELFARE / Cash / 5 Register cash payment
- WELFARE / Credit customer / create customer
- WELFARE / Credit / 1 Create quotation (Credit)
- WELFARE / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- WELFARE / Credit / approvals taken: none needed
- WELFARE / Credit / 2 Give approvals and confirm
- WELFARE / Credit / 3 Validate delivery
- WELFARE / Credit / 4 Create invoice
- COMM / Cash customer / create customer
- COMM / Cash / 1 Create quotation (Cash)
- COMM / Cash / 2 Confirm order
- COMM / Cash / 3 Validate delivery
- COMM / Cash / 4 Create invoice
- COMM / Cash / 5 Register cash payment
- COMM / Credit customer / create customer
- COMM / Credit / 1 Create quotation (Credit)
- COMM / Credit / buttons before approval: Confirm | Preview | Sales Order | Quotation Sent | Quotation
- COMM / Credit / approvals taken: none needed
- COMM / Credit / 2 Give approvals and confirm
- COMM / Credit / 3 Validate delivery
- COMM / Credit / 4 Create invoice
