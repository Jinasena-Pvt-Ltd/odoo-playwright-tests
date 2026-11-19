/**
 * Step 2 — Business Logic for the fix_repair module.
 *
 * Covers the "1D. Repair User Guide - Branch [ Not Under Warranty (Without
 * Serial No) - Tested Ok ]" Odoo Tour export: the BRANCH variant combined with
 * the "Tested OK" ending. Front half as 1C (Centre Repair at the branch, no
 * factory leg); then the task is closed, reopened from the ticket, marked
 * Tested OK and done, the item is dispatched back, and a Vendor Group is set.
 * There is no quotation, payment or delivery chain in this flow.
 *
 * See notes/fix_repair.repair-not-under-warranty-without-serial-branch-tested-ok.guide.md
 * (and the matching .html manual).
 *
 * Every guide screenshot is captured BEFORE the step's action, with the
 * element about to be used framed in red (see `shot` below).
 */
import { Page, Locator } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { FixRepairTicketPage } from '../../pages/FixRepairTicketPage';
import { FIX_REPAIR_TEST_CONFIG } from '../../data/fix_repair.master-data';

async function gotoRecord(page: Page, model: string, id: number) {
  const url = new URL(page.url());
  url.hash = `id=${id}&model=${model}&view_type=form`;
  await page.goto(url.toString());
}

// Records opened via stat buttons can render as a dialog that silently
// intercepts later clicks; dismiss through the dialog's own Close control.
async function dismissNotifications(page: Page) {
  // Toasts (e.g. "Add Data") can cover the dialog's Close button.
  const closers = page.locator('.o_notification_close');
  for (let i = 0; i < 6 && (await closers.count()) > 0; i++) {
    await closers.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

async function closeStrayDialogs(page: Page, attempts = 3) {
  await dismissNotifications(page);
  for (let i = 0; i < attempts; i++) {
    const dialog = page.locator('.modal.show, .o_technical_modal').first();
    if (!(await dialog.isVisible({ timeout: 1_000 }).catch(() => false))) return;
    const closeButton = dialog.locator('button[aria-label="Close"], .btn-close, button:has-text("Close")').first();
    if (await closeButton.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await closeButton.click({ force: true }).catch(() => undefined);
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(500);
  }
}

async function callKw(page: Page, model: string, method: string, args: unknown[], context: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ model, method, args, context }) => {
      const res = await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs: { context } } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.data?.message ?? data.error.message ?? 'RPC error');
      return data.result;
    },
    { model, method, args, context },
  );
}

// sale.order.action_confirm's procurement/routing lookup fails transiently
// under load and succeeds on retry.
async function callKwWithRetry(page: Page, model: string, method: string, args: unknown[], context: Record<string, unknown> = {}, attempts = 3) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await callKw(page, model, method, args, context);
    } catch (err) {
      lastErr = err;
      await page.waitForTimeout(2_000);
    }
  }
  throw lastErr;
}

