# Credit Sales Order — Credit Limit Approval with Overdue Customer

Spec: `src/modules/sales/tests/02-business/sales.credit-overdue-approval.spec.ts`
Tags: `@module:sales @step:business @e2e` · opt-in via `RUN_SALES_FLOWS=true`

```bash
RUN_SALES_FLOWS=true HEADLESS=false npx playwright test sales.credit-overdue-approval --project=setup --project=admin --workers=1
```

## Scenario (from the recorded tour)
Customer `[TEST] Overdue Credit Customer` (override with `FLOW_OVERDUE_CUSTOMER`; the tour customer `abc` is not overdue on the test database) buys on Credit while overdue / over limit.
The order needs overdue and credit-limit approval before it can be confirmed, then runs through
delivery, invoice and a cash receipt.

## Test cases (serial)
| # | Test | What it checks |
|---|------|----------------|
| 1 | quotation | Credit order created: Quotation Type Sales, Ball Bearing line, Payment Terms 14 Days, team, warehouse. Stage = Quotation |
| 2 | gating | Confirm hidden while approvals pending; "View Credit Limit Overdue Details" opens a dialog/list. **Skips** if the customer is not overdue/over limit |
| 3 | approvals | Request/approve overdue + credit limit, then Confirm. Stage = Sales Order |
| 4 | delivery | Delivery validated, stage Done |
| 5 | invoice | Invoice created and confirmed, stage Posted |
| 6 | payment | Order found via Sales > Orders > Sales Orders; Register Payment with "Customer Receipts - Cash" for the full invoice total; ribbon Paid / In Payment |
| 7 | trace | Payment's "Sales Orders" smart button shows 1 and leads back to the order |

## Last run (2026-11-02, headed, admin)
7 passed, 1 skipped (test 2). Test 2 skipped because customer `abc` showed none of the overdue /
credit-limit buttons in this database, so the gating assertions were not exercised. To cover them,
use a customer that is actually overdue/over limit (`FLOW_OVERDUE_CUSTOMER=<name>`).

## Gotchas
- The smart button text is `"1Sale Orders"` (count and label run together), so there is no word
  boundary after the count. Match with `/^\s*1(?!\d)/`, not `/1\b/` (this failed on the first run).
- The recorded button names (`button[name="1853"]` etc.) are database action ids; the spec locates
  buttons by visible text instead.
- The approver is the admin by default; set `ODOO_APPROVER_EMAIL` / `ODOO_APPROVER_PASSWORD` if
  approvals are assigned to another user.
- The recording's fixed 1,200.00 payment is replaced by the invoice total.
- Each run creates real records (order, delivery, invoice, payment).
