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

---

# Review — `tour/create a cash customer.json` ("Create the cash Customer" tour)

Converted to `generated/specs/create-a-cash-customer.spec.ts` and replayed successfully
(25 recorded steps → 19 executed Playwright actions). Two real environment-drift findings
turned up during conversion — both are about things the tour recorded that **no longer
exist** in this instance, not just selector fragility.

## Environment drift (the tour was recorded against an older menu/form configuration)

| Sequence | Recorded step | Finding |
|---|---|---|
| 20/30 | Click `[data-menu-xmlid="sale.sale_order_menu"]` then `[data-menu-xmlid="sale.res_partner_menu"]` ("Customers") | **The "Customers" menu item no longer exists anywhere in the Sales app.** Listed every `[data-menu-xmlid]` in the navbar — it only has Orders, To Invoice, Products, Reporting, Configuration, and three Studio-added views (Pivot Views, Sales Invoices, "Sales - Production Request Status", "AAAA"). Adapted by opening the **Contacts** app directly instead (`openOdooApp(page, 'Contacts')`) — same underlying `res.partner` records, and what the module's own `CustomerFormPage` already uses. |
| 140/150/160 | Open `#x_studio_customer_group_0`, "Search More...", select "CAC" | **The `x_studio_customer_group` field no longer exists on the contact form at all** — checked every tab's field names (`Contacts & Addresses`, `Sales & Purchase`, `Accounting`, `Internal Notes`, `Partner Assignment`, `Tax Registration`, `Customer Vendor Relation`, `Bank Guarantee Details`); none contain anything "group"-related. This Studio customization appears to have been removed since the tour was recorded. These three steps are **skipped entirely** in the replay. |

Both findings point the same direction: this tour was recorded against an earlier version
of the Sales/Contacts Studio customization. Worth flagging to whoever owns that
customization — if "Customers" and the customer-group field were removed deliberately,
fine; if not, something regressed.

## Selector robustness adaptations

| Sequence | Recorded step | What was adapted | Why |
|---|---|---|---|
| 70/80/90/120/130/140-ish | Fields like `#name_1`, `#street_0`, `#phone_0`, `#email_0`, `#country_id_0` | Re-targeted every form field by its stable `name` attribute (`.o_field_widget[name="..."] input`) instead of the recorder's auto-incrementing DOM id | These ids are assigned by render order and are **not stable across runs** — confirmed directly: `#name_1` worked on one run and timed out on the very next, because a different number of widgets happened to render before it. This is a general finding, not specific to this tour — the same risk applies to any tour export using `#field_N` style ids. |
| 90/100/110 | Open country dropdown → "Search More..." → click `td[name="name"]` for "Sri Lanka" | Typed `"Sri Lanka"` into the dialog's own search box (and pressed Enter — typing alone only opens a suggestion link, it doesn't filter) before clicking the one resulting row | The "Search: Country" dialog lists all 250 countries, 80 per page, alphabetically — "Sri Lanka" isn't on page 1, so clicking by position or by a generic `td[name="name"]` would hit whatever's on the visible page instead. |
| 70/80 | Type name / street (both recorded with an empty title — no "value typed" field in the export) | Used a run-tagged placeholder name (`Cash Customer <RUN_TAG>`) and a representative Sri Lankan address | No way to recover the actual typed value from the export; chose values consistent with the tour's own purpose (a cash/walk-in customer). |
| 170 vs 140-160 | "Sales & Purchase" tab click recorded *after* the Customer Group steps | Reordered the tab click to happen first | Customer Group (when it existed), Payment Terms, and Payment Method all live under the "Sales & Purchase" tab — the recorded sequence numbers don't match the form's actual tab layout. |
| 180/190 | Open Payment Terms dropdown, select "Immediate Payment" (recorded as positional `#property_payment_term_id_0_0_0`) | Typed `"Immediate"` into the field first (the dropdown shows no options on a bare click — only once there's text to filter by), then matched the option by visible text | Same unstable-id issue as above, plus the field genuinely needs typed input to show any suggestions at all. |
| 200 | Select Payment Method (recorded title "Cash Credit") | Picked **"Cash"** | Unlike the ambiguous case on the sales-order tour, this one is unambiguous: the entire tour is about creating *the cash* customer. |
| 223 | `[data-hotkey="Q"]` ("Search...") | Clicked the actual search input (`.o_searchview input`) instead of the hotkey-accelerator element, then typed the customer's name and pressed Enter to verify it was created | The hotkey selector isn't itself an editable element. |

## Excluded step

**Sequence 224** (`run: edit` on `#radio_field_1_person`) is excluded — it starts a second,
unrelated "New" contact form (note the `_1` index, vs. `_0` for the customer created in this
tour) immediately after the verification search. This looks like accidental trailing
recorder noise (the user clicking "New" again before stopping the recording) rather than
a real part of the "create a cash customer" flow.

## Localization

Same situation as the sales-order tour: `si_LK` and `ta_IN` are untranslated copies of the
`en_US` text for every step, so only one manual was generated
(`manuals/create-a-cash-customer.en_US.html` / `.md`).

## What this spec actually exercises

Creates a real Individual contact (`res.partner`) with name, address (Sri Lanka), phone,
email, "Immediate Payment" payment term, and "Cash" payment method, saves it, and verifies
it's findable by search. Each run creates a new contact tagged with a random run suffix
(`Cash Customer <TAG>`) so repeat runs don't produce indistinguishable duplicates.