test.describe('Fix Repair — Not Under Warranty (Without Serial No.) — Branch Tested OK @module:fix_repair @step:business', () => {

  test('branch ticket is tested OK at the centre and dispatched @smoke @e2e', async ({ page }, testInfo) => {
    test.setTimeout(300_000);

    const note = (description: string) => test.info().annotations.push({ type: 'note', description });

    // Screenshot of the state BEFORE the step's action, with the element
    // about to be used framed in red (outline applied for the instant of the
    // capture, then removed).
    const shot = async (name: string, target?: Locator, targetPage: Page = page) => {
      await targetPage.waitForTimeout(1_000);
      let boxed: Locator | undefined;
      if (target) {
        const el = target.first();
        if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await el.scrollIntoViewIfNeeded().catch(() => undefined);
          await el.evaluate((e) => {
            const h = e as HTMLElement;
            h.setAttribute('data-prev-outline', h.style.outline);
            h.style.outline = '3px solid #e11d48';
            h.style.outlineOffset = '2px';
          });
          boxed = el;
        } else {
          note(`${name}: target not visible, screenshot has no red box`);
        }
      }
      await targetPage.screenshot({ path: testInfo.outputPath(name), fullPage: true });
      if (boxed) {
        await boxed
          .evaluate((e) => {
            const h = e as HTMLElement;
            h.style.outline = h.getAttribute('data-prev-outline') ?? '';
            h.removeAttribute('data-prev-outline');
          })
          .catch(() => undefined);
      }
    };
    const statusBtn = (label: string) => page.locator('div.o_statusbar_buttons button:visible', { hasText: label }).first();
    const field = (name: string) => page.locator(`.o_field_widget[name="${name}"]`);
    const statBtn = (label: string) => page.locator('button.oe_stat_button:visible', { hasText: label }).first();
    let ticketId = 0;

    const waitForStatusBtn = async (label: string) => {
      let visible = await statusBtn(label).isVisible({ timeout: 5_000 }).catch(() => false);
      for (let i = 0; i < 6 && !visible; i++) {
        await page.waitForTimeout(3_000);
        await closeStrayDialogs(page);
        await gotoRecord(page, 'helpdesk.ticket', ticketId);
        await page.reload(); // hash-only change does not refresh the record
        await page.waitForTimeout(1_500);
        visible = await statusBtn(label).isVisible({ timeout: 5_000 }).catch(() => false);
      }
      expect(visible, `${label} button visible`).toBeTruthy();
    };

    const pickOption = async (text: string) => {
      const dropdown = page
        .locator('.o_field_many2one_dropdown, .o-dropdown--menu, .ui-autocomplete, .o-autocomplete--dropdown-menu')
        .first();
      await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
      const options = page.locator(
        '.o_field_many2one_dropdown .o_menu_item, .o-dropdown--menu .o_menu_item, ' +
        '.ui-autocomplete .ui-menu-item, .o-autocomplete--dropdown-item',
      );
      const matching = options.filter({ hasText: text });
      const target = (await matching.count()) > 0 ? matching.first() : options.first();
      await target.click();
      await page.waitForTimeout(400);
    };

    // Ticket -> Tasks stat button -> task page -> Sales Order stat button.
    const ticketToTask = async (n: string) => {
      await closeStrayDialogs(page);
      await gotoRecord(page, 'helpdesk.ticket', ticketId);
      await expect(statBtn('Tasks')).toBeVisible({ timeout: 15_000 });
      await shot(n, statBtn('Tasks'));
      await statBtn('Tasks').click();
      await page.waitForTimeout(1_500);
    };
    const taskToSalesOrder = async (n: string) => {
      await expect(statBtn('Sales Order')).toBeVisible({ timeout: 15_000 });
      await shot(n, statBtn('Sales Order'));
      await statBtn('Sales Order').click();
      await page.waitForTimeout(1_500);
    };

    // Register Payment wizard driven through the UI (journal + amount).
    // Returns false when the Register Payment button is not on screen.
    const registerPaymentUI = async (names: { btn: string; journal: string; bank: string; create: string }, amount?: number) => {
      const reg = page.locator('button:visible', { hasText: 'Register Payment' }).first();
      if (!(await reg.isVisible({ timeout: 5_000 }).catch(() => false))) return false;
      await shot(names.btn, reg);
      await reg.click({ force: true });
      await page.waitForTimeout(1_500);
      const modal = page.locator('.modal:visible').last();
      const journalInput = modal.locator('.o_field_widget[name="journal_id"] input').first();
      await journalInput.waitFor({ state: 'visible', timeout: 8_000 });
      await shot(names.journal, modal.locator('.o_field_widget[name="journal_id"]'));
      await journalInput.fill('Commercial Bank');
      await pickOption('Commercial Bank');
      await page.waitForTimeout(800);
      if (amount !== undefined) {
        const amountInput = modal.locator('.o_field_widget[name="amount"] input').first();
        await amountInput.fill(String(amount));
        await amountInput.press('Tab');
        await page.waitForTimeout(800);
      }
      await shot(names.bank, modal.locator('.o_field_widget[name="journal_id"]'));
      const create = modal.locator('button:visible', { hasText: 'Create Payment' }).first();
      await shot(names.create, create);
      await create.click();
      await modal.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000);
      const invalidOp = page.locator('.modal:visible', { hasText: 'Invalid Operation' }).first();
      expect(await invalidOp.isVisible({ timeout: 1_000 }).catch(() => false), 'payment accepted (no Invalid Operation)').toBeFalsy();
      return true;
    };

    const ticketPage = new FixRepairTicketPage(page);

    // ───────────── Section A — Create the ticket ─────────────
    // 1. Helpdesk app (icon scrolled into view on the Apps home screen)
    await ticketPage.navigateTo('/web');
    await page.locator('a.o_menu_toggle').click();
    const helpdeskIcon = page.locator('[data-menu-xmlid="helpdesk.menu_helpdesk_root"]');
    await helpdeskIcon.waitFor({ state: 'visible', timeout: 15_000 });
    await helpdeskIcon.scrollIntoViewIfNeeded();
    await shot('01-helpdesk-app.png', helpdeskIcon);
    await helpdeskIcon.click();
    await ticketPage.waitForOdooReady();

    // 2. Tickets
    await shot('02-tickets-button.png', page.locator('button[name="action_view_ticket"]'));
    await ticketPage.openTicketsList();

    // 3. New
    await shot('03-new-button.png', page.getByRole('button', { name: /^New$/ }));
    await ticketPage.clickNewTicket();

    // 4. Assign to Me
    if (!(await statusBtn('Assign to Me').isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Assign to Me not available on this instance');
      return;
    }
    await shot('04-assign-to-me.png', statusBtn('Assign to Me'));
    await ticketPage.assignToMe();
    await page.locator('div.o_statusbar_buttons button', { hasText: 'Assign to Me' }).waitFor({ state: 'hidden', timeout: 10_000 });

    // 5. Type
    if (!(await field('ticket_type_id').isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'Fix Repair Studio customization not installed on this instance');
      return;
    }
    await shot('05-repair-type.png', field('ticket_type_id'));
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyNoSerial);

    // 6. Return Receipt Location
    await shot('06-return-receipt.png', field('x_studio_return_receipt_location'));
    await ticketPage.returnReceiptLocation.setValue(FIX_REPAIR_TEST_CONFIG.returnReceiptLocationExample);

    // 7. Repair Reason
    await shot('07-repair-reason.png', field('x_studio_repair_reason'));
    await ticketPage.repairReason.addItem(FIX_REPAIR_TEST_CONFIG.repairReasonLowPressure);
    await page.waitForTimeout(1_000);

    // 8. Job Location = Centre Repair (branch variant)
    await shot('08-job-location.png', field('x_studio_job_location'));
    await ticketPage.jobLocation.selectByLabel(FIX_REPAIR_TEST_CONFIG.jobLocationCentre);

    // 9. Customer
    await shot('09-customer.png', field('partner_id'));
    await ticketPage.customer.setValue(FIX_REPAIR_TEST_CONFIG.customerExample);
    await page.waitForTimeout(1_000);

    // 10. Product
    await shot('10-product.png', field('product_id'));
    await ticketPage.product.setValue(FIX_REPAIR_TEST_CONFIG.productSearchTerm);
    await page.waitForTimeout(1_000);

    // 11. Create Serial No
    const createSerial = page.locator('button[name="action_create_repair_serial"]');
    await expect(createSerial).toBeVisible({ timeout: 8_000 });
    const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
    if (await saveBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) await ticketPage.save();
    await shot('11-create-serial.png', createSerial);
    await ticketPage.createRepairSerial();
    await page.waitForTimeout(1_500);

    // ───────────── Section B — Receive the item ─────────────
    // 12. Return (the UI button's server method always raises "You may only
    // return Done pickings" but still creates the return picking first).
    const ticketName = (await page.locator('h1').first().innerText().catch(() => ''))?.trim();
    const lookup = await callKw(page, 'helpdesk.ticket', 'search_read', [[['name', '=', ticketName]], ['id']]);
    ticketId = lookup?.[0]?.id;
    expect(ticketId, 'ticket id resolved from its name').toBeTruthy();
    await shot('12-return.png', statusBtn('Return'));
    try {
      await callKw(page, 'helpdesk.ticket', 'fix_repair_action_direct_return', [[ticketId]]);
    } catch (err) {
      note(`fix_repair_action_direct_return raised (expected): ${(err as Error).message}`);
    }
    const returnPickingIds: number[] =
      (await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]))?.[0]?.repair_picking_ids ?? [];
    expect(returnPickingIds.length, 'return picking created').toBeGreaterThan(0);

    // 13. Validate the return picking (hidden by Studio views -> RPC).
    await gotoRecord(page, 'stock.picking', returnPickingIds[0]);
    await page.waitForTimeout(1_500);
    await shot('13-validate-return.png', page.locator('button[data-hotkey="v"]:visible, button[name="button_validate"]:visible'));
    for (const id of returnPickingIds) {
      const [p] = await callKw(page, 'stock.picking', 'read', [[id], ['state']]);
      if (p.state !== 'done') await callKw(page, 'stock.picking', 'button_validate', [[id]]).catch((err) => note(`validate ${id}: ${(err as Error).message}`));
    }

    // 14. Close — the validated receipt, then back to the ticket.
    await page.reload();
    await page.waitForTimeout(1_500);
    const closeBtn14 = page.locator('.modal:visible button.btn-close').first();
    await shot('14-close.png', closeBtn14);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);

    // ───────────── Section C — Plan the intervention ─────────────
    // 15. Plan Intervention (Centre Repair: no Send to Factory leg)
    await expect(statusBtn('Plan Intervention')).toBeVisible({ timeout: 15_000 });
    await shot('15-plan-intervention.png', statusBtn('Plan Intervention'));
    await statusBtn('Plan Intervention').click();

    // 16. Create & View Task
    const createTask = page.getByRole('button', { name: 'Create & View Task' });
    await createTask.waitFor({ state: 'visible', timeout: 10_000 });
    await shot('16-create-view-task.png', createTask);
    await createTask.click();
    await page.getByText('Create a Field Service task').waitFor({ state: 'hidden', timeout: 15_000 });
    await page.getByRole('tab', { name: 'Repair Diagnosis' }).waitFor({ state: 'visible', timeout: 15_000 });

    // ───────────── Section D — Tested OK and completion of the task ─────────────
    // 17. Close the task dialog (the tour closes it, then reopens it from the ticket)
    await page.waitForTimeout(1_500);
    await dismissNotifications(page);
    await shot('17-close-task-dialog.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // 18. Open the task through the ticket's Tasks stat button
    await ticketToTask('18-tasks.png');

    // 19. Tested OK (the item needs no paid repair and is returned as is)
    const testedOk = page.locator('button:visible', { hasText: 'Tested OK' }).first();
    await expect(testedOk).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_500);
    await shot('19-tested-ok.png', testedOk);
    await testedOk.click();
    await page.waitForTimeout(1_500);

    // 20. Mark as done
    const markDone = page.locator('button:visible', { hasText: 'Mark as done' }).first();
    await expect(markDone).toBeVisible({ timeout: 10_000 });
    await shot('20-mark-as-done.png', markDone);
    await markDone.click();
    await page.waitForTimeout(1_500);

    // 21. Close the task
    await shot('21-close-task.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // ───────────── Section E — Dispatch back to the customer ─────────────
    // 22. Dispatch (visibility lags the task completion — poll with reload)
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await waitForStatusBtn('Dispatch');
    await shot('22-dispatch.png', statusBtn('Dispatch'));
    await statusBtn('Dispatch').click();
    await page.waitForTimeout(1_500);

    // 23. Validate the dispatch picking
    const validate = page.locator('.modal:visible button, button:visible', { hasText: 'Validate' }).first();
    await expect(validate).toBeVisible({ timeout: 10_000 });
    await shot('23-validate-dispatch.png', validate);
    await validate.click();
    await page.waitForTimeout(2_000);

    // 24. Close — back to the ticket view
    const closeX = page.locator('.modal:visible button.btn-close').first();
    const close = (await closeX.isVisible({ timeout: 3_000 }).catch(() => false)) ? closeX : page.locator('button[name="action_wizard_back"]:visible').first();
    await shot('24-close.png', close);
    if (await close.isVisible({ timeout: 3_000 }).catch(() => false)) await close.click();
    await page.waitForTimeout(1_000);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);

    // The tour's last two steps (#x_studio_vendor_group dropdown + pick) are not
    // reproducible on the ticket: the Vendor Group field does not exist on
    // helpdesk.ticket (only on res.partner / res.users, and it is not shown on
    // the customer's form), so they are treated as recorder artefacts.
    note('Tour steps 30-31 (Vendor Group) not applicable: field is not on the ticket form.');
    await page.reload();
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: testInfo.outputPath('25-final-ticket.png'), fullPage: true });

    // The item has been dispatched: receipt and dispatch pickings are done.
    const [tkRead] = await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]);
    const states = await callKw(page, 'stock.picking', 'read', [tkRead.repair_picking_ids, ['name', 'state']]);
    note(`repair pickings: ${JSON.stringify(states)}`);
    expect(states.filter((p: { state: string }) => p.state === 'done').length, 'receipt and dispatch pickings done').toBeGreaterThanOrEqual(2);
  });
});
