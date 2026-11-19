/**
 * Step 5 — Field Validations for the fix_repair module.
 *
 * What Fix-repair enforces on the repair ticket form (helpdesk_ticket._get_view, Rename-All):
 * - Type is required once the ticket has an assignee (Assign to Me).
 * - Once a Type is set: Customer, Repair Reason and Product are required (Job Location is
 *   required too but read-only at that point, so Odoo does not check it on save).
 * - Return Receipt Location is required once the ticket has an assignee.
 * - Serial No is required for every repair type except "Without Serial No".
 * - The ticket number is never editable and the stage bar is not clickable.
 * - "Create Serial No" only appears for "Without Serial No" tickets with a product and no serial;
 *   "Return" only once customer, type, job location, reason, product and serial are all set.
 * Catalogues (e.g. Resolutions, Helpdesk > Repair Diagnosis) require a Name.
 * Odoo blocks the save on the client: the missing fields get .o_field_invalid and an
 * "Invalid fields" notification lists their labels.
 */
import { Page } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { isVisibleWhenIdle, waitForOdooIdle } from '../../../../core/utils/OdooIdle';
import { FixRepairTicketPage } from '../../pages/FixRepairTicketPage';
import { FIX_REPAIR_TEST_CONFIG } from '../../data/fix_repair.master-data';
import { FIX_REPAIR_MANDATORY_FIELDS } from '../../data/fix_repair.validation-cases';

const field = (page: Page, name: string) => page.locator(`.o_field_widget[name="${name}"]`).first();

/** Save the open form expecting Odoo to refuse it; returns the "Invalid fields" notification text. */
async function saveExpectingInvalid(page: Page): Promise<string> {
  await page.locator('.o_form_button_save:visible, button[name="save_manually"]:visible, .o_list_button_save:visible').first().click();
  const toast = page.locator('.o_notification_manager .o_notification', { hasText: 'Invalid fields' }).first();
  await expect(toast, 'Odoo refused the save with an "Invalid fields" notification').toBeVisible({ timeout: 10_000 });
  return (await toast.textContent()) ?? '';
}

/** Make the form dirty so Save is enabled (the priority star saves on its own; Customer does not). */
async function touchForm(page: Page, ticketPage: FixRepairTicketPage) {
  await ticketPage.customer.setValue(FIX_REPAIR_TEST_CONFIG.customerExample);
  await waitForOdooIdle(page);
}

/** A new ticket, assigned to the current user (Assign to Me saves it and sets the assignee). */
async function newAssignedTicket(page: Page): Promise<FixRepairTicketPage> {
  const ticketPage = new FixRepairTicketPage(page);
  await ticketPage.navigate();
  await ticketPage.assignToMe();
  await waitForOdooIdle(page);
  return ticketPage;
}

test.describe('Fix Repair Field Validations @module:fix_repair @step:validations', () => {
  test('Type is required once the ticket is assigned @smoke', async ({ page }) => {
    const ticketPage = await newAssignedTicket(page);
    await touchForm(page, ticketPage);
    const message = await saveExpectingInvalid(page);
    expect(message).toContain('Type');
    await expect(field(page, 'ticket_type_id')).toHaveClass(/o_field_invalid/);
  });

  for (const c of FIX_REPAIR_MANDATORY_FIELDS) {
    test(`${c.module}: ${c.field} is required once the repair type is set`, async ({ page }) => {
      const ticketPage = await newAssignedTicket(page);
      await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyNoSerial);
      await waitForOdooIdle(page);
      const message = await saveExpectingInvalid(page);
      expect(message, `"${c.expectedError}" listed in the notification`).toContain(c.expectedError);
      await expect(field(page, c.attemptedValue)).toHaveClass(/o_field_invalid/);
      await expect(field(page, 'serial_no'), 'Serial No not required without a serial').not.toHaveClass(/o_field_invalid/);
    });
  }

  test('Serial No is required for "With Serial No" repairs', async ({ page }) => {
    const ticketPage = await newAssignedTicket(page);
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyWithSerial);
    await waitForOdooIdle(page);
    const message = await saveExpectingInvalid(page);
    expect(message).toContain('Serial');
    await expect(field(page, 'serial_no')).toHaveClass(/o_field_invalid/);
  });

  test('the ticket number is read-only and the stage bar is not clickable', async ({ page }) => {
    await newAssignedTicket(page);
    await expect(page.locator('.o_field_widget[name="name"] input')).toHaveCount(0);
    // The stages are radio buttons; the bar's "More..." dropdown is an ordinary button.
    const stages = page.getByRole('radiogroup', { name: 'Statusbar' }).getByRole('radio');
    expect(await stages.count(), 'stage bar rendered').toBeGreaterThan(0);
    for (const stage of await stages.all()) await expect(stage).toBeDisabled();
  });

  test('"Create Serial No" appears only once a product is set on a "Without Serial No" ticket', async ({ page }) => {
    const ticketPage = await newAssignedTicket(page);
    const createSerial = page.locator('button[name="action_create_repair_serial"]');
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyNoSerial);
    expect(await isVisibleWhenIdle(createSerial), 'hidden without a product').toBe(false);
    await ticketPage.product.setValue(FIX_REPAIR_TEST_CONFIG.productSearchTerm);
    expect(await isVisibleWhenIdle(createSerial), 'shown once the product is set').toBe(true);
  });

  test('"Return" stays hidden while required repair data is missing', async ({ page }) => {
    const ticketPage = await newAssignedTicket(page);
    const returnButton = page.locator('div.o_statusbar_buttons button:visible', { hasText: /^\s*Return\s*$/ });
    expect(await isVisibleWhenIdle(returnButton.first()), 'hidden on a bare ticket').toBe(false);
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyNoSerial);
    await ticketPage.customer.setValue(FIX_REPAIR_TEST_CONFIG.customerExample);
    expect(await isVisibleWhenIdle(returnButton.first()), 'still hidden without product / reason / serial').toBe(false);
  });

  test('a repair catalogue record needs a Name (Resolutions)', async ({ page }) => {
    await page.goto('/web#action=Fix-repair.action_resolutions');
    await page.locator('.o_list_button_add:visible').first().click();
    await page.locator('.o_field_widget[name="name"]').first().waitFor({ state: 'visible', timeout: 30_000 });
    await waitForOdooIdle(page);
    const message = await saveExpectingInvalid(page);
    // The Name field of this catalogue is labelled "Resolution".
    expect(message).toContain('Resolution');
    await expect(field(page, 'name')).toHaveClass(/o_field_invalid/);
  });
});
