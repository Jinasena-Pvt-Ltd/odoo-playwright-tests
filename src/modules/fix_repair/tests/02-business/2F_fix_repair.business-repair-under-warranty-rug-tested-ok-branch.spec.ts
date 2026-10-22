/**
 * Step 2 - Business Logic for the fix_repair module.
 *
 * Covers the "2F. Repair User Guide - Branch [ Under Warranty - RUG - Tested
 * Ok ]" Odoo Tour export. Branch variant (Job Location "Centre Repair", no
 * factory / sales-centre legs) of an Under Warranty - RUG repair identified by
 * an existing Serial Number (zero on-hand JMC6 lot) plus a Warranty Card
 * image. The item is received, a task is created, the technician presses
 * Tested OK and Mark as done, and the item is dispatched back to the customer.
 *
 * See notes/fix_repair.repair-under-warranty-rug-tested-ok-branch.guide.md
 * (and the matching 2F_Repair-...guide.html manual).
 *
 * Every guide screenshot is captured BEFORE the step's action, with the
 * element about to be used framed in red (see `shot` below).
 */
import * as path from 'path';
import { Page, Locator } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { FixRepairTicketPage } from '../../pages/FixRepairTicketPage';
import { FIX_REPAIR_TEST_CONFIG } from '../../data/fix_repair.master-data';

async function gotoRecord(page: Page, model: string, id: number) {
  const url = new URL(page.url());
  url.hash = `id=${id}&model=${model}&view_type=form`;
  await page.goto(url.toString());
}

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


