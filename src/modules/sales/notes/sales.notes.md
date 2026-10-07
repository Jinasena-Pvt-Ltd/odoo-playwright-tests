# Sales — Notes

Free-form notes for the sales module: Odoo quirks, data the tests depend on, and decisions.

## Origin

Ported from the standalone `Sales-Testing-Step-testing` project (steps 01–10.01) into this repo's 7-step
layout. That original project was left untouched.

| Original steps | Now |
|---|---|
| 01 login, 02 open Sales, 03 company, 04 quotations, 05 new quotation, Minimum Sales Margin read | `01-config` |
| 07 amount calculations, 08 insufficient margin, 09 credit limit | `02-business` |
| 05.1–05.8 blank fields, 10.01 bank guarantee | `05-validations` |
| 06.00 zero quantity, 06.01 zero unit price | `06-edge-cases` |

## Existing Odoo data the tests rely on (selected, never created)

Defaults live in `data/sales.master-data.ts` and can be overridden with `SALES_*` variables in `.env`.

- Company "Jinasena Agricultural Machinery (Pvt) Ltd."; customer "Test Customer - Playwright 1" (Customer Group DISTR)
- Sales team "Colombo Sales Centre"; warehouse "JAM Warehouse Ekala- (JM-EK)"
- Products "CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S" and "BALL BEARING 6202-2RS"
- Tax "VAT 18% (Sales)"; a Minimum Sales Margin value in Sales ▸ Configuration ▸ Settings

## Odoo behaviours worth knowing

- **Taxes** is not under Accounting ▸ Configuration here; it sits in the "+" overflow menu of the Accounting top bar.
- **Minimum Sales Margin** is on Sales ▸ Configuration ▸ Settings (Sales tab), not a separate "Sales Configurations" menu.
- **Error dialogs** ("Oh snap!") are `role="dialog"`. The `.o_dialog` wrapper has no box, so Playwright never sees it as visible.
- **Required analytic plan:** saving a quotation fails with "required analytic plan(s) have no matching account"
  when a plan such as "Product Group" is mandatory but has no matching account for the product.
- **Credit-limit approval** is built from Studio server actions. "SLS - Request Approval - Notify User" creates an
  "Approve Credit Limit" activity assigned to a specific user. Everyone else sees the Approve button with the
  tooltip "Waiting for approval". Set `ODOO_APPROVER_EMAIL` / `ODOO_APPROVER_PASSWORD` in `.env` to let the test
  approve as that user; without them the approve → confirm test is skipped.
- The over-limit test uses a huge quantity (`OVER_LIMIT_QUANTITY`) so it never depends on the customer's configured limit.
- Slow days: the instance can take 2–4× longer; the page objects use generous waits.

## Not ported on purpose

- The in-limit branch of the credit-limit test (click Confirm when the sale is within the limit) — it confirms a real
  Sales Order on the live instance and added no new check beyond the over-limit flow.

## Side effects

Business and edge-case tests create quotations on the live instance and do not remove them.
