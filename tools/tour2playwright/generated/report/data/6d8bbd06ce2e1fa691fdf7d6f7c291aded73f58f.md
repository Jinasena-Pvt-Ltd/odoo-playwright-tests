# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: create-a-cash-customer.spec.ts >> Create the cash Customer tour replay
- Location: generated\specs\create-a-cash-customer.spec.ts:37:5

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('#x_studio_customer_group_0')

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - banner [ref=f1e2]:
    - navigation [ref=f1e3]:
      - link "Home menu" [ref=f1e4] [cursor=pointer]:
        - /url: "#"
        - img "Contacts" [ref=f1e5]
        - generic [ref=f1e6]: Contacts
      - menu [ref=f1e7]:
        - menuitem "Contacts" [ref=f1e8] [cursor=pointer]
        - button "Configuration" [ref=f1e10] [cursor=pointer]
      - menu [ref=f1e12]:
        - button [ref=f1e14] [cursor=pointer]:
          - img "Attendance" [ref=f1e15]: 
        - button "Record" [ref=f1e17] [cursor=pointer]
        - generic [ref=f1e21]:
          - button " Guides" [ref=f1e22] [cursor=pointer]:
            - generic [ref=f1e23]: 
            - generic [ref=f1e24]: Guides
          - generic: "48"
        - button "Messages 45" [ref=f1e26] [cursor=pointer]:
          - img "Messages" [ref=f1e27]: 
          - generic [ref=f1e28]: "45"
        - button "Activities 19" [ref=f1e30] [cursor=pointer]:
          - img "Activities" [ref=f1e31]: 
          - generic [ref=f1e32]: "19"
        - button "Toggle Studio" [ref=f1e34] [cursor=pointer]:
          - img [ref=f1e35]: 
        - generic: 
        - button [ref=f1e37] [cursor=pointer]:
          - img "User" [ref=f1e38]
          - text: 
  - generic [ref=f1e41]:
    - generic [ref=f1e43]:
      - generic [ref=f1e44]:
        - button "New" [ref=f1e47] [cursor=pointer]
        - generic [ref=f1e48]:
          - list [ref=f1e49]:
            - listitem [ref=f1e50]:
              - link "Contacts" [ref=f1e51] [cursor=pointer]:
                - /url: "#"
          - generic [ref=f1e52]:
            - generic [ref=f1e53]: Cash Customer 39638C
            - button "" [ref=f1e58] [cursor=pointer]
        - generic [ref=f1e61]:
          - button "Save manually" [ref=f1e62] [cursor=pointer]:
            - generic [ref=f1e63]: 
          - button "Discard changes" [ref=f1e64] [cursor=pointer]:
            - generic [ref=f1e65]: 
      - generic [ref=f1e67]:
        - button " 0 Opportunities" [ref=f1e68] [cursor=pointer]:
          - generic [ref=f1e69]: 
          - generic [ref=f1e70]:
            - generic [ref=f1e71]: "0"
            - generic [ref=f1e72]: Opportunities
        - button " 0 Meetings" [ref=f1e73] [cursor=pointer]:
          - generic [ref=f1e74]: 
          - generic [ref=f1e75]:
            - generic [ref=f1e76]: "0"
            - generic [ref=f1e77]: Meetings
        - button " 0 Sales" [ref=f1e78] [cursor=pointer]:
          - generic [ref=f1e79]: 
          - generic [ref=f1e80]:
            - generic [ref=f1e81]: "0"
            - generic [ref=f1e82]: Sales
        - button " 0 Subscriptions" [ref=f1e83] [cursor=pointer]:
          - generic [ref=f1e84]: 
          - generic [ref=f1e85]:
            - generic [ref=f1e86]: "0"
            - generic [ref=f1e87]: Subscriptions
        - button "More" [ref=f1e89] [cursor=pointer]
      - button "Search Knowledge Articles" [ref=f1e92] [cursor=pointer]
    - generic [ref=f1e98]:
      - generic [ref=f1e100]:
        - generic [ref=f1e102]:
          - button "Edit" [ref=f1e105] [cursor=pointer]:
            - generic [ref=f1e106]: 
          - img "Binary file" [ref=f1e107]
        - generic [ref=f1e108]:
          - radiogroup "Company Type" [ref=f1e110]:
            - generic [ref=f1e111]:
              - radio "Individual" [checked] [ref=f1e112] [cursor=pointer]
              - generic [ref=f1e113] [cursor=pointer]: Individual
            - generic [ref=f1e114]:
              - radio "Company" [ref=f1e115] [cursor=pointer]
              - generic [ref=f1e116] [cursor=pointer]: Company
          - heading [level=1] [ref=f1e117]:
            - textbox "Reference" [ref=f1e119]
          - heading [level=1] [ref=f1e120]:
            - textbox "e.g. Brandom Freeman" [ref=f1e122]: Cash Customer 39638C
          - combobox "Company Name..." [ref=f1e128]
        - generic [ref=f1e129]:
          - generic [ref=f1e130]:
            - generic [ref=f1e131]:
              - combobox [ref=f1e135] [cursor=pointer]:
                - option "Contact" [selected]
                - option "Invoice Address"
                - option "Delivery Address"
                - option "Follow-up Address"
                - option "Other Address"
              - generic [ref=f1e137]:
                - textbox "Street..." [ref=f1e139]: No. 123, Galle Road
                - combobox "State" [ref=f1e144]
                - textbox "ZIP" [ref=f1e146]
                - combobox "Country" [ref=f1e152]: Sri Lanka
            - generic [ref=f1e153]:
              - generic [ref=f1e155]:
                - text: Tax ID
                - superscript [ref=f1e156]: "?"
              - textbox "Tax ID?" [ref=f1e159]:
                - /placeholder: e.g. BE0477472701
          - generic [ref=f1e160]:
            - generic [ref=f1e161]:
              - generic [ref=f1e162]: Job Position
              - textbox "Job Position" [ref=f1e166]:
                - /placeholder: e.g. Sales Director
            - generic [ref=f1e167]:
              - generic [ref=f1e168]: Phone
              - generic [ref=f1e173]:
                - textbox "Phone" [ref=f1e174]: +94 71 123 4569
                - text:  
            - generic [ref=f1e175]:
              - generic [ref=f1e176]: Mobile
              - textbox "Mobile" [ref=f1e182]
            - generic [ref=f1e183]:
              - generic [ref=f1e184]: Email
              - generic [ref=f1e189]:
                - textbox "Email" [ref=f1e190]: CDE@gmail.com
                - text: 
            - generic [ref=f1e191]:
              - generic [ref=f1e192]: Website
              - textbox "Website" [ref=f1e197]:
                - /placeholder: e.g. https://www.odoo.com
            - generic [ref=f1e198]:
              - generic [ref=f1e199]: Title
              - combobox "Title" [ref=f1e206]
            - generic [ref=f1e207]:
              - generic [ref=f1e209]:
                - text: Language
                - superscript [ref=f1e210]: "?"
              - combobox "Language?" [ref=f1e213] [cursor=pointer]:
                - option
                - option "English (US)" [selected]
                - option "Sinhala / සිංහල"
                - option "Tamil / தமிழ்"
            - generic [ref=f1e214]:
              - generic [ref=f1e215]: Tags
              - combobox "Tags" [ref=f1e223]
        - generic [ref=f1e224]:
          - list [ref=f1e226]:
            - listitem [ref=f1e227] [cursor=pointer]:
              - tab "Contacts & Addresses" [ref=f1e228]
            - listitem [ref=f1e229] [cursor=pointer]:
              - tab "Sales & Purchase" [active] [ref=f1e230]
            - listitem [ref=f1e231] [cursor=pointer]:
              - tab "Accounting" [ref=f1e232]
            - listitem [ref=f1e233] [cursor=pointer]:
              - tab "Internal Notes" [ref=f1e234]
            - listitem [ref=f1e235] [cursor=pointer]:
              - tab "Partner Assignment" [ref=f1e236]
            - listitem [ref=f1e237] [cursor=pointer]:
              - tab "Tax Registration" [ref=f1e238]
            - listitem [ref=f1e239] [cursor=pointer]:
              - tab "Customer Vendor Relation" [ref=f1e240]
            - listitem [ref=f1e241] [cursor=pointer]:
              - tab "Bank Guarantee Details" [ref=f1e242]
          - generic [ref=f1e245]:
            - generic [ref=f1e246]:
              - generic [ref=f1e247]: Sales
              - generic [ref=f1e249]:
                - generic [ref=f1e251]:
                  - text: Salesperson
                  - superscript [ref=f1e252]: "?"
                - combobox "Salesperson?" [ref=f1e259]
              - generic [ref=f1e260]:
                - generic [ref=f1e262]:
                  - text: Payment Terms
                  - superscript [ref=f1e263]: "?"
                - combobox "Payment Terms?" [ref=f1e269]
              - generic [ref=f1e270]:
                - generic [ref=f1e272]:
                  - text: Pricelist
                  - superscript [ref=f1e273]: "?"
                - combobox "Pricelist?" [ref=f1e279]: JAM General Pricelist (LKR)
              - generic [ref=f1e280]:
                - generic [ref=f1e282]:
                  - text: Payment Type
                  - superscript [ref=f1e283]: "?"
                - combobox "Payment Type?" [ref=f1e286] [cursor=pointer]:
                  - option [selected]
                  - option "Cash"
                  - option "Credit"
              - generic [ref=f1e287]:
                - generic [ref=f1e289]:
                  - text: Credit Limit
                  - superscript [ref=f1e290]: "?"
                - textbox "Credit Limit?" [ref=f1e293]: "0.00"
              - generic [ref=f1e294]:
                - generic [ref=f1e296]:
                  - text: Total Receivable
                  - superscript [ref=f1e297]: "?"
                - generic [ref=f1e298]: "0.00"
              - generic [ref=f1e301]:
                - generic [ref=f1e302]: Total Overdue
                - generic [ref=f1e304]: "0.00"
              - generic [ref=f1e307]:
                - generic [ref=f1e309]:
                  - text: Delivery Method
                  - superscript [ref=f1e310]: "?"
                - combobox "Delivery Method?" [ref=f1e316]
            - generic [ref=f1e317]:
              - generic [ref=f1e318]: Purchase
              - generic [ref=f1e320]:
                - generic [ref=f1e321]: Buyer
                - combobox "Buyer" [ref=f1e329]
              - generic [ref=f1e330]:
                - generic [ref=f1e332]:
                  - text: Payment Terms
                  - superscript [ref=f1e333]: "?"
                - combobox "Payment Terms?" [ref=f1e339]
              - generic [ref=f1e340]:
                - generic [ref=f1e342]:
                  - text: Payment Method
                  - superscript [ref=f1e343]: "?"
                - combobox "Payment Method?" [ref=f1e349]
              - generic [ref=f1e352]:
                - generic [ref=f1e353]:
                  - text: Receipt Reminder
                  - superscript [ref=f1e354]: "?"
                - checkbox "Receipt Reminder?" [ref=f1e357] [cursor=pointer]
              - generic [ref=f1e358]:
                - generic [ref=f1e360]:
                  - text: Supplier Currency
                  - superscript [ref=f1e361]: "?"
                - combobox "Supplier Currency?" [ref=f1e367]
            - generic [ref=f1e368]:
              - generic [ref=f1e369]: Point Of Sale
              - generic [ref=f1e371]:
                - generic [ref=f1e373]:
                  - text: Barcode
                  - superscript [ref=f1e374]: "?"
                - textbox "Barcode?" [ref=f1e377]
            - generic [ref=f1e378]:
              - generic [ref=f1e379]: Fiscal Information
              - generic [ref=f1e381]:
                - generic [ref=f1e383]:
                  - text: Fiscal Position
                  - superscript [ref=f1e384]: "?"
                - combobox "Fiscal Position?" [ref=f1e390]
            - generic [ref=f1e391]:
              - generic [ref=f1e392]: Misc
              - generic [ref=f1e394]:
                - generic [ref=f1e396]:
                  - text: Company ID
                  - superscript [ref=f1e397]: "?"
                - textbox "Company ID?" [ref=f1e400]
              - generic [ref=f1e401]:
                - generic [ref=f1e403]:
                  - text: Website
                  - superscript [ref=f1e404]: "?"
                - combobox "Website?" [ref=f1e410]
              - generic [ref=f1e411]:
                - generic [ref=f1e413]:
                  - text: SLA Policies
                  - superscript [ref=f1e414]: "?"
                - combobox "SLA Policies?" [ref=f1e421]
      - generic [ref=f1e423]:
        - generic [ref=f1e425]:
          - button "Send message" [ref=f1e426] [cursor=pointer]
          - button "Log note" [ref=f1e427] [cursor=pointer]
          - generic [ref=f1e428]:
            - button "Activities" [ref=f1e429] [cursor=pointer]
            - button "Search Messages" [ref=f1e431] [cursor=pointer]:
              - img [ref=f1e432]: 
            - generic [ref=f1e433]:
              - button "Attach files" [disabled]:
                - generic: 
            - generic [ref=f1e434]:
              - button "0" [disabled]:
                - img: 
                - superscript: "0"
            - button "Follow" [ref=f1e435] [cursor=pointer]
        - generic [ref=f1e438]:
          - button "You're viewing older messages Jump to Present " [ref=f1e439] [cursor=pointer]:
            - generic [ref=f1e440]: You're viewing older messages
            - generic [ref=f1e441]: Jump to Present
            - generic [ref=f1e442]: 
          - generic [ref=f1e444]:
            - generic [ref=f1e445]:
              - separator [ref=f1e446]
              - generic [ref=f1e447]: Today
              - separator [ref=f1e448]
            - group "System notification" [ref=f1e449]:
              - generic [ref=f1e450]:
                - generic "Open card" [ref=f1e452] [cursor=pointer]
                - generic [ref=f1e454]:
                  - generic [ref=f1e455]:
                    - generic "Open card" [ref=f1e456] [cursor=pointer]:
                      - strong [ref=f1e457]: Malsha Hewage
                    - generic "10/1/2026, 6:25:39 AM" [ref=f1e458]: "- 1 minute ago"
                  - generic [ref=f1e459]: Creating a new record...
  - generic:
    - generic:
      - paragraph: Press esc to exit full screen
