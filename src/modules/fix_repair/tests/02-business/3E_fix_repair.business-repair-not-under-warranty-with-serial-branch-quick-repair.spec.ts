/**
 * Step 2 - Business Logic for the fix_repair module.
 *
 * Covers the "3E. Repair User Guide - Branch [ Not Under Warranty ( With
 * Serial No ) - Quick Repair ]" Odoo Tour export: the BRANCH, With-Serial-No
 * version of the 1E Quick Repair.
 * Job Location is "Centre Repair", so there is no Send to / Received at
 * Factory leg and no Send to / Received at Sales Centre leg: after the item is
 * received the ticket goes straight to Plan Intervention. The item is
 * identified by an existing Serial Number (type "Repair - Not Under Warranty
 * (With Serial No)"); no Product selection, no Create Serial No, no Warranty
 * Card. Quotation accepted on the portal, the customer pays the FULL
 * invoice amount at once (no 50% deposit, no balance leg), deliveries, task
 * done, Dispatch.
 *
 * See notes/fix_repair.repair-not-under-warranty-with-serial-branch-quick-repair.guide.md
 * (and the matching 3E_Repair-...guide.html manual).
 *
 * Every guide screenshot is captured BEFORE the step's action, with the
 * element about to be used framed in red (see shot below).
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

test.describe('Fix Repair - Not Under Warranty (With Serial No) - Branch Quick Repair @module:fix_repair @step:business', () => {

  test('branch repair of a serial-numbered item is quick-repaired, paid in full, delivered and dispatched @smoke @e2e', async ({ page }, testInfo) => {
    test.setTimeout(600_000);

    const note = (description: string) => test.info().annotations.push({ type: 'note', description });

    // Screenshot of the state BEFORE the step's action, with the element
    // about to be used framed in red (outline applied for the instant of the
    // capture, then removed). File names are auto-numbered per guide step:
    // shot('slug') -> NN-slug.png; shot('+b-slug') -> NNb-slug.png (extra
    // image of the current step).
    let stepNo = 0;
    const appears = (loc: Locator, ms: number) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);
    const shot = async (slug: string, target?: Locator, targetPage: Page = page) => {
      let name: string;
      if (slug.startsWith('+')) {
        name = `${String(stepNo).padStart(2, '0')}${slug.slice(1)}.png`;
      } else {
        stepNo += 1;
        name = `${String(stepNo).padStart(2, '0')}-${slug}.png`;
      }
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
    const ticketToTask = async (slug: string) => {
      await closeStrayDialogs(page);
      await gotoRecord(page, 'helpdesk.ticket', ticketId);
      await expect(statBtn('Tasks')).toBeVisible({ timeout: 15_000 });
      await shot(slug, statBtn('Tasks'));
      await statBtn('Tasks').click();
      await page.waitForTimeout(1_500);
    };
    const taskToSalesOrder = async (slug: string) => {
      await expect(statBtn('Sales Order')).toBeVisible({ timeout: 15_000 });
      await shot(slug, statBtn('Sales Order'));
      await statBtn('Sales Order').click();
      await page.waitForTimeout(1_500);
    };

    // Register Payment wizard driven through the UI (journal + amount).
    // Returns false when the Register Payment button is not on screen.
    const registerPaymentUI = async (slugs: { btn: string; journal: string; bank: string; create: string }, amount?: number) => {
      const reg = page.locator('button:visible', { hasText: 'Register Payment' }).first();
      if (!(await appears(reg, 8_000))) return false;
      await shot(slugs.btn, reg);
      await reg.click({ force: true });
      await page.waitForTimeout(1_500);
      const modal = page.locator('.modal:visible').last();
      const journalInput = modal.locator('.o_field_widget[name="journal_id"] input').first();
      await journalInput.waitFor({ state: 'visible', timeout: 8_000 });
      await shot(slugs.journal, modal.locator('.o_field_widget[name="journal_id"]'));
      await journalInput.fill('Commercial Bank');
      await pickOption('Commercial Bank');
      await page.waitForTimeout(800);
      if (amount !== undefined) {
        const amountInput = modal.locator('.o_field_widget[name="amount"] input').first();
        await amountInput.fill(String(amount));
        await amountInput.press('Tab');
        await page.waitForTimeout(800);
      }
      await shot(slugs.bank, modal.locator(amount !== undefined ? '.o_field_widget[name="amount"]' : '.o_field_widget[name="journal_id"]'));
      const create = modal.locator('button:visible', { hasText: 'Create Payment' }).first();
      await shot(slugs.create, create);
      await create.click();
      await modal.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(2_000);
      const invalidOp = page.locator('.modal:visible', { hasText: 'Invalid Operation' }).first();
      expect(await invalidOp.isVisible({ timeout: 1_000 }).catch(() => false), 'payment accepted (no Invalid Operation)').toBeFalsy();
      return true;
    };

    const ticketPage = new FixRepairTicketPage(page);

    // ---------- Section A - Create the ticket ----------
    // 1. Helpdesk app (icon scrolled into view on the Apps home screen)
    await ticketPage.navigateTo('/web');
    await page.locator('a.o_menu_toggle').click();
    const helpdeskIcon = page.locator('[data-menu-xmlid="helpdesk.menu_helpdesk_root"]');
    await helpdeskIcon.waitFor({ state: 'visible', timeout: 15_000 });
    await helpdeskIcon.scrollIntoViewIfNeeded();
    await shot('helpdesk-app', helpdeskIcon);
    await helpdeskIcon.click();
    await ticketPage.waitForOdooReady();

    // 2. Tickets
    await shot('tickets-button', page.locator('button[name="action_view_ticket"]'));
    await ticketPage.openTicketsList();

    // 3. New
    await shot('new-button', page.getByRole('button', { name: /^New$/ }));
    await ticketPage.clickNewTicket();

    // 4. Assign to Me
    if (!(await statusBtn('Assign to Me').isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Assign to Me not available on this instance');
      return;
    }
    await shot('assign-to-me', statusBtn('Assign to Me'));
    await ticketPage.assignToMe();
    await page.locator('div.o_statusbar_buttons button', { hasText: 'Assign to Me' }).waitFor({ state: 'hidden', timeout: 10_000 });

    // 5. Type = Repair - Not Under Warranty (With Serial No)
    if (!(await field('ticket_type_id').isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'Fix Repair Studio customization not installed on this instance');
      return;
    }
    await shot('repair-type', field('ticket_type_id'));
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyWithSerial);
    await page.waitForTimeout(1_000);

    // 6. Return Receipt Location
    await shot('return-receipt', field('x_studio_return_receipt_location'));
    await ticketPage.returnReceiptLocation.setValue(FIX_REPAIR_TEST_CONFIG.returnReceiptLocationExample);

    // 7. Repair Reason
    await shot('repair-reason', field('x_studio_repair_reason'));
    await ticketPage.repairReason.addItem(FIX_REPAIR_TEST_CONFIG.repairReasonExample);
    await page.waitForTimeout(1_000);

    // 8. Job Location = Centre Repair
    await shot('job-location', field('x_studio_job_location'));
    await ticketPage.jobLocation.selectByLabel(FIX_REPAIR_TEST_CONFIG.jobLocationCentre);

    // 9. Customer
    await shot('customer', field('partner_id'));
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
    await shot('serial-no', serialField);
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
    await shot('+b-serial-entered');

    // ---------- Section B - Receive the item ----------
    // 11. Return (the UI button's server method always raises "You may only
    // return Done pickings" but still creates the return picking first).
    await page.waitForTimeout(2_000);
    const invalidFields = await page.locator('.o_field_invalid').evaluateAll((els) => els.map((e) => e.getAttribute('name')));
    if (invalidFields.length) note(`invalid fields before Return: ${invalidFields.join(', ')}`);
    const ticketName = (await page.locator('h1').first().innerText().catch(() => ''))?.trim();
    const lookup = await callKw(page, 'helpdesk.ticket', 'search_read', [[['name', '=', ticketName]], ['id']]);
    ticketId = lookup?.[0]?.id;
    expect(ticketId, 'ticket id resolved from its name').toBeTruthy();
    await page.evaluate(() => document.querySelectorAll('.o_content, .o_action_manager, .o_form_sheet_bg').forEach((e) => { (e as HTMLElement).scrollTop = 0; }));
    await shot('return', statusBtn('Return'));
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

    // 12. Validate the return picking (hidden by Studio views -> RPC).
    await gotoRecord(page, 'stock.picking', returnPickingIds[0]);
    await page.waitForTimeout(1_500);
    await shot('validate-return', page.locator('button[data-hotkey="v"]:visible, button[name="button_validate"]:visible'));
    for (const id of returnPickingIds) {
      const [p] = await callKw(page, 'stock.picking', 'read', [[id], ['state']]);
      if (p.state !== 'done') await callKw(page, 'stock.picking', 'button_validate', [[id]]).catch((err) => note(`validate ${id}: ${(err as Error).message}`));
    }
    await page.reload();
    await page.waitForTimeout(1_500);

    // 13. Back to the ticket
    await shot('back', page.locator('button[name="action_wizard_back"]:visible, .modal:visible button.btn-close').first());
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);

    // ---------- Section C - Task (Centre Repair: no factory leg) ----------
    await waitForStatusBtn('Plan Intervention');
    // 16. Plan Intervention
    await expect(statusBtn('Plan Intervention')).toBeVisible({ timeout: 10_000 });
    await shot('plan-intervention', statusBtn('Plan Intervention'));
    await statusBtn('Plan Intervention').click();

    // 17. Create & View Task
    const createTask = page.getByRole('button', { name: 'Create & View Task' });
    await createTask.waitFor({ state: 'visible', timeout: 10_000 });
    await shot('create-view-task', createTask);
    await createTask.click();
    await page.getByText('Create a Field Service task').waitFor({ state: 'hidden', timeout: 15_000 });
    await page.getByRole('tab', { name: 'Repair Diagnosis' }).waitFor({ state: 'visible', timeout: 15_000 });

    // ---------- Section D - Diagnosis, image and parts ----------
    // 18. Repair Diagnosis tab
    const diagnosisTab = page.getByRole('tab', { name: 'Repair Diagnosis' });
    await shot('diagnosis-tab', diagnosisTab);
    await diagnosisTab.click();

    // 19. Add a line
    const addLine = page.getByText('Add a line').first();
    await expect(addLine).toBeVisible({ timeout: 5_000 });
    await shot('add-line', addLine);
    await addLine.click();
    await page.waitForTimeout(500);
    const diagnosisTable = page.locator('[name="x_studio_diagnosis_ids"]');
    await diagnosisTable.locator('[name="x_studio_description"] input, [name="x_studio_description"] textarea').first().fill('Engine diagnosis');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    const pickInCell = async (slug: string, fieldName: string, searchText: string) => {
      const cell = diagnosisTable.locator(`[name="${fieldName}"]`).first();
      await shot(slug, cell);
      await cell.click();
      const input = cell.locator('input').first();
      if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) await input.fill(searchText);
      await pickOption(searchText);
    };
    await pickInCell('diagnosis-area', 'x_studio_diagnosis_area', FIX_REPAIR_TEST_CONFIG.diagnosisArea);
    await pickInCell('diagnosis-code', 'x_studio_diagnosis_code', FIX_REPAIR_TEST_CONFIG.diagnosisCode);
    await pickInCell('diagnosis-reason', 'x_studio_reason', FIX_REPAIR_TEST_CONFIG.diagnosisReason);
    await pickInCell('diagnosis-sub-reason', 'x_studio_sub_reason', FIX_REPAIR_TEST_CONFIG.diagnosisSubReason);
    await pickInCell('diagnosis-resolution', 'x_studio_resolution', FIX_REPAIR_TEST_CONFIG.diagnosisResolution);
    await pickInCell('diagnosis-repair-stage', 'x_studio_repair_stage', FIX_REPAIR_TEST_CONFIG.diagnosisRepairStage);
    await page.waitForTimeout(500);

    // 26. Repair Image tab
    const imageTab = page.getByRole('tab', { name: 'Repair Image' });
    await shot('repair-image-tab', imageTab);
    await imageTab.click();
    await page.waitForTimeout(500);

    // 27. Take a Picture (upload)
    const imageField = field('x_studio_repair_image_01');
    await shot('take-picture', imageField);
    await imageField.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), FIX_REPAIR_TEST_CONFIG.repairImagePath));
    await page.waitForTimeout(1_500);

    // 28. Products (renders only once diagnosis + image are set)
    const productsButton = page
      .locator('button[name="action_fsm_view_material"]:visible')
      .or(page.locator('.o_button_box button:visible', { hasText: 'Products' }))
      .first();
    await expect(productsButton).toBeVisible({ timeout: 10_000 });
    await shot('products', productsButton);
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
    // The catalog's kanban can be slow to re-render after the search (observed once as a flake).
    await page.locator('.o_kanban_record').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined);
    await expect(addBtn).toBeVisible({ timeout: 20_000 });
    await shot('add-part', addBtn);
    await addBtn.click();
    await page.waitForTimeout(1_000);

    // 30. Back (catalog -> task)
    await dismissNotifications(page);
    const backCatalog = page.locator('button[name="action_wizard_back"]:visible, button.btn-close:visible, .modal button[aria-label="Close"]:visible').first();
    await shot('back-from-catalog', backCatalog);
    if (await appears(backCatalog, 3_000)) {
      await backCatalog.click();
      await page.waitForTimeout(1_000);
    }
    await page.waitForTimeout(1_500);

    // ---------- Section E - Quotation and customer confirmation ----------
    // 31. Sales Order (quotation) smart button on the task; if Back landed on
    // the ticket instead, go through its Tasks button.
    const soButton = page.locator('button[name="action_view_so"]:visible, button.oe_stat_button:visible:has-text("Sales Order")').first();
    if (!(await appears(soButton, 6_000))) {
      note('Sales Order button not on the screen after Back; reopening the task through the ticket.');
      await ticketToTask('tasks-quotation');
      stepNo -= 1; // not a guide step of its own
    }
    await expect(soButton).toBeVisible({ timeout: 15_000 });
    await shot('sales-order-button', soButton);
    await soButton.click();
    await page.waitForTimeout(2_000);
    await page.locator('.modal h1:visible').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    const soName = (await page.locator('h1:visible').last().innerText().catch(() => ''))?.trim();
    const soRecords = soName ? await callKw(page, 'sale.order', 'search_read', [[['name', '=', soName]], ['id']]) : [];
    const soId: number = soRecords?.[0]?.id;
    expect(soId, `sales order id resolved from title "${soName}"`).toBeTruthy();
    note(`quotation: ${soName}`);

    // 32. Send by Email
    const sendByEmail = anyBtn('Send by Email');
    await expect(sendByEmail).toBeVisible({ timeout: 10_000 });
    await shot('send-by-email', sendByEmail);
    await sendByEmail.click();
    await page.waitForTimeout(1_500);

    // 33. Send
    const sendButton = page.locator('.modal:visible button', { hasText: /^Send$/ }).first();
    await expect(sendButton).toBeVisible({ timeout: 8_000 });
    await shot('send', sendButton);
    await sendButton.click();
    await page.waitForTimeout(2_000);

    // (The 3C tour goes straight from Send to the customer's confirmation: no
    // Close / Tasks / Sales Order navigation steps in between.)

    // Confirm - the customer accepts the quotation through the real
    // online portal (View Quotation -> Accept & Sign -> Accept & Sign).
    const portalUrlRaw = await callKw(page, 'sale.order', 'get_portal_url', [[soId]]);
    expect(typeof portalUrlRaw).toBe('string');
    const absoluteUrl = String(portalUrlRaw).startsWith('http') ? portalUrlRaw : `${new URL(page.url()).origin}${portalUrlRaw}`;
    await shot('confirm', page.locator('.modal:visible .o_statusbar_status').first());
    const portalPage = await page.context().newPage();
    await portalPage.goto(absoluteUrl);
    await portalPage.waitForTimeout(2_000);
    const acceptSign = portalPage.locator('button:visible, a:visible', { hasText: 'Accept & Sign' }).first();
    if (await acceptSign.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await shot('+b-portal-quotation', acceptSign, portalPage);
      await acceptSign.click();
      await portalPage.waitForTimeout(1_500);
      const signatureModal = portalPage.locator('.modal:visible, .o_portal_sign_modal:visible').first();
      const finalAccept = signatureModal.locator('button:visible', { hasText: 'Accept & Sign' }).first();
      if (await finalAccept.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await shot('+c-portal-signature', finalAccept, portalPage);
        await finalAccept.click();
        await signatureModal.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
        await portalPage.waitForTimeout(2_000);
      }
      await shot('+d-portal-confirmed', undefined, portalPage);
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

    // ---------- Section F - full payment ----------
    // 38. Create Invoice
    const createInvoice = anyBtn('Create Invoice');
    await expect(createInvoice).toBeVisible({ timeout: 10_000 });
    await shot('create-invoice', createInvoice);
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

    // 39. Confirm (post) the invoice - hidden by Studio views, so RPC; the
    // screenshot shows the draft invoice before posting.
    await shot('confirm-invoice', page.locator('button:visible', { hasText: 'Confirm' }).first());
    await callKw(page, 'account.move', 'action_post', [[invoiceId]]);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'account.move', invoiceId!);
    await page.waitForTimeout(1_500);

    // 40-43. Register the full payment. UI wizard when the button is exposed,
    // otherwise the same wizard model through RPC.
    const invoiceTotal: number = (await callKw(page, 'account.move', 'read', [[invoiceId], ['amount_total']]))[0].amount_total;
    const depositViaUi = await registerPaymentUI(
      { btn: 'register-payment', journal: 'journal', bank: 'bank-amount', create: 'create-payment' },
      undefined,
    );
    if (!depositViaUi) {
      note('Register Payment hidden on the invoice; deposit created via account.payment.register RPC.');
      await shot('register-payment', page.locator('.o_form_view:visible').first());
      const journals = await callKw(page, 'account.journal', 'search_read', [[['name', 'ilike', 'Commercial Bank']], ['id']]);
      expect(journals?.[0]?.id, 'Commercial Bank journal').toBeTruthy();
      const ctx = { active_model: 'account.move', active_ids: [invoiceId] };
      const wizardId = await callKw(page, 'account.payment.register', 'create',
        [{ journal_id: journals[0].id, amount: invoiceTotal, payment_date: new Date().toISOString().slice(0, 10) }], ctx);
      const action = await callKw(page, 'account.payment.register', 'action_create_payments', [[wizardId]], ctx);
      expect(action?.res_id, 'deposit payment created').toBeTruthy();
      await gotoRecord(page, 'account.payment', action.res_id);
      await page.waitForTimeout(1_500);
      await shot('journal', field('journal_id'));
      await shot('bank-amount', field('amount'));
      await shot('create-payment', undefined);
    }

    // 44. Close the invoice
    await shot('close-invoice', page.locator('.modal:visible button.btn-close').or(page.locator('.o_form_view .ribbon:visible')).first());
    await closeStrayDialogs(page);

    // ---------- Section G - Deliveries ----------
    // 45/46. ticket -> Tasks -> Sales Order
    await ticketToTask('tasks-delivery');
    await taskToSalesOrder('sales-order-delivery');

    // 47. Delivery button on the order
    const deliveryBtn = page.locator('button[name="action_view_delivery"]:visible, button.oe_stat_button:visible:has-text("Delivery")').first();
    await expect(deliveryBtn).toBeVisible({ timeout: 10_000 });
    await shot('delivery', deliveryBtn);
    await deliveryBtn.click();
    await page.waitForTimeout(2_000);
    const pickingIds: number[] = ((await callKw(page, 'sale.order', 'read', [[soId], ['picking_ids']]))[0].picking_ids ?? [])
      .slice().sort((a: number, b: number) => a - b);
    expect(pickingIds.length, 'delivery pickings created by the order').toBeGreaterThanOrEqual(1);
    note(`delivery pickings: ${JSON.stringify(pickingIds)}`);

    // 48-56. The three transfers of the order, validated in dependency order
    // (outbound from the warehouse -> repair-centre receipt -> repair-centre
    // delivery to the customer). The Validate click is attempted in the UI and
    // the result verified; the transfer is validated through RPC if the click
    // does not complete it (Studio views hide/alter some buttons).
    const pickings: { id: number; name: string }[] = await callKw(page, 'stock.picking', 'read', [pickingIds, ['name']]);
    pickings.sort((x, y) => x.id - y.id);
    for (let i = 0; i < pickings.length; i++) {
      const pk = pickings[i];
      const slug = pk.name.replace(/\W+/g, '-');
      const isLast = i === pickings.length - 1;
      // With several transfers the Delivery button lists them; with a single
      // one (stock available at the branch) it opens that transfer directly.
      const row = page.locator('tr.o_data_row:visible', { hasText: pk.name }).first();
      if (await appears(row, 6_000)) {
        await shot(`open-${slug}`, row);
        await row.locator('td.o_data_cell').nth(1).click();
        await page.waitForTimeout(2_000);
      } else {
        note(`${pk.name} was opened directly by the Delivery button (single transfer).`);
      }

      const validateUi = page.locator('button:visible', { hasText: /^Validate$/ }).first();
      await expect(validateUi).toBeVisible({ timeout: 10_000 });
      await shot(`validate-${slug}`, validateUi);
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

      await dismissNotifications(page);
      const leave = isLast
        ? page.locator('.modal:visible button.btn-close').last()
        : page.locator('.modal:visible button:visible', { hasText: /^Back$/ }).last();
      await shot(`${isLast ? 'close' : 'back'}-${slug}`, leave);
      await leave.click({ force: true });
      await page.waitForTimeout(1_500);
    }

    // ---------- Section H - Complete the task ----------
    // Tasks (from the ticket) -> Mark as done -> Close
    await ticketToTask('tasks-close');
    const markDone = anyBtn('Mark as done');
    await expect(markDone).toBeVisible({ timeout: 15_000 });
    await shot('mark-as-done', markDone);
    await markDone.click();
    await page.waitForTimeout(2_000);
    await shot('close-task', page.locator('.modal:visible button.btn-close').first());
    await closeStrayDialogs(page);

    // ---------- Section I - Dispatch ----------
    // Dispatch (visibility lags the task completion - poll with reload)
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await waitForStatusBtn('Dispatch');
    await shot('dispatch', statusBtn('Dispatch'));
    await statusBtn('Dispatch').click();
    await page.waitForTimeout(1_500);

    // Validate the dispatch picking
    const validate = page.locator('.modal:visible button, button:visible', { hasText: 'Validate' }).first();
    await expect(validate).toBeVisible({ timeout: 10_000 });
    await shot('validate-dispatch', validate);
    await validate.click();
    await page.waitForTimeout(2_000);

    // Close - back to the ticket view
    const closeX = page.locator('.modal:visible button.btn-close').first();
    const back = page.locator('button[name="action_wizard_back"]:visible').first();
    const leaveBtn = (await appears(closeX, 4_000)) ? closeX : back;
    await shot('close', leaveBtn);
    if (await appears(leaveBtn, 3_000)) await leaveBtn.click();
    await page.waitForTimeout(1_000);
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);
    await page.screenshot({ path: testInfo.outputPath(`${String(stepNo + 1).padStart(2, '0')}-final-ticket.png`), fullPage: true });

    // The item has been dispatched: receipt and dispatch pickings are done.
    const [tkRead] = await callKw(page, 'helpdesk.ticket', 'read', [[ticketId], ['repair_picking_ids']]);
    const states = await callKw(page, 'stock.picking', 'read', [tkRead.repair_picking_ids, ['name', 'state']]);
    note(`repair pickings: ${JSON.stringify(states)}`);
    expect(states.filter((p: { state: string }) => p.state === 'done').length, 'receipt and dispatch pickings done').toBeGreaterThanOrEqual(2);
  });
});
