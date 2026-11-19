/**
 * Step 2 — Business Logic for the fix_repair module.
 *
 * Covers the "1C. Repair User Guide - Branch [ Not Under Warranty (Without
 * Serial No) - Full Flow ]" Odoo Tour export: the BRANCH variant of the 1A
 * flow. Differences from 1A (Factory): Repair Reason "Low Pressue", Job
 * Location "Centre Repair" (the repair is done at the branch's service centre,
 * so there is no Send to / Received at Factory and no Send to / Received at
 * Sales Centre leg), a single delivery picking, and the balance is collected
 * on the invoice before the final Dispatch.
 *
 * See notes/fix_repair.repair-not-under-warranty-without-serial-branch-full-flow.guide.md
 * (and the matching .html manual).
 *
 * Every guide screenshot is captured BEFORE the step's action, with the
 * element about to be used framed in red (see `shot` below).
 */
import path from 'path';
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

test.describe('Fix Repair — Not Under Warranty (Without Serial No.) — Branch Full Flow @module:fix_repair @step:business', () => {

  test('branch ticket is repaired at the centre, quoted, paid and dispatched @smoke @e2e', async ({ page }, testInfo) => {
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

    // ───────────── Section D — Diagnosis, image and parts ─────────────
    // 17. Repair Diagnosis tab
    const diagnosisTab = page.getByRole('tab', { name: 'Repair Diagnosis' });
    await shot('17-diagnosis-tab.png', diagnosisTab);
    await diagnosisTab.click();

    // 18. Add a line
    const addLine = page.getByText('Add a line').first();
    await expect(addLine).toBeVisible({ timeout: 5_000 });
    await shot('18-add-line.png', addLine);
    await addLine.click();
    await page.waitForTimeout(500);
    const diagnosisTable = page.locator('[name="x_studio_diagnosis_ids"]');
    await diagnosisTable.locator('[name="x_studio_description"] input, [name="x_studio_description"] textarea').first().fill('Low pressure diagnosis');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    const pickInCell = async (n: string, fieldName: string, searchText: string) => {
      const cell = diagnosisTable.locator(`[name="${fieldName}"]`).first();
      await shot(n, cell);
      await cell.click();
      const input = cell.locator('input').first();
      if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) await input.fill(searchText);
      await pickOption(searchText);
    };
    await pickInCell('19-diagnosis-area.png', 'x_studio_diagnosis_area', FIX_REPAIR_TEST_CONFIG.diagnosisArea);
    await pickInCell('20-diagnosis-code.png', 'x_studio_diagnosis_code', FIX_REPAIR_TEST_CONFIG.diagnosisCode);
    await pickInCell('21-diagnosis-reason.png', 'x_studio_reason', FIX_REPAIR_TEST_CONFIG.diagnosisReason);
    await pickInCell('22-diagnosis-sub-reason.png', 'x_studio_sub_reason', FIX_REPAIR_TEST_CONFIG.diagnosisSubReason);
    await pickInCell('23-diagnosis-resolution.png', 'x_studio_resolution', FIX_REPAIR_TEST_CONFIG.diagnosisResolution);
    await pickInCell('24-diagnosis-repair-stage.png', 'x_studio_repair_stage', FIX_REPAIR_TEST_CONFIG.diagnosisRepairStage);
    await page.waitForTimeout(500);

    // 25. Repair Image tab
    const imageTab = page.getByRole('tab', { name: 'Repair Image' });
    await shot('25-repair-image-tab.png', imageTab);
    await imageTab.click();
    await page.waitForTimeout(500);

    // 26. Take a Picture (upload)
    const imageField = field('x_studio_repair_image_01');
    await shot('26-take-picture.png', imageField);
    await imageField.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), FIX_REPAIR_TEST_CONFIG.repairImagePath));
    await page.waitForTimeout(1_500);

    // 27. Products (renders only once diagnosis + image are set)
    const productsButton = page
      .locator('button[name="action_fsm_view_material"]:visible')
      .or(page.locator('.o_button_box button:visible', { hasText: 'Products' }))
      .first();
    await expect(productsButton).toBeVisible({ timeout: 10_000 });
    await shot('27-products.png', productsButton);
    await productsButton.click();
    await page.waitForTimeout(1_500);

    // 28. Add the spare part
    const catalogSearch = page.locator('.o_kanban_renderer input.o_searchview_input, .modal .o_searchview_input').first();
    if (await catalogSearch.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await catalogSearch.fill(FIX_REPAIR_TEST_CONFIG.quotationProductSearchTerm);
      await catalogSearch.press('Enter');
      await page.waitForTimeout(1_000);
    }
    const partCard = page.locator('.o_kanban_record', { hasText: FIX_REPAIR_TEST_CONFIG.quotationProductSearchTerm }).first();
    const addBtn = partCard.getByRole('button', { name: 'Add' });
    // The catalog's kanban can be slow to re-render after the search (observed once as a flake).
    await page.locator('.o_kanban_record').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await shot('28-add-part.png', addBtn);
    await addBtn.click();
    await page.waitForTimeout(1_000);

    // 29. Close the catalog
    const closeCatalog = page.locator('button.btn-close, .modal button[aria-label="Close"]').first();
    await shot('29-close-catalog.png', closeCatalog);
    if (await closeCatalog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeCatalog.click();
      await page.waitForTimeout(1_000);
    }

    // ───────────── Section E — Quotation and customer confirmation ─────────────
    // 30/31. ticket -> Tasks -> Sales Order
    await ticketToTask('30-tasks-quotation.png');
    await taskToSalesOrder('31-sales-order.png');

    await page.locator('.modal h1:visible').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    const soName = (await page.locator('.modal h1:visible').first().innerText().catch(() => ''))?.trim();
    const soRecords = soName ? await callKw(page, 'sale.order', 'search_read', [[['name', '=', soName]], ['id']]) : [];
    const soId: number = soRecords?.[0]?.id;
    expect(soId, `sales order id resolved from title "${soName}"`).toBeTruthy();

    // 32. Send by Email
    const sendByEmail = page.locator('button:visible', { hasText: 'Send by Email' }).first();
    await expect(sendByEmail).toBeVisible({ timeout: 10_000 });
    await shot('32-send-by-email.png', sendByEmail);
    await sendByEmail.click();
    await page.waitForTimeout(1_500);

    // 33. Send
    const sendButton = page.locator('.modal:visible button', { hasText: /^Send$/ }).first();
    await expect(sendButton).toBeVisible({ timeout: 8_000 });
    await shot('33-send.png', sendButton);
    await sendButton.click();
    await page.waitForTimeout(2_000);

    // 34. Close the quotation
    await shot('34-close-quotation.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // 35/36. back to the task / Sales Order
    await ticketToTask('35-tasks-confirmation.png');
    await taskToSalesOrder('36-sales-order-confirmation.png');

    // 37. Confirm — the customer accepts the quotation through the real
    // online portal (View Quotation -> Accept & Sign -> Accept & Sign).
    const portalUrlRaw = await callKw(page, 'sale.order', 'get_portal_url', [[soId]]);
    expect(typeof portalUrlRaw).toBe('string');
    const absoluteUrl = String(portalUrlRaw).startsWith('http') ? portalUrlRaw : `${new URL(page.url()).origin}${portalUrlRaw}`;
    await shot('37-confirm.png', page.locator('.modal:visible .o_statusbar_status').first());
    const portalPage = await page.context().newPage();
    await portalPage.goto(absoluteUrl);
    await portalPage.waitForTimeout(2_000);
    const acceptSign = portalPage.locator('button:visible, a:visible', { hasText: 'Accept & Sign' }).first();
    if (await acceptSign.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await shot('37b-portal-quotation.png', acceptSign, portalPage);
      await acceptSign.click();
      await portalPage.waitForTimeout(1_500);
      const signatureModal = portalPage.locator('.modal:visible, .o_portal_sign_modal:visible').first();
      const finalAccept = signatureModal.locator('button:visible', { hasText: 'Accept & Sign' }).first();
      if (await finalAccept.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await shot('37c-portal-signature.png', finalAccept, portalPage);
        await finalAccept.click();
        await signatureModal.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
        await portalPage.waitForTimeout(2_000);
      }
      await shot('37d-portal-confirmed.png', undefined, portalPage);
    } else {
      note('Portal Accept & Sign not available; falling back to action_confirm.');
    }
    await portalPage.close();
    const [soRec] = await callKw(page, 'sale.order', 'read', [[soId], ['state']]);
    if (soRec.state !== 'sale') {
      note(`SO state after portal flow was "${soRec.state}"; confirming via action_confirm.`);
      await closeStrayDialogs(page);
      await callKwWithRetry(page, 'sale.order', 'action_confirm', [[soId]]);
    }
    expect((await callKw(page, 'sale.order', 'read', [[soId], ['state']]))[0].state).toBe('sale');
    await closeStrayDialogs(page);
    await gotoRecord(page, 'sale.order', soId);
    await page.waitForTimeout(2_000);
    await page.locator('.o_form_status_indicator .fa-spin, .o_form_status_indicator .o_unsaved_dot').first()
      .waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);

    // ───────────── Section F — 50% deposit ─────────────
    // 38. Create Invoice
    const createInvoice = page.locator('button:visible', { hasText: 'Create Invoice' }).first();
    await expect(createInvoice).toBeVisible({ timeout: 10_000 });
    await shot('38-create-invoice.png', createInvoice);
    await createInvoice.click({ force: true, timeout: 10_000 });
    await page.waitForTimeout(1_500);
    const wizardConfirm = page.locator('.modal:visible button', { hasText: 'Create Draft Invoice' })
      .or(page.locator('.modal:visible button', { hasText: /^Create$/ })).first();
    if (await wizardConfirm.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await wizardConfirm.click();
      await page.waitForTimeout(1_500);
    }
    await page.waitForFunction(
      () => /model=account\.move/.test(location.hash) && /[?#&]id=\d+/.test(location.hash),
      undefined,
      { timeout: 10_000 },
    ).catch(() => undefined);
    let invoiceId: number | undefined = Number(page.url().match(/[?#&]id=(\d+)/)?.[1]) || undefined;
    if (invoiceId && !(await callKw(page, 'account.move', 'search_read', [[['id', '=', invoiceId]], ['id']]).catch(() => []))?.length) invoiceId = undefined;
    if (!invoiceId) invoiceId = (await callKw(page, 'sale.order', 'read', [[soId], ['invoice_ids']]))?.[0]?.invoice_ids?.[0];
    expect(invoiceId, 'deposit invoice created').toBeTruthy();

    // 39. Confirm (post) the invoice — hidden by Studio views, so RPC; the
    // screenshot shows the draft invoice before posting.
    await shot('39-confirm-invoice.png', page.locator('button:visible', { hasText: 'Confirm' }).first());
    await callKw(page, 'account.move', 'action_post', [[invoiceId]]);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'account.move', invoiceId!);
    await page.waitForTimeout(1_500);

    // 40-43. Register the 50% deposit. UI wizard when the button is exposed,
    // otherwise the same wizard model through RPC.
    const invoiceTotal: number = (await callKw(page, 'account.move', 'read', [[invoiceId], ['amount_total']]))[0].amount_total;
    const depositViaUi = await registerPaymentUI(
      { btn: '40-register-payment.png', journal: '41-journal.png', bank: '42-bank-amount.png', create: '43-create-payment.png' },
      invoiceTotal / 2,
    );
    if (!depositViaUi) {
      note('Register Payment hidden on the invoice; deposit created via account.payment.register RPC.');
      await shot('40-register-payment.png', page.locator('.o_form_view:visible').first());
      const journals = await callKw(page, 'account.journal', 'search_read', [[['name', 'ilike', 'Commercial Bank']], ['id']]);
      expect(journals?.[0]?.id, 'Commercial Bank journal').toBeTruthy();
      const ctx = { active_model: 'account.move', active_ids: [invoiceId] };
      const wizardId = await callKw(page, 'account.payment.register', 'create',
        [{ journal_id: journals[0].id, amount: invoiceTotal / 2, payment_date: new Date().toISOString().slice(0, 10) }], ctx);
      const action = await callKw(page, 'account.payment.register', 'action_create_payments', [[wizardId]], ctx);
      expect(action?.res_id, 'deposit payment created').toBeTruthy();
      await gotoRecord(page, 'account.payment', action.res_id);
      await page.waitForTimeout(1_500);
      await shot('41-journal.png', field('journal_id'));
      await shot('42-bank-amount.png', field('amount'));
      await shot('43-create-payment.png', undefined);
    }

    // 44. Close the invoice
    await shot('44-close-invoice.png', page.locator('.modal:visible button.btn-close').or(page.locator('.o_form_view .ribbon:visible')).first());
    await closeStrayDialogs(page);

    // ───────────── Section G — Delivery and task completion ─────────────
    // 45/46. ticket -> Tasks -> Sales Order
    await ticketToTask('45-tasks-delivery.png');
    await taskToSalesOrder('46-sales-order-delivery.png');
    const soState = (await callKw(page, 'sale.order', 'read', [[soId], ['picking_ids']]))[0];
    const pickingIds: number[] = (soState.picking_ids ?? []).slice().sort((a: number, b: number) => a - b);
    expect(pickingIds.length, 'delivery picking(s) created by the order').toBeGreaterThan(0);

    // 47. open the delivery
    await closeStrayDialogs(page);
    await gotoRecord(page, 'sale.order', soId);
    await page.waitForTimeout(1_500);
    const deliveryBtn = page.locator('button[name="action_view_delivery"]:visible, button.oe_stat_button:visible:has-text("Delivery")').first();
    await shot('47-delivery.png', deliveryBtn);
    await deliveryBtn.click().catch(() => note('Delivery stat button not clickable; opening picking directly.'));
    await page.waitForTimeout(1_500);

    // 48. Validate (hidden by Studio views -> RPC)
    // The Delivery button lists the order's transfers (a chain of three on this route); open the first.
    await gotoRecord(page, 'stock.picking', pickingIds[0]);
    await page.waitForTimeout(1_500);
    await shot('48-validate-delivery.png', page.locator('button[data-hotkey="v"]:visible, button[name="button_validate"]:visible').or(page.locator('.o_statusbar_status:visible')));
    for (const id of pickingIds) {
      await callKw(page, 'stock.picking', 'button_validate', [[id]]).catch((err) => note(`validate picking ${id}: ${(err as Error).message}`));
    }
    const doneStates = await callKw(page, 'stock.picking', 'read', [pickingIds, ['name', 'state']]);
    note(`delivery pickings: ${JSON.stringify(doneStates)}`);
    expect(doneStates.some((p: { state: string }) => p.state === 'done'), 'a delivery picking is done').toBeTruthy();
    await page.reload();
    await page.waitForTimeout(1_500);

    // 49. Close
    await shot('49-close-delivery.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // 50. open the repair task
    await ticketToTask('50-task.png');

    // 51. Mark as done
    const markDone = page.locator('button:visible', { hasText: 'Mark as done' }).first();
    await expect(markDone).toBeVisible({ timeout: 10_000 });
    await shot('51-mark-as-done.png', markDone);
    await markDone.click();
    await page.waitForTimeout(1_500);

    // 52. Close
    await shot('52-close-task.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // ───────────── Section H — Balance payment and dispatch ─────────────
    // 53/54. ticket -> Tasks -> Invoices
    await ticketToTask('53-tasks-balance.png');
    const invoicesBtn = statBtn('Invoices');
    await expect(invoicesBtn).toBeVisible({ timeout: 10_000 });
    await shot('54-invoices.png', invoicesBtn);
    await invoicesBtn.click();
    await page.waitForTimeout(1_500);

    // 55-58. Register the balance (remaining amount is pre-filled).
    const balanceViaUi = await registerPaymentUI({ btn: '55-register-balance.png', journal: '56-journal-balance.png', bank: '57-bank-balance.png', create: '58-create-balance.png' });
    expect(balanceViaUi, 'balance Register Payment button available').toBeTruthy();

    // 59. Close
    await shot('59-close-balance.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // 60. Dispatch (visibility lags the payment — poll with reload)
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await waitForStatusBtn('Dispatch');
    await shot('60-dispatch.png', statusBtn('Dispatch'));
    await statusBtn('Dispatch').click();
    await page.waitForTimeout(1_500);

    // 61. Validate the dispatch picking
    const validate = page.locator('.modal:visible button, button:visible', { hasText: 'Validate' }).first();
    await expect(validate).toBeVisible({ timeout: 10_000 });
    await shot('61-validate-dispatch.png', validate);
    await validate.click();
    await page.waitForTimeout(2_000);

    // 62. Close — back to the ticket view
    const closeX = page.locator('.modal:visible button.btn-close').first();
    const close = (await closeX.isVisible({ timeout: 3_000 }).catch(() => false)) ? closeX : page.locator('button[name="action_wizard_back"]:visible').first();
    await shot('62-close.png', close);
    if (await close.isVisible({ timeout: 3_000 }).catch(() => false)) await close.click();
    await page.waitForTimeout(1_000);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: testInfo.outputPath('63-final-ticket.png'), fullPage: true });

    // The returned item must have been dispatched: more than just the receipt is done.
    const repairPickings = (await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]))[0].repair_picking_ids;
    const states = await callKw(page, 'stock.picking', 'read', [repairPickings, ['name', 'state']]);
    note(`repair pickings: ${JSON.stringify(states)}`);
    expect(states.filter((p: { state: string }) => p.state === 'done').length, 'receipt and dispatch pickings done').toBeGreaterThanOrEqual(2);
  });
});
