/**
 * Generated from tour/"create a cash customer.json" ("Create the cash Customer" tour):
 * creates a walk-in/cash customer contact with address, phone, email, customer group,
 * payment term, and payment method, then verifies it by searching for it.
 *
 * This is a tour REPLAY, not a module test: it intentionally uses raw selectors recorded
 * by the Odoo Tour Recorder rather than the src/modules page-object convention, and lives
 * under tools/tour2playwright/generated/ (gitignored) rather than src/modules/sales/tests/.
 *
 * See ../../REVIEW.md for every step the translator could not map with full confidence.
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { openOdooApp } from '../../../../src/modules/sales/pages/openOdooApp';

const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots/create-a-cash-customer');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Tags the created contact so repeat runs don't pile up indistinguishable "Cash Customer" records.
const RUN_TAG = crypto.randomBytes(3).toString('hex').toUpperCase();
const CUSTOMER_NAME = `Cash Customer ${RUN_TAG}`;

async function captureStep(page: Page, sequence: number, label: string): Promise<void> {
  await page.waitForTimeout(400);
  const file = path.join(SCREENSHOT_DIR, `step-${String(sequence).padStart(3, '0')}.png`);
  await page.screenshot({ path: file });
  await test.info().attach(`step-${sequence}-${label}`, { path: file, contentType: 'image/png' });
}

/** Picks a dropdown/dialog row by visible text instead of the recorder's positional/index-based selector. */
async function pickByText(page: Page, container: string, text: string): Promise<void> {
  await page.locator(container).filter({ hasText: text }).first().click();
}

/** A form field's input, targeted by Odoo's stable `name` attribute instead of its
 * auto-incrementing DOM id (`#name_1`, `#street_0`, ...) — those ids depend on render
 * order and are not stable across runs/sessions (confirmed: the same tour hit a
 * different id suffix on a second run). */
function field(page: Page, name: string) {
  return page.locator(`.o_field_widget[name="${name}"] input`).first();
}

