# Credit Sales Order — Bank Guarantee Approval

Spec: `src/modules/sales/tests/02-business/sales.bank-guarantee-approval.spec.ts`
Tags: `@module:sales @step:business @e2e` · opt-in via `RUN_SALES_FLOWS=true`
Tour copy: `tour/bank-guarantee-credit-sales-order.json`

```bash
RUN_SALES_FLOWS=true HEADLESS=false npx playwright test sales.bank-guarantee-approval --project=setup --project=admin --workers=1
# distributor instead of dealer:
FLOW_BG_CUSTOMER="[TEST] DISTR Bank Guarantee Customer" RUN_SALES_FLOWS=true HEADLESS=false npx playwright test sales.bank-guarantee-approval --project=setup --project=admin --workers=1
```

## Scenario (from the recorded tour)
A Credit order for a Dealer / Distributor customer that has a mandatory Bank Guarantee. The recording clicks
**Send Bank Guarantee Validity Notification** on the order and on the invoice, then runs the order through delivery,
invoice and a cash receipt.

## Test customers (created on the testing DB, company Jinasena Agricultural Machinery)
| Customer | Group | Group Type | Bank Guarantee | Purpose |
|----------|-------|-----------|----------------|---------|
| `[TEST] DLRS Bank Guarantee Customer` | DLRS | Dealer | 5,000,000, valid to 2027-11-04 | main flow (default `FLOW_BG_CUSTOMER`) |
| `[TEST] DISTR Bank Guarantee Customer` | DISTR | Distributor | 5,000,000, valid to 2027-11-04 | same flow as a distributor |
| `[TEST] DLRS Low Guarantee Customer` | DLRS | Dealer | **100**, valid to 2027-11-05 | order is above the guarantee -> approval path (`FLOW_BG_LOW_CUSTOMER`) |

All three: Mandatory Bank Guarantee on, Valid Bank Guarantee on, Payment Type Credit, credit limit 10,000,000.

## Test cases (serial)
| # | Test | What it checks |
|---|------|----------------|
| 1 | quotation | Credit order, Quotation Type Sales, Payment Terms 14 Days, stage Quotation |
| 2 | gating | Confirm hidden until the Bank Guarantee Validity Notification is sent. **Skips** when the notification button is not shown |
| 3 | notify and confirm | Click the notification button if present, then approvals + Confirm -> Sales Order |
| 4 | delivery | Delivery validated, stage Done |
| 5 | invoice | Invoice created; notification clicked if Confirm is hidden; Posted |
| 6 | payment | Order found via Sales > Orders > Sales Orders; Register Payment with the cash journal for the full total; ribbon Paid / In Payment |
| 7 | trace | Payment's "Sales Orders" smart button shows 1 and leads back to the order |
| 8 | over guarantee | Low-guarantee customer: Confirm hidden and "Request Bank Guarantee Approval" offered |
| 9 | approval | Request -> Approve Bank Guarantee -> Confirm -> Sales Order |

## Last run (2026-11-05, headed, admin)
**9 passed, 1 skipped** (test 2). Tests 1, 3-7 passed for the DLRS and the DISTR customer; tests 8-9 passed for the low-guarantee customer.

## Findings for the developer
- **Validity notification never triggers.** The "Send Bank Guarantee Validity Notification" button (order: server action 4061, invoice: 4211)
  needs `x_studio_bank_guarantee_notification` = true. That flag is only written by automation **493 "SLS - Validate Bank Guarantee in SO Confirm"**
  (server action 4026), which is **inactive** on `jinasena-upgrade-testing-39894820`. Automation **492 "SLS - Validate Credit Limit & Bank Guarantee Amount - 1"** (Contact) is inactive too.
  Same pattern as the margin automation 491. Result: test 2 skips and test 3 confirms without a notification.
- The over-guarantee approval buttons ("Request Bank Guarantee Approval" 4055 / "Approve Bank Guarantee" 4050) work; they depend on the computed
  `x_studio_over_bank_guarantee` (order total + customer credit above the customer's guarantee amount).

## Gotchas
- The order buttons are located by visible text; the recorded ids (1850/1851) are database action ids.
- The Payment Terms dropdown occasionally does not open (seen once as a failure in `createQuotation`); a rerun passes.
- A saved form URL can land on the Quotations list; `openRecord` retries the navigation once.
- The recorded journal "Customer Receipts - Cash" does not exist in this company; the payment step falls back to "Commercial - Cash Receipts".
- Smart button text is `"1Sale Orders"`; match with `/^\s*1(?!\d)/`.
- Each run creates real records (order, delivery, invoice, payment).
