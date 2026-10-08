# Prompt — build, run and report the Sales test module

Paste everything below the line into Claude Code, opened in the `odoo-playwright-tests` folder.

---

Build and run the **Sales** test module for our Odoo 17 instance in this repo (`odoo-playwright-tests`).

## Rules
- Work **only inside this repo**. Do not read, edit or run anything in any other folder or repo without asking me first.
- Follow `CLAUDE.md`: 7-step layout `src/modules/sales/tests/01-config … 07-archive`, import `test`/`expect` from `src/core/fixtures/index`, tags `@module:sales @step:<step>` on every `test.describe`, no edits to `src/core`.
- Tests drive the **browser UI** through page objects (`pages/SalesPage.ts`). No RPC for test steps.
- Do **not** change Odoo users, groups, approvers or permissions yourself. If a test needs one, tell me exactly what to change and where.
- Before any action that creates or confirms real records (for example confirming a Sales Order), say so.
- Report honestly. If a test passes, check *why* (the message Odoo showed). A pass caused by an error popup is not a pass.

## Environment
- `.env`: `ODOO_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (user Malsha Hewage). Optional `ODOO_APPROVER_EMAIL` / `ODOO_APPROVER_PASSWORD`.
- Run with `npx playwright test --project=setup --project=admin --grep @module:sales`. Use `HEADLESS=false` when I ask to watch.
- Existing data the tests select (never create): company "Jinasena Agricultural Machinery (Pvt) Ltd."; customer "Test Customer - Playwright 1" (group DISTR); team "Colombo Sales Centre"; warehouse "JAM Warehouse Ekala- (JM-EK)"; products "CENTRIC TYPE PUMPING UNIT EPC 10CJ 024S" and "BALL BEARING 6202-2RS"; tax "VAT 18% (Sales)". Keep them in `data/sales.master-data.ts` with `SALES_*` overrides.

## Tests to write
1. **Config:** Sales app opens; company switch; quotation list; blank new quotation (customer empty and editable); Minimum Sales Margin is set (Sales ▸ Configuration ▸ Settings ▸ Sales tab).
2. **Business:** amounts add up (line net, untaxed, VAT, total; VAT % read from Accounting ▸ Taxes); line below the minimum margin needs approval and hides Confirm (product costs come from the Cost column of the Products list); over-limit sale (huge quantity) requests credit-limit approval and Confirm stays hidden; once all approvals are done the order confirms (work through every "Request X Approval" → "Approve X" until Confirm appears; skip with the blocking approval named if the user cannot approve).
3. **Reporting, Permissions, Archive:** placeholders that skip with a reason (until real tests are written).
4. **Validations:** eight separate, explicitly written tests (05.1 Customer, 05.2 Order Payment Type, 05.3 Quotation Type, 05.4 Payment Terms, 05.5 Salesperson, 05.6 Sales Team, 05.7 Company, 05.8 Warehouse): fill a new quotation, **really empty the field under test**, confirm it is empty, Save, then expect the save to be refused. After a save that succeeds, open the saved quotation and read the field. Plus the Bank Guarantee check on the distributor customer (amount blank, expiry blank, both blank must be refused; never save the customer).
5. **Edge cases:** a zero-quantity line and a zero-unit-price line cannot be confirmed.

## Odoo 17 behaviours to respect (learned the hard way)
- Many2one autocomplete list is `.o-autocomplete--dropdown-menu`. **Never press Escape or Tab** while it is open: it crashes Odoo's dropdown ("Cannot read properties of undefined (reading 'nextElementSibling')") and shows an "Odoo Client Error". Clear a field with click → select all → Delete → click a blank spot.
- Error dialogs are `role="dialog"` ("Oh snap!"); the `.o_dialog` wrapper is never "visible". Treat a JavaScript "Client Error" as a **failure**, not as a refusal.
- After a successful save Odoo shows the Save icon again. Saved = no dialog, no invalid field, and either the Save button is gone or the title changed from "New" to the number (S0…). A form with no Save button has nothing to save.
- Odoo fills Payment Terms, Salesperson, Sales Team, Company, Warehouse by default; "not touched" is not "blank".
- "Taxes" is in the "+" overflow menu of the Accounting top bar (`a.o_more_dropdown_section`).
- Approvals are Studio rules; only members of the rule's group can click Approve ("Jin - Sales - Credit Limit Approvers", "… Bank Guarantee Approvers", and similar). The "Responsible" user on the server action does not grant that right.
- Customer Group can show as plain read-only text (DISTR).
- Retry `page.goto` on `ERR_CONNECTION_TIMED_OUT`, `ERR_NAME_NOT_RESOLVED` and similar; use generous timeouts (the instance can be slow).

## Reports I want
- After each run: a short HTML report (`Test-Run-Report-N.html`) with every test across all runs so far, what failed and why, and what to do to make it pass.
- The master report: `node scripts/generate-report.js`, run **right after** a full uninterrupted Playwright run (Playwright empties `test-results/` at the start of every run, so `results.json` is gone after any later run). Confirm the counts in it match the run.
- Tell me the full path of every report you create.