test('Create the cash Customer tour replay', async ({ page }) => {
  test.setTimeout(120_000);

  // Steps 10/20/30 — "Click Sales Module" → "Orders" → "Customers". Adapted: the recorded
  // `sale.res_partner_menu` ("Customers" under Orders) no longer exists in this instance's
  // Sales app menu at all — Studio customization has flattened it to Orders/To
  // Invoice/Products/Reporting/Configuration/... with no Customers entry (confirmed by
  // listing every `[data-menu-xmlid]` in the navbar; see REVIEW.md). Customer/contact
  // records are only reachable here via the separate Contacts app, which is what the
  // module's own CustomerFormPage already uses — opening that directly instead.
  await openOdooApp(page, 'Contacts');
  await captureStep(page, 30, 'open-contacts-app');

  // Step 40 — Click New
  await page.locator('div.d-xl-inline-flex.gap-1 > button.btn.btn-primary').click();
  await captureStep(page, 40, 'click-new');

  // Step 50/60 — Set Company Type to Individual (both steps select the same radio; step 60's
  // recorded title "on" is just the native HTML value of a checked radio input, not text to
  // type). Adapted: targeted by role/label instead of the recorder's auto-incrementing
  // `#radio_field_0_person` id.
  await page.getByRole('radio', { name: 'Individual' }).check({ force: true });
  await captureStep(page, 50, 'select-individual');
  await captureStep(page, 60, 'individual-confirmed');

  // Step 70 — Customer name. Adapted: the recorded title is empty (no "value typed" field in
  // the export) — used a run-tagged placeholder name so repeat runs stay distinguishable.
  // Targeted by `name="name"` instead of the recorder's `#name_1` (unstable id suffix).
  await field(page, 'name').fill(CUSTOMER_NAME);
  await captureStep(page, 70, 'type-name');

  // Step 80 — Street address. Adapted: same empty-title gap as step 70 — used a
  // representative address; targeted by `name="street"` instead of `#street_0`.
  await field(page, 'street').fill('No. 123, Galle Road');
  await captureStep(page, 80, 'type-street');

  // Step 90 — Open the Country dropdown. Adapted: targeted by `name="country_id"`.
  await page.locator('.o_field_widget[name="country_id"] input').first().click();
  await captureStep(page, 90, 'open-country-dropdown');

  // Step 100 — "Search More..." on Country
  await page.getByText('Search More...').first().click();
  await captureStep(page, 100, 'country-search-more');

  // Step 110 — Select "Sri Lanka". Adapted: the "Search: Country" dialog paginates
  // alphabetically (250 countries, 80 per page) — "Sri Lanka" isn't on the first page, so
  // the recorder's generic `td[name="name"]` selector would hit whatever's on page 1 instead.
  // Filter the dialog's own search box down to "Sri Lanka" first, then click the one result.
  const countryDialogSearch = page.locator('.modal input[placeholder="Search..."]').first();
  await countryDialogSearch.fill('Sri Lanka');
  await page.keyboard.press('Enter'); // the dialog's search is a searchview — typing alone only opens a suggestion menu
  await page.waitForTimeout(500);
  await pickByText(page, '.modal tbody tr', 'Sri Lanka');
  await captureStep(page, 110, 'select-sri-lanka');

  // Step 120 — Phone (recorded title is the literal value that was typed). Adapted: targeted
  // by `name="phone"` instead of `#phone_0`.
  await field(page, 'phone').fill('+94 711234569');
  await captureStep(page, 120, 'type-phone');

  // Step 130 — Email (recorded title is the literal value that was typed). Adapted: targeted
  // by `name="email"` instead of `#email_0`.
  await field(page, 'email').fill('CDE@gmail.com');
  await captureStep(page, 130, 'type-email');

  // Step 170 — Open the "Sales & Purchase" tab (Payment Terms and Payment Method live here).
  await page.locator('a[name="sales_purchases"]').click();
  await captureStep(page, 170, 'sales-purchase-tab');

  // Steps 140/150/160 (recorded "Customer Group" selection, field `x_studio_customer_group`)
  // are SKIPPED — that field no longer exists anywhere on this contact form in this instance
  // (checked every tab's field names; none contain "group"). Same kind of environment drift
  // as the missing `sale.res_partner_menu` menu item above — the tour was recorded against
  // an older version of this Studio customization. See REVIEW.md.

  // Step 180 — Open the Payment Terms dropdown. Adapted: targeted by
  // `name="property_payment_term_id"` instead of `#property_payment_term_id_0`, and types
  // the target text first — this many2one's dropdown doesn't show any options on a bare
  // click, only once there's something to filter by.
  const paymentTermInput = page.locator('.o_field_widget[name="property_payment_term_id"] input').first();
  await paymentTermInput.click();
  await paymentTermInput.fill('Immediate');
  await captureStep(page, 180, 'open-payment-term-dropdown');

  // Step 190 — Select "Immediate Payment". Adapted: matched by visible text instead of the
  // recorder's positional `#property_payment_term_id_0_0_0`.
  await pickByText(page, '.o-dropdown--menu .o_menu_item, .ui-autocomplete .ui-menu-item', 'Immediate Payment');
  await captureStep(page, 190, 'select-immediate-payment');

  // Step 200 — Payment Method. Adapted: unlike the ambiguous "Cash Credit" title seen on the
  // sales-order tour, this one is unambiguous — the tour is explicitly about creating *the
  // cash* customer, so "Cash" is the clearly intended choice. Targeted by
  // `name="x_studio_payment_method"` instead of `#x_studio_payment_method_0`.
  await page.locator('.o_field_widget[name="x_studio_payment_method"] select').selectOption({ label: 'Cash' });
  await captureStep(page, 200, 'select-payment-method');

  // Step 220 — Save
  await page.locator('[data-hotkey="s"]').first().click();
  await page.waitForTimeout(1000);
  await captureStep(page, 220, 'save-customer');

  // Step 221 — Back to Customers list
  await page.locator('[data-hotkey="b"]').first().click();
  await captureStep(page, 221, 'back-to-customers');

  // Step 222 — Remove a leftover search facet, if one is present from prior navigation
  const removeFacet = page.locator('button.o_facet_remove.oi').first();
  if (await removeFacet.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await removeFacet.click();
  }
  await captureStep(page, 222, 'clear-search-facet');

  // Step 223 — Search for the newly created customer to verify it exists. Adapted: the
  // recorded trigger `[data-hotkey="Q"]` is the search bar's own focus accelerator, not an
  // editable element — focus/click the actual search input instead, then type.
  const searchInput = page.locator('.o_searchview input, .o_searchview .o_searchview_input').first();
  await searchInput.click();
  await searchInput.fill(CUSTOMER_NAME);
  await page.keyboard.press('Enter');
  await captureStep(page, 223, 'search-new-customer');

  await expect(page.locator('.o_data_row, .o_kanban_record').filter({ hasText: CUSTOMER_NAME }).first()).toBeVisible();

  // Step 224 (recorded) is excluded — see REVIEW.md: it starts a second, unrelated "New"
  // customer form (`#radio_field_1_person`) and looks like accidental trailing recorder noise
  // rather than a real part of this tour.
});
