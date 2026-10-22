/**
 * Step 2 - Business Logic for the fix_repair module.
 *
 * Covers the "2D. Repair User Guide - Branch [ Under Warranty - RUG
 * ( Approved ) - Full Flow ]" Odoo Tour export. It is the BRANCH variant of
 * 2A: Job Location is "Centre Repair", so there is no Send to Factory /
 * Received at Factory / Send to Sales Centre / Received at Sales Centre leg -
 * after the item is received the ticket goes straight to Plan Intervention.
 * As in 2A the item is identified by an existing Serial Number (zero
 * on-hand JMC6 lot) plus a Warranty Card image, the quotation goes through
 * Request RUG Approval -> Approve RUG -> Confirm, three transfers are
 * validated, the final invoice is switched to the RUG account before it is
 * confirmed, and the item is dispatched.
 *
 * See notes/fix_repair.repair-under-warranty-rug-approved-branch-full-flow.guide.md
 * (and the matching 2D_Repair-...guide.html manual).
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


test.describe('Fix Repair - Under Warranty - RUG (Approved) - Branch Full Flow @module:fix_repair @step:business', () => {

  test('RUG-approved branch repair is quoted, approved, delivered, invoiced to RUG and dispatched @smoke @e2e', async ({ page }, testInfo) => {
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

    // ---------- Section D - Diagnosis, image and parts ----------
    // 18. Repair Diagnosis tab
    const diagnosisTab = page.getByRole('tab', { name: 'Repair Diagnosis' });
    await shot('18-diagnosis-tab.png', diagnosisTab);
    await diagnosisTab.click();

    // 19. Add a line
    const addLine = page.getByText('Add a line').first();
    await expect(addLine).toBeVisible({ timeout: 5_000 });
    await shot('19-add-line.png', addLine);
    await addLine.click();
    await page.waitForTimeout(500);
    const diagnosisTable = page.locator('[name="x_studio_diagnosis_ids"]');
    await diagnosisTable.locator('[name="x_studio_description"] input, [name="x_studio_description"] textarea').first().fill('Engine diagnosis');
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
    await pickInCell('20-diagnosis-area.png', 'x_studio_diagnosis_area', FIX_REPAIR_TEST_CONFIG.diagnosisArea);
    await pickInCell('21-diagnosis-code.png', 'x_studio_diagnosis_code', FIX_REPAIR_TEST_CONFIG.diagnosisCode);
    await pickInCell('22-diagnosis-reason.png', 'x_studio_reason', FIX_REPAIR_TEST_CONFIG.diagnosisReason);
    await pickInCell('23-diagnosis-sub-reason.png', 'x_studio_sub_reason', FIX_REPAIR_TEST_CONFIG.diagnosisSubReason);
    await pickInCell('24-diagnosis-resolution.png', 'x_studio_resolution', FIX_REPAIR_TEST_CONFIG.diagnosisResolution);
    await pickInCell('25-diagnosis-repair-stage.png', 'x_studio_repair_stage', FIX_REPAIR_TEST_CONFIG.diagnosisRepairStage);
    await page.waitForTimeout(500);

    // 26. Repair Image tab
    const imageTab = page.getByRole('tab', { name: 'Repair Image' });
    await shot('26-repair-image-tab.png', imageTab);
    await imageTab.click();
    await page.waitForTimeout(500);

    // 27. Take a Picture (upload)
    const imageField = field('x_studio_repair_image_01');
    await shot('27-take-picture.png', imageField);
    await imageField.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), FIX_REPAIR_TEST_CONFIG.repairImagePath));
    await page.waitForTimeout(1_500);

    // 28. Products (renders only once diagnosis + image are set)
    const productsButton = page
      .locator('button[name="action_fsm_view_material"]:visible')
      .or(page.locator('.o_button_box button:visible', { hasText: 'Products' }))
      .first();
    await expect(productsButton).toBeVisible({ timeout: 10_000 });
    await shot('28-products.png', productsButton);
    await productsButton.click();
    await page.waitForTimeout(1_500);

    // 29. Add the spare part
    const catalogSearch = page.locator('.o_kanban_renderer input.o_searchview_input, .modal .o_searchview_input').first();
    if (await catalogSearch.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await catalogSearch.fill(FIX_REPAIR_TEST_CONFIG.quotationProductSearchTerm);
      await catalogSearch.press('Enter');
      await page.waitForTimeout(1_000);
    }
    const partCard = page.locator('.o_kanban_record', { hasText: FIX_REPAIR_TEST_CONFIG.quotationProductSearchTerm }).first();
    const addBtn = partCard.getByRole('button', { name: 'Add' });
    await page.locator('.o_kanban_record').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await shot('29-add-part.png', addBtn);
    await addBtn.click();
    await page.waitForTimeout(1_000);

    // 30. Back (catalog -> ticket)
    const backCatalog = page.locator('button[name="action_wizard_back"]:visible, button.btn-close:visible, .modal button[aria-label="Close"]:visible').first();
    await shot('30-back-from-catalog.png', backCatalog);
    if (await appears(backCatalog, 3_000)) {
      await backCatalog.click();
      await page.waitForTimeout(1_000);
    }
    await page.waitForTimeout(1_500);

    // ---------- Section E - RUG approval and order confirmation ----------
    // 31. Open the quotation (Sales Order smart button on the task; if the
    // Back button landed on the ticket instead, go through its Tasks button).
    const soButton = page.locator('button[name="action_view_so"]:visible, button.oe_stat_button:visible:has-text("Sales Order")').first();
    if (!(await appears(soButton, 6_000))) {
      note('Sales Order button not on the screen after Back; reopening the task through the ticket.');
      await ticketToTask('30b-tasks.png');
    }
    await expect(soButton).toBeVisible({ timeout: 15_000 });
    await shot('31-sales-order-button.png', soButton);
    await soButton.click();
    await page.waitForTimeout(2_000);
    const soName = (await page.locator('h1:visible').last().innerText().catch(() => ''))?.trim();
    const soRecords = soName ? await callKw(page, 'sale.order', 'search_read', [[['name', '=', soName]], ['id']]) : [];
    const soId: number = soRecords?.[0]?.id;
    expect(soId, `sales order id resolved from title "${soName}"`).toBeTruthy();

    // 32. Request RUG Approval
    const requestRug = anyBtn('Request RUG Approval');
    await expect(requestRug).toBeVisible({ timeout: 10_000 });
    await shot('32-request-rug-approval.png', requestRug);
    await requestRug.click();
    await page.waitForTimeout(2_000);

    // 33. Approve RUG (done by R&D)
    const approveRug = page.locator('button[name="action_approve_rug_direct"]:visible').first();
    await expect(approveRug).toBeVisible({ timeout: 10_000 });
    await shot('33-approve-rug.png', approveRug);
    await approveRug.click();
    await page.waitForTimeout(2_000);

    // 34. Confirm the sales order
    const confirmBtn = page.locator('div.o_statusbar_buttons button:visible', { hasText: /^Confirm$/ }).first();
    if (await appears(confirmBtn, 8_000)) {
      await shot('34-confirm-order.png', confirmBtn);
      await confirmBtn.click();
      await page.waitForTimeout(2_500);
    } else {
      note('Confirm hidden by Studio views; confirming through action_confirm RPC.');
      await shot('34-confirm-order.png', page.locator('.o_statusbar_status:visible'));
    }
    if ((await callKw(page, 'sale.order', 'read', [[soId], ['state']]))[0].state !== 'sale') {
      await callKwWithRetry(page, 'sale.order', 'action_confirm', [[soId]]);
    }
    expect((await callKw(page, 'sale.order', 'read', [[soId], ['state']]))[0].state).toBe('sale');
    await page.reload();
    await page.waitForTimeout(2_000);

    // ---------- Section F - Deliveries ----------
    // 35. Delivery button on the order
    const deliveryBtn = page.locator('button[name="action_view_delivery"]:visible, button.oe_stat_button:visible:has-text("Delivery")').first();
    await expect(deliveryBtn).toBeVisible({ timeout: 10_000 });
    await shot('35-delivery.png', deliveryBtn);
    await deliveryBtn.click();
    await page.waitForTimeout(2_000);
    const pickingIds: number[] = ((await callKw(page, 'sale.order', 'read', [[soId], ['picking_ids']]))[0].picking_ids ?? [])
      .slice().sort((a: number, b: number) => a - b);
    expect(pickingIds.length, 'delivery pickings created by the order').toBeGreaterThanOrEqual(1);
    note(`delivery pickings: ${JSON.stringify(pickingIds)}`);

    // 36-37. The delivery transfer of the order (a branch order has a single
    // outbound transfer). The Validate click is attempted in the UI and
    // the result verified; the transfer is validated through RPC if the click
    // does not complete it (Studio views hide/alter some buttons).
    const pickings: { id: number; name: string }[] = await callKw(page, 'stock.picking', 'read', [pickingIds, ['name']]);
    pickings.sort((x, y) => x.id - y.id);
    let step = 36;
    for (let i = 0; i < pickings.length; i++) {
      const pk = pickings[i];
      const slug = pk.name.replace(/\W+/g, '-');
      const isLast = i === pickings.length - 1;
      // With a single transfer the Delivery button opens it directly (no list).
      const row = page.locator('tr.o_data_row:visible', { hasText: pk.name }).first();
      if (await appears(row, pickings.length > 1 ? 10_000 : 4_000)) {
        await shot(`${step}-open-${slug}.png`, row);
        await row.locator('td.o_data_cell').nth(1).click();
        await page.waitForTimeout(2_000);
        step++;
      }

      const validateUi = page.locator('button:visible', { hasText: /^Validate$/ }).first();
      await expect(validateUi).toBeVisible({ timeout: 10_000 });
      await shot(`${step}-validate-${slug}.png`, validateUi);
      await validateUi.click().catch(() => note(`Validate click failed on ${pk.name}`));
      await page.waitForTimeout(2_500);
      // Confirmation wizards (immediate transfer / backorder), if any.
      const wiz = page.locator('.modal:visible button', { hasText: /^(Apply|Process|Confirm)$/ }).first();
      if (await wiz.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await wiz.click();
        await page.waitForTimeout(2_000);
      }
      // Validating a chained transfer can take several seconds server-side;
      // poll for the result instead of racing it with a second request.
      let [pstate] = await callKw(page, 'stock.picking', 'read', [[pk.id], ['state']]);
      for (let w = 0; w < 20 && pstate.state !== 'done'; w++) {
        await page.waitForTimeout(2_000);
        [pstate] = await callKw(page, 'stock.picking', 'read', [[pk.id], ['state']]);
      }
      if (pstate.state !== 'done') {
        note(`${pk.name}: Validate click did not complete the transfer (state ${pstate.state}); validated through RPC.`);
        await callKw(page, 'stock.picking', 'button_validate', [[pk.id]]);
        [pstate] = await callKw(page, 'stock.picking', 'read', [[pk.id], ['state']]);
      }
      expect(pstate.state, `${pk.name} done`).toBe('done');
      step++;

      const leave = isLast
        ? page.locator('.modal:visible button.btn-close').last()
        : page.locator('.modal:visible button:visible', { hasText: /^Back$/ }).last();
      await shot(`${step}-${isLast ? 'close' : 'back'}-${slug}.png`, leave);
      await leave.click({ force: true });
      await page.waitForTimeout(1_500);
      step++;
    }

    // ---------- Section G - Complete the task ----------
    // 38. Tasks (from the ticket) -> 39. Mark as done -> 40. Close
    await ticketToTask('38-tasks-close.png');
    const markDone = anyBtn('Mark as done');
    await expect(markDone).toBeVisible({ timeout: 15_000 });
    await shot('39-mark-as-done.png', markDone);
    await markDone.click();
    await page.waitForTimeout(2_000);
    await shot('40-close-task.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // ---------- Section H - Final invoice booked to RUG ----------
    // 41. Tasks (task for the final invoice)
    await ticketToTask('41-tasks-final-invoice.png');

    // 42. Create Invoice (on the task)
    const createInvoice = anyBtn('Create Invoice');
    await expect(createInvoice).toBeVisible({ timeout: 15_000 });
    await shot('42-create-invoice.png', createInvoice);
    await createInvoice.click({ force: true });
    await page.waitForTimeout(2_000);

    // 43. Create Draft Invoice (wizard)
    const draftInvoice = page.locator('.modal:visible button', { hasText: /Create Draft Invoice|^Create$|Create Invoice/ }).last();
    await expect(draftInvoice).toBeVisible({ timeout: 10_000 });
    await shot('43-create-draft-invoice.png', draftInvoice);
    await draftInvoice.click();
    await page.waitForTimeout(2_500);

    // 44. Change to RUG Account
    const rugAccount = page.locator('button[name="action_change_to_rug_account"]:visible').first();
    await expect(rugAccount).toBeVisible({ timeout: 15_000 });
    await shot('44-change-to-rug-account.png', rugAccount);
    await rugAccount.click();
    await page.waitForTimeout(2_500);

    // 45. Confirm (post) the invoice
    const postBtn = page.locator('.modal:visible div.o_statusbar_buttons button', { hasText: /^Confirm$/ }).first();
    const invName = (await page.locator('h1:visible').last().innerText().catch(() => ''))?.trim();
    if (await appears(postBtn, 10_000)) {
      await shot('45-confirm-invoice.png', postBtn);
      await postBtn.click();
      await page.waitForTimeout(2_500);
    } else {
      note('Invoice Confirm hidden by Studio views; posting through RPC.');
      await shot('45-confirm-invoice.png', page.locator('.o_statusbar_status:visible'));
    }
    const soInv: number[] = (await callKw(page, 'sale.order', 'read', [[soId], ['invoice_ids']]))[0].invoice_ids ?? [];
    expect(soInv.length, `invoice created for the order (${invName})`).toBeGreaterThan(0);
    let invState = (await callKw(page, 'account.move', 'read', [soInv, ['state', 'amount_total']]))[0];
    for (let w = 0; w < 10 && invState.state !== 'posted'; w++) {
      await page.waitForTimeout(2_000);
      invState = (await callKw(page, 'account.move', 'read', [soInv, ['state', 'amount_total']]))[0];
    }
    if (invState.state !== 'posted') {
      await callKw(page, 'account.move', 'action_post', [[soInv[0]]]);
      invState = (await callKw(page, 'account.move', 'read', [soInv, ['state', 'amount_total']]))[0];
    }
    expect(invState.state, 'invoice posted').toBe('posted');
    note(`final invoice total: ${invState.amount_total}`);

    // 46. Close the invoice
    await shot('46-close-invoice.png', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // ---------- Section I - Dispatch ----------
    // 47. Dispatch (visibility lags - poll with reload)
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await waitForStatusBtn('Dispatch');
    await shot('47-dispatch.png', statusBtn('Dispatch'));
    await statusBtn('Dispatch').click();
    await page.waitForTimeout(1_500);

    // 48. Validate the dispatch picking
    const validate = page.locator('.modal:visible button, button:visible', { hasText: 'Validate' }).first();
    await expect(validate).toBeVisible({ timeout: 10_000 });
    await shot('48-validate-dispatch.png', validate);
    await validate.click();
    await page.waitForTimeout(2_000);

    // 49. Back - return to the ticket view
    const closeX = page.locator('.modal:visible button.btn-close').first();
    const back = page.locator('button[name="action_wizard_back"]:visible').first();
    const leaveBtn = (await appears(back, 4_000)) ? back : closeX;
    await shot('49-back-to-ticket.png', leaveBtn);
    if (await appears(leaveBtn, 3_000)) await leaveBtn.click();
    await page.waitForTimeout(1_000);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: testInfo.outputPath('50-final-ticket.png'), fullPage: true });

    // The item has been dispatched: receipt and dispatch pickings are done.
    const [tkRead] = await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids', 'x_studio_rug_approval_status']]);
    const states = await callKw(page, 'stock.picking', 'read', [tkRead.repair_picking_ids, ['name', 'state']]);
    note(`repair pickings: ${JSON.stringify(states)}; RUG status: ${tkRead.x_studio_rug_approval_status}`);
    expect(states.filter((p: { state: string }) => p.state === 'done').length, 'receipt and dispatch pickings done').toBeGreaterThanOrEqual(2);
  });
});