```

# Test source

```ts
  6   |  * This is a tour REPLAY, not a module test: it intentionally uses raw selectors recorded
  7   |  * by the Odoo Tour Recorder rather than the src/modules page-object convention, and lives
  8   |  * under tools/tour2playwright/generated/ (gitignored) rather than src/modules/sales/tests/.
  9   |  *
  10  |  * See ../../REVIEW.md for every step the translator could not map with full confidence.
  11  |  */
  12  | import { test, expect, Page } from '@playwright/test';
  13  | import * as fs from 'fs';
  14  | import * as path from 'path';
  15  | import * as crypto from 'crypto';
  16  | import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';
  17  | 
  18  | const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/create-a-cash-customer');
  19  | fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  20  | 
  21  | // Tags the created contact so repeat runs don't pile up indistinguishable "Cash Customer" records.
  22  | const RUN_TAG = crypto.randomBytes(3).toString('hex').toUpperCase();
  23  | const CUSTOMER_NAME = `Cash Customer ${RUN_TAG}`;
  24  | 
  25  | async function captureStep(page: Page, sequence: number, label: string): Promise<void> {
  26  |   await page.waitForTimeout(400);
  27  |   const file = path.join(SCREENSHOT_DIR, `step-${String(sequence).padStart(3, '0')}.png`);
  28  |   await page.screenshot({ path: file });
  29  |   await test.info().attach(`step-${sequence}-${label}`, { path: file, contentType: 'image/png' });
  30  | }
  31  | 
  32  | /** Picks a dropdown/dialog row by visible text instead of the recorder's positional/index-based selector. */
  33  | async function pickByText(page: Page, container: string, text: string): Promise<void> {
  34  |   await page.locator(container).filter({ hasText: text }).first().click();
  35  | }
  36  | 
  37  | test('Create the cash Customer tour replay', async ({ page }) => {
  38  |   test.setTimeout(120_000);
  39  | 
  40  |   // Steps 10/20/30 — "Click Sales Module" → "Orders" → "Customers". Adapted: the recorded
  41  |   // `sale.res_partner_menu` ("Customers" under Orders) no longer exists in this instance's
  42  |   // Sales app menu at all — Studio customization has flattened it to Orders/To
  43  |   // Invoice/Products/Reporting/Configuration/... with no Customers entry (confirmed by
  44  |   // listing every `[data-menu-xmlid]` in the navbar; see REVIEW.md). Customer/contact
  45  |   // records are only reachable here via the separate Contacts app, which is what the
  46  |   // module's own CustomerFormPage already uses — opening that directly instead.
  47  |   await openOdooApp(page, 'Contacts');
  48  |   await captureStep(page, 30, 'open-contacts-app');
  49  | 
  50  |   // Step 40 — Click New
  51  |   await page.locator('div.d-xl-inline-flex.gap-1 > button.btn.btn-primary').click();
  52  |   await captureStep(page, 40, 'click-new');
  53  | 
  54  |   // Step 50/60 — Set Company Type to Individual (both steps select the same radio; step 60's
  55  |   // recorded title "on" is just the native HTML value of a checked radio input, not text to type).
  56  |   await page.locator('div.form-check.o_radio_item:nth-of-type(1) > label.form-check-label.o_form_label').click();
  57  |   await captureStep(page, 50, 'select-individual');
  58  |   await page.locator('#radio_field_0_person').check({ force: true }).catch(() => {});
  59  |   await captureStep(page, 60, 'individual-confirmed');
  60  | 
  61  |   // Step 70 — Customer name. Adapted: the recorded title is empty (no "value typed" field in
  62  |   // the export) — used a run-tagged placeholder name so repeat runs stay distinguishable.
  63  |   await page.locator('#name_1').fill(CUSTOMER_NAME);
  64  |   await captureStep(page, 70, 'type-name');
  65  | 
  66  |   // Step 80 — Street address. Adapted: same empty-title gap as step 70 — used a representative address.
  67  |   await page.locator('#street_0').fill('No. 123, Galle Road');
  68  |   await captureStep(page, 80, 'type-street');
  69  | 
  70  |   // Step 90 — Open the Country dropdown
  71  |   await page.locator('#country_id_0').click();
  72  |   await captureStep(page, 90, 'open-country-dropdown');
  73  | 
  74  |   // Step 100 — "Search More..." on Country
  75  |   await page.getByText('Search More...').first().click();
  76  |   await captureStep(page, 100, 'country-search-more');
  77  | 
  78  |   // Step 110 — Select "Sri Lanka". Adapted: the "Search: Country" dialog paginates
  79  |   // alphabetically (250 countries, 80 per page) — "Sri Lanka" isn't on the first page, so
  80  |   // the recorder's generic `td[name="name"]` selector would hit whatever's on page 1 instead.
  81  |   // Filter the dialog's own search box down to "Sri Lanka" first, then click the one result.
  82  |   const countryDialogSearch = page.locator('.modal input[placeholder="Search..."]').first();
  83  |   await countryDialogSearch.fill('Sri Lanka');
  84  |   await page.keyboard.press('Enter'); // the dialog's search is a searchview — typing alone only opens a suggestion menu
  85  |   await page.waitForTimeout(500);
  86  |   await pickByText(page, '.modal tbody tr', 'Sri Lanka');
  87  |   await captureStep(page, 110, 'select-sri-lanka');
  88  | 
  89  |   // Step 120 — Phone (recorded title is the literal value that was typed)
  90  |   await page.locator('#phone_0').fill('+94 711234569');
  91  |   await captureStep(page, 120, 'type-phone');
  92  | 
  93  |   // Step 130 — Email (recorded title is the literal value that was typed)
  94  |   await page.locator('#email_0').fill('CDE@gmail.com');
  95  |   await captureStep(page, 130, 'type-email');
  96  | 
  97  |   // Step 170 — Open the "Sales & Purchase" tab. Adapted: reordered ahead of steps 140-160 —
  98  |   // Customer Group, Payment Terms, and Payment Method all live on this tab, but the
  99  |   // recorded sequence numbers put the Customer Group fields (140-160) before the tab
  100 |   // click (170), which doesn't match this form's actual layout (confirmed by screenshot:
  101 |   // the field isn't present on the default "Contacts & Addresses" tab).
  102 |   await page.locator('a[name="sales_purchases"]').click();
  103 |   await captureStep(page, 170, 'sales-purchase-tab');
  104 | 
  105 |   // Step 140 — Open the Customer Group dropdown
> 106 |   await page.locator('#x_studio_customer_group_0').click();
      |                                                    ^ Error: locator.click: Test timeout of 120000ms exceeded.
  107 |   await captureStep(page, 140, 'open-customer-group-dropdown');
  108 | 
  109 |   // Step 150 — "Search More..." on Customer Group
  110 |   await page.getByText('Search More...').first().click();
  111 |   await captureStep(page, 150, 'customer-group-search-more');
  112 | 
  113 |   // Step 160 — Select the "CAC" customer group. Adapted: matched by visible text instead of
  114 |   // the recorder's positional `tr:nth-of-type(1)` — see step 110 for why a plain dialog
  115 |   // table row shouldn't be targeted by position.
  116 |   await pickByText(page, '.modal tbody tr, .modal .o_data_row', 'CAC');
  117 |   await captureStep(page, 160, 'select-cac-group');
  118 | 
  119 |   // Step 180 — Open the Payment Terms dropdown
  120 |   await page.locator('#property_payment_term_id_0').click();
  121 |   await captureStep(page, 180, 'open-payment-term-dropdown');
  122 | 
  123 |   // Step 190 — Select "Immediate Payment". Adapted: matched by visible text instead of the
  124 |   // recorder's positional `#property_payment_term_id_0_0_0`.
  125 |   await pickByText(page, '.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item', 'Immediate Payment');
  126 |   await captureStep(page, 190, 'select-immediate-payment');
  127 | 
  128 |   // Step 200 — Payment Method. Adapted: unlike the ambiguous "Cash Credit" title seen on the
  129 |   // sales-order tour, this one is unambiguous — the tour is explicitly about creating *the
  130 |   // cash* customer, so "Cash" is the clearly intended choice.
  131 |   await page.locator('#x_studio_payment_method_0').selectOption({ label: 'Cash' });
  132 |   await captureStep(page, 200, 'select-payment-method');
  133 | 
  134 |   // Step 220 — Save
  135 |   await page.locator('[data-hotkey="s"]').first().click();
  136 |   await page.waitForTimeout(1000);
  137 |   await captureStep(page, 220, 'save-customer');
  138 | 
  139 |   // Step 221 — Back to Customers list
  140 |   await page.locator('[data-hotkey="b"]').first().click();
  141 |   await captureStep(page, 221, 'back-to-customers');
  142 | 
  143 |   // Step 222 — Remove a leftover search facet, if one is present from prior navigation
  144 |   const removeFacet = page.locator('button.o_facet_remove.oi').first();
  145 |   if (await removeFacet.isVisible({ timeout: 2_000 }).catch(() => false)) {
  146 |     await removeFacet.click();
  147 |   }
  148 |   await captureStep(page, 222, 'clear-search-facet');
  149 | 
  150 |   // Step 223 — Search for the newly created customer to verify it exists. Adapted: the
  151 |   // recorded trigger `[data-hotkey="Q"]` is the search bar's own focus accelerator, not an
  152 |   // editable element — focus/click the actual search input instead, then type.
  153 |   const searchInput = page.locator('.o_searchview input, .o_searchview .o_searchview_input').first();
  154 |   await searchInput.click();
  155 |   await searchInput.fill(CUSTOMER_NAME);
  156 |   await page.keyboard.press('Enter');
  157 |   await captureStep(page, 223, 'search-new-customer');
  158 | 
  159 |   await expect(page.locator('.o_data_row, .o_kanban_record').filter({ hasText: CUSTOMER_NAME }).first()).toBeVisible();
  160 | 
  161 |   // Step 224 (recorded) is excluded — see REVIEW.md: it starts a second, unrelated "New"
  162 |   // customer form (`#radio_field_1_person`) and looks like accidental trailing recorder noise
  163 |   // rather than a real part of this tour.
  164 | });
  165 | 
```