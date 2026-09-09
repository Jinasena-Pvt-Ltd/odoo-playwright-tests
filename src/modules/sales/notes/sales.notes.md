# Sales — Notes

Free-form domain notes for the sales module: Odoo quirks, SaaS-specific
constraints, decisions, and anything future contributors on this branch
should know that doesn't belong in test code or CLAUDE.md.

## Live environment changes made for testing (2026-09-09)

- **Admin added to "Sales / Jin - Sales - Sales Margin Approvers" (group id 131).**
  The `admin` test account (uid 749, distinct from any personal Jinasena login) was not
  originally a member, so it could request but never grant Insufficient Margin approval
  (confirmed via `studio.approval.rule.check_approval` returning `can_validate: false`).
  Added via direct RPC (`res.groups.write` with `users: [[4, 749]]`) so the 02-business
  Insufficient Margin test can exercise the full request→approve→confirm flow. This is a
  real, live change to the shared Odoo instance's security config, not a test-local
  fixture — if that test starts failing after an environment reset, check this first.
  The 04-permissions test was retargeted from Insufficient Margin (no longer blocked) to
  Credit Limit approval, since admin is confirmed NOT a member of "Sales / Jin - Sales -
  Credit Limit Approvers" (group id 125) — that rule still demonstrates real enforcement.
- **Sales Orders cannot be archived in this environment — confirmed at the model level,
  not a UI/Studio hiding of the button.** `sale.order.fields_get()` shows this model has
  no `active` field at all here, which is why Archive/Unarchive never appear in the cog
  menu (form or list) and why the search panel never offers an "Archived" filter — Odoo
  only adds those when the model has `active`. Restoring this would mean adding an
  `active` field to the live `sale.order` schema, a structural change with wide blast
  radius (affects every default query across the system) — deliberately NOT done as part
  of this test suite. The 07-archive tests check for the "Archive" action's availability
  and skip with this exact explanation rather than assume it exists.

## Migrated from legacy_tests/ (2026-09-07)

The original `legacy_tests/` folder (20 spec files + `helpers.ts`) was a
pre-convention Playwright suite written directly against a specific Jinasena
Odoo SaaS instance. Its business-logic coverage was ported into the current
7-step structure; the folder itself has been deleted. Key carry-over notes:

- **Quotation Type** and **"Order Payment Type"** are custom Studio selection
  widgets (not standard `sale.order` field names we could rely on) —
  `SalesFormPage.setQuotationType()`/`setOrderPaymentType()` locate them by
  visible label instead of a `[name=...]` attribute.
  **CORRECTED (2026-09-08):** these were originally assumed to be the same
  field (legacy step-05.2/05.3 were merged into one validation test on that
  assumption). Confirmed via live DOM inspection they are two entirely
  separate, independently-required fields — "Order Payment Type" is
  `x_studio_order_payment_method` (`<select>`: "", "Cash", "Credit"). The
  original merge left "Order Payment Type" unfilled everywhere, which silently
  blocked every save with "Invalid fields: Order Payment Type" — surfacing
  only as a mysterious multi-second save timeout, since Odoo never sends a
  save request at all when a required field is invalid (confirmed via network
  logging: zero requests fire in that state). Fixed by adding
  `setOrderPaymentType()`, calling it everywhere `setQuotationType()` is
  called, and splitting the merged validation test back into two.
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

## Self-sufficient master data (2026-09-08)

Customer no longer requires pre-existing environment config — the `salesMasterData`
worker-scoped fixture (`src/core/fixtures/salesMasterData.fixtures.ts`) creates a fresh
Customer via the browser UI once per test-run worker, using `navigateToAction()` and the
same `SalesCustomerFormPage` page object tests already use. Tests consume the generated
name via the `salesMasterData` fixture instead of `SALES_TEST_CONFIG`.

**Product is deliberately NOT fixture-created — reverted after testing (2026-09-08).**
The fixture originally also created two fresh Products the same way, but pricing a
brand-new product for the first time under a customer's specific pricelist ("JAM
General Pricelist (LKR)") was found to hang or take far longer than any reasonable
timeout on this instance. Confirmed directly: the exact same order-line flow with an
established, already-priced product (`SALES_TEST_CONFIG.product`, currently `BALL
BEARING 6202-2RS`) works reliably; only fresh, never-before-priced products triggered
the hang. This looks like server-side pricelist computation behavior, not a client-side
timing race — worth checking Odoo's backend logs for that pricelist's rule configuration
if it needs revisiting. Until then, Product joins Sales Team/Warehouse/Quotation Type as
pre-existing config in `sales.master-data.ts`.

Sales Team and Warehouse remain pre-existing environment config by deliberate choice —
creating a Warehouse in Odoo triggers real side effects (auto-generated stock
locations/routes/picking types) and there's no proven UI-archive flow for it in this
repo, so it isn't safe to create-and-tear-down every run. Quotation Type stays static
too — it's a fixed Studio enum value, not a creatable record.

The fixture throws (failing the whole worker's tests with a clear setup error) if
Customer creation itself fails — this is deliberate: the whole point of the change is to
guarantee the data exists, so silently swallowing a creation failure would just relocate
the old "maybe it's there" uncertainty to a new place. Downstream tests keep their
`if (!found) test.skip(...)` guards around the Many2one selection step itself, since
`selectIfExists`'s occasional dropdown-render flakiness on this slow instance is a
separate, real concern from data existence.

Teardown archives the Customer (via `BaseFormPage.archiveRecord()`, respecting
`SKIP_ARCHIVE`) but does nothing for Sales Team/Warehouse/Product, since those are no
longer created by this fixture.

**Caveat on the "pricelist hang" diagnosis above:** a meaningful share of this session's
save/order-line flakiness turned out to be a genuinely unstable local internet
connection during testing (confirmed by the user), not purely server-side pricelist
computation or client-side races. The specific fresh-product-under-pricelist hang was
still reproduced multiple times with clean, fast, working connectivity elsewhere in the
same session, so that finding stands — but treat any *other* one-off "instance is slow"
observation from this session with more skepticism than the notes above might imply.

## `save()` fails fast on a blocked/invalid required field (2026-09-08)

`BaseFormPage.save()` now checks for `.o_field_widget.o_field_invalid` ~3s after
clicking Save and throws immediately (naming the field when Odoo exposes a `name`
attribute on it) instead of waiting the full timeout. Root cause this fixed: Odoo never
sends a save request at all while a required field is invalid (confirmed via network
logging — zero `call_kw` requests fire), so the old behavior of just waiting longer for
`.o_form_button_save` to hide could never succeed and only produced a confusing
multi-second timeout. This is what led to discovering the Order Payment Type bug above.
