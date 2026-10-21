# Sales flow bug report — 2026-10-19

Cash and Credit flows walked step by step for every Customer Group.

| Steps passed | Bugs found | High | Medium | Low | Info |
|---|---|---|---|---|---|
| 26 | 3 | 0 | 0 | 0 | 3 |

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

### BUG-002 — DISTR customers need Bank Guarantee data (expected rule)

- **Group:** DISTR  
- **Flow:** Cash customer  
- **Step:** Create customer  
- **Severity:** Info
- **Details:**

```
Odoo RPC error: Bank Guarantee Amount must be Specified for Distributors.
```

### BUG-003 — DISTR customers need Bank Guarantee data (expected rule)

- **Group:** DISTR  
- **Flow:** Credit customer  
- **Step:** Create customer  
- **Severity:** Info
- **Details:**

```
Odoo RPC error: Bank Guarantee Amount must be Specified for Distributors.
```

## Flow stopped here — not a bug

_None._

## Steps that passed

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
- CENT-ISSUE / Credit / 3 Validate delivery
- CENT-ISSUE / Credit / 4 Create invoice
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