test.describe('Fix Repair - Under Warranty - RUG - Tested Ok - Branch @module:fix_repair @step:business', () => {

  test('RUG branch repair is tested ok, completed and dispatched @smoke @e2e', async ({ page }, testInfo) => {
    test.setTimeout(600_000);

    const note = (description: string) => test.info().annotations.push({ type: 'note', description });

    // Screenshot of the state BEFORE the step's action, with the element
    // about to be used framed in red (outline applied for the instant of the
    // capture, then removed).
    const shot = async (name: string, target?: Locator, targetPage: Page = page) => {
      await targetPage.waitForTimeout(1_000);
      let boxed: Locator | undefined;
      if (target) {
        const el = target.first();
        if (await appears(el, 3_000)) {
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
    // isVisible() does not wait; this does.
    const appears = (loc: Locator, ms: number) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);
    const statusBtn = (label: string) => page.locator('div.o_statusbar_buttons button:visible', { hasText: label }).first();
    const anyBtn = (label: string | RegExp) => page.locator('button:visible', { hasText: label }).first();
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
      // Results load asynchronously; wait for the wanted option before falling back.
      await matching.first().waitFor({ state: 'visible', timeout: 6_000 }).catch(() => undefined);
      const target = (await matching.count()) > 0 ? matching.first() : options.first();
      await target.click();
      await page.waitForTimeout(400);
    };

    // Ticket -> Tasks stat button (task opens as a dialog on the ticket).
    const ticketToTask = async (n: string) => {
      await closeStrayDialogs(page);
      await gotoRecord(page, 'helpdesk.ticket', ticketId);
      await expect(statBtn('Tasks')).toBeVisible({ timeout: 15_000 });
      await shot(n, statBtn('Tasks'));
      await statBtn('Tasks').click();
      await page.waitForTimeout(1_500);
    };

    const ticketPage = new FixRepairTicketPage(page);

    // ---------- Section A - Create the ticket ----------
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

    // 5. Type = Repair - Under Warranty - RUG
    if (!(await field('ticket_type_id').isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'Fix Repair Studio customization not installed on this instance');
      return;
    }
    await shot('05-repair-type.png', field('ticket_type_id'));
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeUnderWarrantyRug);
    await page.waitForTimeout(1_000);

    // 6. Return Receipt Location
    await shot('06-return-receipt.png', field('x_studio_return_receipt_location'));
    await ticketPage.returnReceiptLocation.setValue(FIX_REPAIR_TEST_CONFIG.returnReceiptLocationExample);

    // 7. Repair Reason
    await shot('07-repair-reason.png', field('x_studio_repair_reason'));
    await ticketPage.repairReason.addItem(FIX_REPAIR_TEST_CONFIG.repairReasonExample);
    await page.waitForTimeout(1_000);

    // 8. Job Location = Centre Repair
    await shot('08-job-location.png', field('x_studio_job_location'));
    await ticketPage.jobLocation.selectByLabel(FIX_REPAIR_TEST_CONFIG.jobLocationCentre);

    // 9. Customer
    await shot('09-customer.png', field('partner_id'));
    await ticketPage.customer.setValue(FIX_REPAIR_TEST_CONFIG.customerExample);
    await page.waitForTimeout(1_000);

    // 10. Serial Number (an existing serial sold via a sales order; fills in the product)
    // Data rule (Data.txt): for the Serial Number field always pick a serial
    // of the product (JMC6) whose on-hand quantity is zero. The field also
    // only offers serials already sold to a customer (is_issued), and a serial
    // with stock piled up in a repair location by an earlier unfinished run
    // makes receipt/dispatch fail, so those are skipped too.
    const lotDomain = [['product_id.default_code', '=', FIX_REPAIR_TEST_CONFIG.productSearchTerm], ['product_qty', '=', 0]];
    let zeroLots: { id: number; name: string }[] = await callKw(page, 'stock.lot', 'search_read', [[...lotDomain, ['is_issued', '=', true]], ['name']]).catch(() => []);
    if (!zeroLots.length) zeroLots = await callKw(page, 'stock.lot', 'search_read', [lotDomain, ['name']]);
    const candidateIds = zeroLots.map((l) => l.id);
    const dirty: { lot_id: [number, string] }[] = candidateIds.length
      ? await callKw(page, 'stock.quant', 'search_read', [
          [['lot_id', 'in', candidateIds], ['location_id.complete_name', 'ilike', 'Repair'], ['quantity', '!=', 0]],
          ['lot_id'],
        ])
      : [];
    const dirtyIds = new Set(dirty.map((q) => q.lot_id[0]));
    const serialNo = zeroLots
      .filter((l) => !dirtyIds.has(l.id))
      .map((l) => l.name)
      .sort()[0] ?? FIX_REPAIR_TEST_CONFIG.serialNumberExample;
    note(`serial number used: ${serialNo}`);
    const serialField = field('x_studio_serial_no');
    await expect(serialField).toBeVisible({ timeout: 8_000 });
    await shot('10-serial-no.png', serialField);
    // The autocomplete occasionally re-renders under the click and leaves the
    // field empty; retry the selection until the value sticks.
    for (let attempt = 0; attempt < 4; attempt++) {
      const serialInput = serialField.locator('input').first();
      await serialInput.fill('');
      await serialInput.fill(serialNo);
      await page.waitForTimeout(1_200);
      await pickOption(serialNo);
      await page.waitForTimeout(1_500);
      if ((await serialInput.inputValue().catch(() => '')) === serialNo) break;
      note(`serial selection attempt ${attempt + 1} did not stick; retrying`);
    }
    await expect(serialField.locator('input').first()).toHaveValue(serialNo, { timeout: 8_000 });
    note(`product after serial: ${await field('product_id').innerText().catch(() => '?')}`);
    // Result shot: serial number entered and the Product filled in from it.
    await page.waitForTimeout(1_000);
    await shot('10b-serial-entered.png');

    // 11. Warranty Card tab
    const warrantyTab = page.locator('a[name="studio_page_2rr_1igln0ot0"]');
    await expect(warrantyTab).toBeVisible({ timeout: 8_000 });
    await shot('11-warranty-card-tab.png', warrantyTab);
    await warrantyTab.click();
    await page.waitForTimeout(800);

    // 12. Attach the warranty card image
    const warrantyField = field('x_studio_warranty_card');
    await expect(warrantyField).toBeVisible({ timeout: 8_000 });
    await shot('12-warranty-card-image.png', warrantyField);
    await warrantyField.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), FIX_REPAIR_TEST_CONFIG.warrantyCardImagePath));
    await page.waitForTimeout(1_500);
    // Result shot: the attached warranty card showing on the form.
    await warrantyField.locator('img').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => note('warranty card preview not visible'));
    await page.waitForTimeout(500);
    await shot('12b-warranty-card-attached.png');

    // ---------- Section B - Receive the item ----------
    // 13. Return (the UI button's server method always raises "You may only
    // return Done pickings" but still creates the return picking first).
    // Let the image upload finish and the form autosave before the Return click.
    await page.waitForTimeout(2_000);
    const invalidFields = await page.locator('.o_field_invalid').evaluateAll((els) => els.map((e) => e.getAttribute('name')));
    if (invalidFields.length) note(`invalid fields before Return: ${invalidFields.join(', ')}`);
    const ticketName = (await page.locator('h1').first().innerText().catch(() => ''))?.trim();
    const lookup = await callKw(page, 'helpdesk.ticket', 'search_read', [[['name', '=', ticketName]], ['id']]);
    ticketId = lookup?.[0]?.id;
    expect(ticketId, 'ticket id resolved from its name').toBeTruthy();
    await page.evaluate(() => document.querySelectorAll('.o_content, .o_action_manager, .o_form_sheet_bg').forEach((e) => { (e as HTMLElement).scrollTop = 0; }));
    await shot('13-return.png', statusBtn('Return'));
    // The real button saves the form and then runs the server method, which
    // raises "You may only return Done pickings" after creating the picking.
    await statusBtn('Return').click({ timeout: 15_000 }).catch(() => note('Return button not clickable'));
    await page.waitForTimeout(3_000);
    await dismissNotifications(page);
    await closeStrayDialogs(page);
    let returnPickingIds: number[] =
      (await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]))?.[0]?.repair_picking_ids ?? [];
    if (!returnPickingIds.length) {
      note('Return click did not create the picking; calling fix_repair_action_direct_return through RPC.');
      try {
        await callKw(page, 'helpdesk.ticket', 'fix_repair_action_direct_return', [[ticketId]]);
      } catch (err) {
        note(`fix_repair_action_direct_return raised (expected): ${(err as Error).message}`);
      }
      returnPickingIds =
        (await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]))?.[0]?.repair_picking_ids ?? [];
    }
    expect(returnPickingIds.length, 'return picking created').toBeGreaterThan(0);

    // 14. Validate the return picking (hidden by Studio views -> RPC).
    await gotoRecord(page, 'stock.picking', returnPickingIds[0]);
    await page.waitForTimeout(1_500);
    await shot('14-validate-return.png', page.locator('button[data-hotkey="v"]:visible, button[name="button_validate"]:visible'));
    for (const id of returnPickingIds) {
      const [p] = await callKw(page, 'stock.picking', 'read', [[id], ['state']]);
      if (p.state !== 'done') await callKw(page, 'stock.picking', 'button_validate', [[id]]).catch((err) => note(`validate ${id}: ${(err as Error).message}`));
    }
    await page.reload();
    await page.waitForTimeout(1_500);

    // 15. Back to the ticket
    await shot('15-back.png', page.locator('button[name="action_wizard_back"]:visible, .modal:visible button.btn-close').first());
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);

    // ---------- Section C - Plan the task (Centre Repair: no factory leg) ----------
    // 16. Plan Intervention
    await expect(statusBtn('Plan Intervention')).toBeVisible({ timeout: 10_000 });
    await shot('16-plan-intervention.png', statusBtn('Plan Intervention'));
    await statusBtn('Plan Intervention').click();

    // 17. Create & View Task
    const createTask = page.getByRole('button', { name: 'Create & View Task' });
    await createTask.waitFor({ state: 'visible', timeout: 10_000 });
    await shot('17-create-view-task.png', createTask);
    await createTask.click();
    await page.getByText('Create a Field Service task').waitFor({ state: 'hidden', timeout: 15_000 });
    await page.getByRole('tab', { name: 'Repair Diagnosis' }).waitFor({ state: 'visible', timeout: 15_000 });

    // ---------- Section D - Tested OK and completion of the task ----------
    // 18. Tested OK (the task dialog stays open after Create & View Task)
    await page.waitForTimeout(1_500);
    await dismissNotifications(page);
    const testedOk = page.locator('button:visible', { hasText: 'Tested OK' }).first();
    await expect(testedOk).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2_500);
    await shot('18-tested-ok.png', testedOk);
    await testedOk.click();
    await page.waitForTimeout(1_500);

    // 19. Mark as done
    const markDone = page.locator('button:visible', { hasText: 'Mark as done' }).first();
    await expect(markDone).toBeVisible({ timeout: 10_000 });
    await shot('19-mark-as-done.png', markDone);
    await markDone.click();
    await page.waitForTimeout(1_500);

    // 20. Close the task
    await dismissNotifications(page);
    await shot('20-close-task.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // ---------- Section E - Dispatch back to the customer ----------
    // 21. Dispatch (visibility lags the task completion - poll with reload)
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await waitForStatusBtn('Dispatch');
    await shot('21-dispatch.png', statusBtn('Dispatch'));
    await statusBtn('Dispatch').click();
    await page.waitForTimeout(1_500);

    // 22. Validate the dispatch picking
    const validate = page.locator('.modal:visible button, button:visible', { hasText: 'Validate' }).first();
    await expect(validate).toBeVisible({ timeout: 10_000 });
    await shot('22-validate-dispatch.png', validate);
    await validate.click();
    await page.waitForTimeout(2_000);

    // 23. Close - back to the ticket view
    const closeX = page.locator('.modal:visible button.btn-close').first();
    const back = page.locator('button[name="action_wizard_back"]:visible').first();
    const leaveBtn = (await appears(closeX, 4_000)) ? closeX : back;
    await shot('23-close.png', leaveBtn);
    if (await appears(leaveBtn, 3_000)) await leaveBtn.click();
    await page.waitForTimeout(1_000);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);
    await page.reload();
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: testInfo.outputPath('24-final-ticket.png'), fullPage: true });

    // The item has been dispatched: receipt and dispatch pickings are done.
    const [tkRead] = await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]);
    const states = await callKw(page, 'stock.picking', 'read', [tkRead.repair_picking_ids, ['name', 'state']]);
    note(`repair pickings: ${JSON.stringify(states)}`);
    expect(states.filter((p: { state: string }) => p.state === 'done').length, 'receipt and dispatch pickings done').toBeGreaterThanOrEqual(2);
  });
});
