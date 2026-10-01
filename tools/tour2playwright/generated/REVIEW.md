# Review — `tour/sales.json` ("Sales Order" tour)

Converted to `generated/specs/sales.spec.ts` and replayed successfully (100 recorded steps →
27 distinct Playwright actions; the JSON's per-locale title/content fields collapse to a
1:1 step per sequence number). All steps passed on replay — the spec is a reasonable
regression test, but treat the items below as things to verify by hand, not settled facts.

## Steps the translator could not map with full confidence

| Sequence | Recorded step | What was adapted | Why |
|---|---|---|---|
| 10 | Click `[data-menu-xmlid="sale.sale_menu_root"]` | Replaced with `openOdooApp(page, 'Sales')` (clicks the Home-menu app tile) | A plain selector click/goto from a cold session doesn't reliably land in the Sales app on this instance — confirmed separately while building the `sales` module's own tests. The recorded selector assumes the app-switcher grid is already open. |
| 50/60 | Type into customer search, then click `#autocomplete_0_2` | Typed the literal text `"abc"` (the next step's recorded title) and matched the resulting option by **visible text** instead of the index-based `#autocomplete_0_2` id | The tour export has no explicit "value typed" field for `run: edit` steps — only the next step's title hints at what was selected. Autocomplete ids (`#autocomplete_N_N`) are assigned by DOM order per page load and are not stable across runs. `"abc"` also appears to be throwaway/placeholder test data in this instance (a contact literally named "abc") rather than a real customer — confirm this is intentional before relying on this spec as a template. |
| 70 | Select on `#x_studio_order_payment_method_0` | Picked **"Cash"** | The recorded step's title is `"Cash Credit"` — both options concatenated, not the one actually chosen during recording. "Cash" was picked to match the module's own validated business-flow test (`src/modules/sales/tests/02-business/sales.business.spec.ts`), but the recording may have intended "Credit". |
| 80 | Select on `#x_studio_quotation_type_0` | Picked **"Sales"** | Same ambiguity as above — recorded title `"Sales Project Repair"` lists all three options, not the chosen one. "Sales" is the most generic/likely-intended choice for a sales-order tour. |
| 83/84 | Type into product search, then click `#autocomplete_0_0` | Typed `"02BB 023"` and matched the option by visible text `"[02BB 023] BALL BEARING 6202-2RS"` instead of the index-based id | Same autocomplete-id instability as steps 50/60. |
| 97 | Click `tr.o_data_row.o_row_draggable:nth-of-type(4) > td...` | Matched the row by visible text `"Customer Receipts - Cash"` instead of position (`nth-of-type(4)`) | A positional row selector breaks the moment the journal list is reordered, filtered, or a new journal is added above it. Text match is far more durable. |

## Steps that mapped cleanly (no adaptation needed)

Everything else — navigating Orders → Quotations → New, clicking "Add a product", the
quantity cell click, Confirm/Validate/Back hotkey buttons, every smart-button navigation
(Delivery, Invoices, Sale Orders), and the Register Payment / Create Payment flow — used
the recorder's exact selectors as-is and replayed without any changes.

## Localization

The export's `si_LK` and `ta_IN` fields are **untranslated copies of the `en_US` text**
for every step (e.g. `title_i18n.si_LK` = `"Orders"`, same as English). Since there's no
actual translated content to render, only one manual was generated
(`manuals/sales.en_US.html` / `.md`) rather than three near-identical copies. Re-run
`node build-manual.js sales ../../tour/sales.json` after adding real translations to the
source tour if locale-specific manuals are needed later.

## What this spec actually exercises

A full order-to-cash flow on a live Odoo 17 instance:
quotation creation → customer/payment-type/quotation-type selection → add product line →
confirm → deliver → validate delivery → create invoice → confirm invoice → register
payment → select "Customer Receipts - Cash" journal → create payment. This creates **real
records** on `${ODOO_BASE_URL}` (it's running against the same database the main test
suite uses) — re-running it repeatedly will create a new quotation/delivery/invoice/payment
each time, same as any of the module's own business-flow tests.
