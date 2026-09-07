# Sales — Notes

Free-form domain notes for the sales module: Odoo quirks, SaaS-specific
constraints, decisions, and anything future contributors on this branch
should know that doesn't belong in test code or CLAUDE.md.

## Migrated from legacy_tests/ (2026-09-07)

The original `legacy_tests/` folder (20 spec files + `helpers.ts`) was a
pre-convention Playwright suite written directly against a specific Jinasena
Odoo SaaS instance. Its business-logic coverage was ported into the current
7-step structure; the folder itself has been deleted. Key carry-over notes:

- **Quotation Type / "Order Payment Type"** is a custom selection widget (not
  a standard `sale.order` field name we could rely on) — `SalesFormPage.setQuotationType()`
  locates it by visible label instead of a `[name=...]` attribute. Legacy
  step-05.2 ("blank Order Payment Type") and step-05.3 ("blank Quotation Type")
  turned out to test the exact same field/widget — they were merged into one
  validation test instead of shipping a literal duplicate.
- **Bank Guarantee / Customer Group fields** (`x_customer_group_id`,
  `x_bank_guarantee_amount`, `x_bank_guarantee_expiry_date`) are Odoo Studio
  custom fields on `res.partner`. Technical names are a best guess based on
  the legacy code's own fallback list — if this Odoo instance uses different
  Studio field names, update `SalesCustomerFormPage` accordingly. The
  validation test gracefully skips if the tab/fields aren't found.
- **Confirm / Request Approval / Approve buttons** were observed living in
  either `.o_statusbar_buttons` or `.o_control_panel` depending on legacy
  test/viewport — `SalesFormPage.statusButton()` matches both.
- **Minimum Sales Margin** and **product Cost** used to be scraped live from a
  custom "Sales Configurations" record and the Products app (very fragile,
  multi-fallback selectors in the legacy code). The margin business test now
  forces an unambiguous below-cost unit price (1) instead of reading the
  configured threshold, and skips gracefully if the approval workflow isn't
  configured — see `SalesCalculations.computeMarginPercent` /
  `isBelowMinimumMargin` for the underlying formula.
- **Credit Limit Control**: legacy scraped a "Total Overdue" widget with three
  fallback strategies to compute `CURRENT_BALANCE`. The ported test avoids
  this entirely by using a deliberately huge quantity so the quotation total
  should exceed any realistic credit limit, then asserts Confirm and Request
  Credit Limit Approval are mutually exclusive rather than pre-computing the
  expected boolean.
- **Company switching**: legacy tests explicitly switched to
  "Jinasena Agricultural Machinery (Pvt) Ltd." before every scenario. This was
  dropped from the ported tests (not core business logic) — if master data
  lookups start failing in this environment because the default session
  company differs, that's the first thing to check.
- **Dropped entirely** (no test-worthy assertions): `step-01-login`,
  `step-02-open-sales-app`, `step-03-change-company`,
  `step-04-navigate-quotations` (pure navigation boilerplate, superseded by
  `auth.setup.ts` + `BasePage.navigateTo`), and `read-product-cost.spec.ts`
  (dumped a value to a text file, asserted nothing).
