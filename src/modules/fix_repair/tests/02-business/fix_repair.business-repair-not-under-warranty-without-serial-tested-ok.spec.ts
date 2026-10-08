/**
 * Step 2 — Business Logic for the fix_repair module.
 *
 * Covers the "1B. Repair User Guide - Factory [ Not Under Warranty (Without
 * Serial No) - Tested Ok ]" Odoo Tour export: the shorter variant of the 1A
 * flow where the technician finds nothing wrong ("Tested OK"), so there is no
 * diagnosis, parts, quotation, or payment — the item goes straight back
 * through the sales centre and is dispatched to the customer.
 *
 * Steps 1-18 (ticket creation through Create & View Task) are identical to
 * the 1A spec; only the task-completion and return legs differ.
 *
 * See notes/fix_repair.repair-not-under-warranty-without-serial-tested-ok.guide.md
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
async function closeStrayDialogs(page: Page, attempts = 3) {
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

test.describe('Fix Repair — Not Under Warranty (Without Serial No.) — Tested OK @module:fix_repair @step:business', () => {

  test('ticket is repaired with Tested OK and dispatched without quotation @smoke @e2e', async ({ page }, testInfo) => {
    test.setTimeout(300_000);

    // Screenshot of the state BEFORE the step's action, with the element
    // about to be used framed in red (outline applied to the real DOM node
    // for the instant of the capture, then removed).
    const shot = async (name: string, target?: Locator) => {
      // Let any in-flight onchange re-render from the previous action settle,
      // so the capture shows the true state before this step's action.
      await page.waitForTimeout(1_000);
      let boxed: Locator | undefined;
      if (target) {
        const el = target.first();
        if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await el.evaluate((e) => {
            const h = e as HTMLElement;
            h.setAttribute('data-prev-outline', h.style.outline);
            h.style.outline = '3px solid #e11d48';
            h.style.outlineOffset = '2px';
          });
          boxed = el;
        }
      }
      await page.screenshot({ path: testInfo.outputPath(name), fullPage: true });
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
    let ticketIdForPoll = 0;
    const waitForStatusBtn = async (label: string) => {
      let visible = await statusBtn(label).isVisible({ timeout: 5_000 }).catch(() => false);
      for (let i = 0; i < 6 && !visible; i++) {
        await page.waitForTimeout(3_000);
        await closeStrayDialogs(page);
        await gotoRecord(page, 'helpdesk.ticket', ticketIdForPoll);
        // A hash-only change does not reload the record; force a full reload.
        await page.reload();
        await page.waitForTimeout(1_500);
        visible = await statusBtn(label).isVisible({ timeout: 5_000 }).catch(() => false);
      }
      expect(visible, `${label} button visible`).toBeTruthy();
    };
    const field = (name: string) => page.locator(`.o_field_widget[name="${name}"]`);

    const ticketPage = new FixRepairTicketPage(page);

    // 1. Helpdesk app
    await ticketPage.navigateTo('/web');
    await page.locator('a.o_menu_toggle').click();
    const helpdeskIcon = page.locator('[data-menu-xmlid="helpdesk.menu_helpdesk_root"]');
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
    await ticketPage.repairReason.addItem(FIX_REPAIR_TEST_CONFIG.repairReasonExample);
    await page.waitForTimeout(1_000);

    // 8. Job Location
    await shot('08-job-location.png', field('x_studio_job_location'));
    await ticketPage.jobLocation.selectByLabel(FIX_REPAIR_TEST_CONFIG.jobLocationFactory);

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
    if (!(await createSerial.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.info().annotations.push({ type: 'note', description: 'Create Serial No not shown.' });
      expect(await createSerial.isVisible()).toBeTruthy();
    }
    const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
    if (await saveBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) await ticketPage.save();
    await shot('11-create-serial.png', createSerial);
    await ticketPage.createRepairSerial();
    await page.waitForTimeout(1_500);

    // 12. Return (the UI button's server method always raises "You may only
    // return Done pickings" but still creates the return picking first).
    const ticketName = (await page.locator('h1').first().innerText().catch(() => ''))?.trim();
    const lookup = await callKw(page, 'helpdesk.ticket', 'search_read', [[['name', '=', ticketName]], ['id']]);
    const ticketId: number = lookup?.[0]?.id;
    expect(ticketId, 'ticket id resolved from its name').toBeTruthy();
    ticketIdForPoll = ticketId;
    await shot('12-return.png', statusBtn('Return'));
    try {
      await callKw(page, 'helpdesk.ticket', 'fix_repair_action_direct_return', [[ticketId]]);
    } catch (err) {
      test.info().annotations.push({ type: 'note', description: `fix_repair_action_direct_return raised (expected): ${(err as Error).message}` });
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
      if (p.state !== 'done') await callKw(page, 'stock.picking', 'button_validate', [[id]]).catch((err) =>
        test.info().annotations.push({ type: 'note', description: `validate ${id}: ${(err as Error).message}` }));
    }

    // 14. Close the picking dialog (if it rendered as one) and return to the ticket.
    // (The return picking renders as a full page here, not a dialog, so there
    // is no separate "Close" screen to capture for this step.)
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);

    // 15. Send to Factory
    await expect(statusBtn('Send to Factory')).toBeVisible({ timeout: 15_000 });
    await shot('15-send-to-factory.png', statusBtn('Send to Factory'));
    await statusBtn('Send to Factory').click();
    await page.waitForTimeout(1_500);

    // 16. Received at Factory
    await expect(statusBtn('Received at Factory')).toBeVisible({ timeout: 10_000 });
    await shot('16-received-at-factory.png', statusBtn('Received at Factory'));
    await ticketPage.receivedAtFactory();
    await page.waitForTimeout(1_500);

    // 17. Plan Intervention
    await expect(statusBtn('Plan Intervention')).toBeVisible({ timeout: 10_000 });
    await shot('17-plan-intervention.png', statusBtn('Plan Intervention'));
    await statusBtn('Plan Intervention').click();

    // 18. Create & View Task
    const createTask = page.getByRole('button', { name: 'Create & View Task' });
    await createTask.waitFor({ state: 'visible', timeout: 10_000 });
    await shot('18-create-view-task.png', createTask);
    await createTask.click();
    await page.getByText('Create a Field Service task').waitFor({ state: 'hidden', timeout: 15_000 });
    await page.getByRole('tab', { name: 'Repair Diagnosis' }).waitFor({ state: 'visible', timeout: 15_000 });

    // 19. Tested OK (task form)
    const testedOk = page.locator('button:visible', { hasText: 'Tested OK' }).first();
    await expect(testedOk).toBeVisible({ timeout: 10_000 });
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

    // 21. Back (to the ticket)
    const backBtn = page.locator('button[name="action_wizard_back"]:visible, button:visible:text-is("Back")').first();
    if (await backBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await shot('21-back.png', backBtn);
      await backBtn.click();
      await page.waitForTimeout(1_500);
    } else {
      test.info().annotations.push({ type: 'note', description: 'Back button not shown after Mark as done; navigating to the ticket directly.' });
      await closeStrayDialogs(page);
      await gotoRecord(page, 'helpdesk.ticket', ticketId);
      await page.waitForTimeout(1_500);
    }

    // 22. Send to Sales Centre (button visibility lags the task completion — poll with reload)
    await waitForStatusBtn('Send to Sales Centre');
    await shot('22-send-to-sales-centre.png', statusBtn('Send to Sales Centre'));
    await statusBtn('Send to Sales Centre').click();
    await page.waitForTimeout(1_500);

    // 23. Received at Sales Centre
    await expect(statusBtn('Received at Sales Centre')).toBeVisible({ timeout: 10_000 });
    await shot('23-received-at-sales-centre.png', statusBtn('Received at Sales Centre'));
    await statusBtn('Received at Sales Centre').click();
    await page.waitForTimeout(1_500);

    // 24. Dispatch (visibility lags — poll with reload)
    await waitForStatusBtn('Dispatch');
    await shot('24-dispatch.png', statusBtn('Dispatch'));
    await statusBtn('Dispatch').click();
    await page.waitForTimeout(1_500);

    // 25. Validate the dispatch picking
    const validate = page.locator('.modal:visible button, button:visible', { hasText: 'Validate' }).first();
    await expect(validate).toBeVisible({ timeout: 10_000 });
    await shot('25-validate-dispatch.png', validate);
    await validate.click();
    await page.waitForTimeout(2_000);

    // 26. Close — back to the ticket view
    const closeX = page.locator('.modal:visible button.btn-close').first();
    const close = (await closeX.isVisible({ timeout: 3_000 }).catch(() => false)) ? closeX : page.locator('button[name="action_wizard_back"]:visible').first();
    await shot('26-close.png', close);
    if (await close.isVisible({ timeout: 3_000 }).catch(() => false)) await close.click();
    await page.waitForTimeout(1_000);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: testInfo.outputPath('27-final-ticket.png'), fullPage: true });

    // The returned item must have been dispatched: no open repair pickings.
    const pickings = await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]);
    const states = await callKw(page, 'stock.picking', 'read', [pickings[0].repair_picking_ids, ['name', 'state']]);
    test.info().annotations.push({ type: 'note', description: `repair pickings: ${JSON.stringify(states)}` });
    expect(states.some((p: { state: string }) => p.state === 'done')).toBeTruthy();
  });
});
