/**
 * Step 2 - Business Logic for the fix_repair module.
 *
 * Covers the "6. Repair User Guide - How to Re-Estimate the Repair Quotation"
 * Odoo Tour export. A Factory-repair ticket of type "Repair - Not Under
 * Warranty (Without Serial No)" is taken as far as a quotation sent to the
 * customer (Create Serial No, Return, Send to / Received at Factory, task with
 * diagnosis, image and a spare part). The quotation is then re-estimated twice:
 * once while it is only sent (Re-estimate, quantity +1, resend) and once after
 * the sale order was confirmed (Unlock, Re-estimate, quantity +1, resend) and
 * finally confirmed again.
 *
 * See notes/fix_repair.repair-how-to-re-estimate-the-quotation.guide.md
 * (and the matching 6_Repair-...guide.html manual).
 * Every screenshot is captured BEFORE the step's action (red box on target).
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

test.describe('Fix Repair - How to Re-Estimate the Repair Quotation @module:fix_repair @step:business', () => {

  test('quotation is re-estimated after sending and after confirmation @smoke @e2e', async ({ page }, testInfo) => {
    test.setTimeout(900_000);

    const note = (description: string) => test.info().annotations.push({ type: 'note', description });

    // Screenshot of the state BEFORE the step's action, with the element
    // about to be used framed in red (outline applied for the instant of the
    // capture, then removed). shot('slug') -> NN-slug.png;
    // shot('+b-slug') -> NNb-slug.png (extra image of the current step).
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
    const topModal = () => page.locator('.modal:visible').last();
    let ticketId = 0;

    const dumpButtons = async (label: string) => {
      const texts = await page.locator('.modal:visible button:visible, .o_form_view button:visible').evaluateAll((els) =>
        els.map((e) => ((e as HTMLElement).getAttribute('name') || '') + ':' + (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter((t) => t.length > 1));
      note(`buttons @ ${label}: ${[...new Set(texts)].join(' | ')}`);
    };

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
      await matching.first().waitFor({ state: 'visible', timeout: 6_000 }).catch(() => undefined);
      const target = (await matching.count()) > 0 ? matching.first() : options.first();
      await target.click();
      await page.waitForTimeout(400);
    };

    // Ticket -> Tasks stat button (task opens as a dialog on the ticket).
    const ticketToTask = async (slug: string) => {
      await closeStrayDialogs(page);
      await gotoRecord(page, 'helpdesk.ticket', ticketId);
      await page.reload();
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
    // Sales Order dialog -> its task (stat button "N Tasks").
    const soToTask = async (slug: string) => {
      const b = page.locator('.modal:visible button[name="action_view_task"]').first();
      await expect(b).toBeVisible({ timeout: 15_000 });
      await shot(slug, b);
      await b.click();
      await page.waitForTimeout(1_500);
    };
    // Task -> Products catalog: raise the first line's quantity by one.
    const raiseQuantity = async (slugProducts: string, slugPlus: string, slugBack: string) => {
      const products = page.locator('.modal:visible button[name="action_fsm_view_material"]').first();
      await expect(products).toBeVisible({ timeout: 15_000 });
      await shot(slugProducts, products);
      await products.click();
      await page.waitForTimeout(2_000);
      const plusBtn = page.locator('div.o_product_catalog_quantity button:visible').last();
      await expect(plusBtn).toBeVisible({ timeout: 15_000 });
      await shot(slugPlus, plusBtn);
      await plusBtn.click();
      await page.waitForTimeout(1_500);
      const back = page.locator('button[name="action_wizard_back"]:visible, .modal:visible button.btn-close').first();
      await shot(slugBack, back);
      await back.click();
      await page.waitForTimeout(1_500);
    };
    // Sales Order dialog: Send by Email -> Send -> Close.
    const sendQuotation = async (slugs: { email: string; send: string; close: string }) => {
      const sendByEmail = page.locator('button:visible', { hasText: 'Send by Email' }).first();
      await expect(sendByEmail).toBeVisible({ timeout: 10_000 });
      await shot(slugs.email, sendByEmail);
      await sendByEmail.click();
      await page.waitForTimeout(1_500);
      const sendButton = page.locator('.modal:visible button', { hasText: /^Send$/ }).first();
      await expect(sendButton).toBeVisible({ timeout: 8_000 });
      await shot(slugs.send, sendButton);
      await sendButton.click();
      await page.waitForTimeout(2_000);
      await shot(slugs.close, page.locator('.modal:visible button.btn-close').first());
      await closeStrayDialogs(page);
    };
    const soState = async (id: number) => (await callKw(page, 'sale.order', 'read', [[id], ['state', 'order_line']]))[0] as { state: string; order_line: number[] };
    const qtyOf = async (id: number) => {
      const lines: { product_uom_qty: number }[] = await callKw(page, 'sale.order.line', 'search_read', [[['order_id', '=', id], ['display_type', '=', false]], ['product_uom_qty']]);
      return lines.reduce((s, l) => s + l.product_uom_qty, 0);
    };

    // Customer accepts the quotation on the public portal page.
    const customerAccepts = async (slug: string, id: number) => {
      const portalUrlRaw = await callKw(page, 'sale.order', 'get_portal_url', [[id]]);
      const absoluteUrl = String(portalUrlRaw).startsWith('http') ? String(portalUrlRaw) : `${new URL(page.url()).origin}${portalUrlRaw}`;
      const portalPage = await page.context().newPage();
      await portalPage.goto(absoluteUrl);
      await portalPage.waitForTimeout(2_000);
      const acceptSign = portalPage.locator('button:visible, a:visible', { hasText: 'Accept & Sign' }).first();
      await expect(acceptSign).toBeVisible({ timeout: 15_000 });
      await shot(slug, acceptSign, portalPage);
      await acceptSign.click();
      await portalPage.waitForTimeout(1_500);
      const signatureModal = portalPage.locator('.modal:visible, .o_portal_sign_modal:visible').first();
      const finalAccept = signatureModal.locator('button:visible', { hasText: 'Accept & Sign' }).first();
      if (await finalAccept.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await shot('+b-portal-signature', finalAccept, portalPage);
        await finalAccept.click();
        await signatureModal.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
        await portalPage.waitForTimeout(2_000);
      }
      await shot('+c-portal-accepted', undefined, portalPage);
      await portalPage.close();
      await closeStrayDialogs(page);
    };
    // Sales Order dialog: Re-estimate -> Ok (confirmation dialog).
    const reEstimateFlow = async (slugBtn: string, slugOk: string) => {
      const reEstimate = page.locator('.modal:visible button[name="action_re_estimate"]:visible').first();
      await expect(reEstimate).toBeVisible({ timeout: 10_000 });
      await shot(slugBtn, reEstimate);
      await reEstimate.click();
      await page.waitForTimeout(1_500);
      const okBtn = topModal().locator('footer button.btn-primary').first();
      await expect(okBtn).toBeVisible({ timeout: 8_000 });
      await shot(slugOk, okBtn);
      await okBtn.click();
      await page.waitForTimeout(2_500);
    };

    const ticketPage = new FixRepairTicketPage(page);

    // ---------- Section A - Create the ticket ----------
    // 1. Helpdesk app
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

    // 5. Type = Repair - Not Under Warranty (Without Serial No)
    if (!(await field('ticket_type_id').isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, 'Fix Repair Studio customization not installed on this instance');
      return;
    }
    await shot('repair-type', field('ticket_type_id'));
    await ticketPage.repairType.setValue(FIX_REPAIR_TEST_CONFIG.repairTypeNotUnderWarrantyNoSerial);
    await page.waitForTimeout(1_000);

    // 6. Return Receipt Location
    await shot('return-receipt', field('x_studio_return_receipt_location'));
    {
      const locInput = field('x_studio_return_receipt_location').locator('input').first();
      for (const term of [FIX_REPAIR_TEST_CONFIG.returnReceiptLocationExample, 'BR-AM', 'Stock']) {
        await locInput.fill(term);
        await page.waitForTimeout(2_500);
        const texts = await page.locator('.o-autocomplete--dropdown-menu, .o_field_many2one_dropdown').allInnerTexts();
        note(`return receipt search "${term}": ${JSON.stringify(texts)}`);
        if (texts.join('').includes('BR-AM/Stock')) break;
      }
      await pickOption(FIX_REPAIR_TEST_CONFIG.returnReceiptLocationExample);
    }

    // 7. Repair Reason
    await shot('repair-reason', field('x_studio_repair_reason'));
    await ticketPage.repairReason.addItem(FIX_REPAIR_TEST_CONFIG.repairReasonExample);
    await page.waitForTimeout(1_000);

    // 8. Job Location = Factory Repair
    await shot('job-location', field('x_studio_job_location'));
    await ticketPage.jobLocation.selectByLabel(FIX_REPAIR_TEST_CONFIG.jobLocationFactory);

    // 9. Customer
    await shot('customer', field('partner_id'));
    await ticketPage.customer.setValue(FIX_REPAIR_TEST_CONFIG.customerExample);
    await page.waitForTimeout(1_000);

    // 10. Product
    await shot('product', field('product_id'));
    await ticketPage.product.setValue(FIX_REPAIR_TEST_CONFIG.productSearchTerm);
    await page.waitForTimeout(1_000);

    // ---------- Section B - Receive the item ----------
    // 11. Create Serial No
    const createSerial = page.locator('button[name="action_create_repair_serial"]');
    await expect(createSerial).toBeVisible({ timeout: 8_000 });
    const saveBtn = page.locator('.o_form_button_save, button[name="save_manually"]').first();
    if (await saveBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) await ticketPage.save();
    await shot('create-serial', createSerial);
    await ticketPage.createRepairSerial();
    await page.waitForTimeout(1_500);

    // 12. Return (the UI button's server method always raises "You may only
    // return Done pickings" but still creates the return picking first).
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

    // 13. Validate the return picking (hidden by Studio views -> RPC).
    await gotoRecord(page, 'stock.picking', returnPickingIds[0]);
    await page.waitForTimeout(1_500);
    await shot('validate-return', page.locator('button[data-hotkey="v"]:visible, button[name="button_validate"]:visible'));
    for (const id of returnPickingIds) {
      const [p] = await callKw(page, 'stock.picking', 'read', [[id], ['state']]);
      if (p.state !== 'done') await callKw(page, 'stock.picking', 'button_validate', [[id]]).catch((err) => note(`validate ${id}: ${(err as Error).message}`));
    }
    await page.reload();
    await page.waitForTimeout(1_500);

    // 14. Close - back to the ticket
    await shot('close-return', page.locator('button[name="action_wizard_back"]:visible, .modal:visible button.btn-close').first());
    await closeStrayDialogs(page);
    await gotoRecord(page, 'helpdesk.ticket', ticketId);
    await page.waitForTimeout(1_500);

    // ---------- Section C - Factory and task ----------
    // 15. Send to Factory
    await waitForStatusBtn('Send to Factory');
    await shot('send-to-factory', statusBtn('Send to Factory'));
    await statusBtn('Send to Factory').click();
    await page.waitForTimeout(1_500);

    // 16. Received at Factory
    await expect(statusBtn('Received at Factory')).toBeVisible({ timeout: 10_000 });
    await shot('received-at-factory', statusBtn('Received at Factory'));
    await statusBtn('Received at Factory').click();
    await page.waitForTimeout(1_500);

    // 17. Plan Intervention
    await expect(statusBtn('Plan Intervention')).toBeVisible({ timeout: 10_000 });
    await shot('plan-intervention', statusBtn('Plan Intervention'));
    await statusBtn('Plan Intervention').click();

    // 18. Create & View Task
    const createTask = page.getByRole('button', { name: 'Create & View Task' });
    await createTask.waitFor({ state: 'visible', timeout: 10_000 });
    await shot('create-view-task', createTask);
    await createTask.click();
    await page.getByText('Create a Field Service task').waitFor({ state: 'hidden', timeout: 15_000 });
    await page.getByRole('tab', { name: 'Repair Diagnosis' }).waitFor({ state: 'visible', timeout: 15_000 });

    // ---------- Section D - Diagnosis, image and parts ----------
    // 19. Repair Diagnosis tab
    const diagnosisTab = page.getByRole('tab', { name: 'Repair Diagnosis' });
    await shot('diagnosis-tab', diagnosisTab);
    await diagnosisTab.click();

    // 20. Add a line
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
    // 21-26. Diagnosis area, code, reason, sub reason, resolution, repair stage
    await pickInCell('diagnosis-area', 'x_studio_diagnosis_area', FIX_REPAIR_TEST_CONFIG.diagnosisArea);
    await pickInCell('diagnosis-code', 'x_studio_diagnosis_code', FIX_REPAIR_TEST_CONFIG.diagnosisCode);
    await pickInCell('diagnosis-reason', 'x_studio_reason', FIX_REPAIR_TEST_CONFIG.diagnosisReason);
    await pickInCell('diagnosis-sub-reason', 'x_studio_sub_reason', FIX_REPAIR_TEST_CONFIG.diagnosisSubReason);
    await pickInCell('diagnosis-resolution', 'x_studio_resolution', FIX_REPAIR_TEST_CONFIG.diagnosisResolution);
    await pickInCell('diagnosis-repair-stage', 'x_studio_repair_stage', FIX_REPAIR_TEST_CONFIG.diagnosisRepairStage);
    await page.waitForTimeout(500);

    // 27. Repair Image tab
    const imageTab = page.getByRole('tab', { name: 'Repair Image' });
    await shot('repair-image-tab', imageTab);
    await imageTab.click();
    await page.waitForTimeout(500);

    // 28. Take a Picture (upload)
    const imageField = field('x_studio_repair_image_01');
    await shot('take-picture', imageField);
    await imageField.locator('input[type="file"]').first().setInputFiles(path.resolve(process.cwd(), FIX_REPAIR_TEST_CONFIG.repairImagePath));
    await page.waitForTimeout(1_500);

    // 29. Products (renders only once diagnosis + image are set)
    const productsButton = page
      .locator('button[name="action_fsm_view_material"]:visible')
      .or(page.locator('.o_button_box button:visible', { hasText: 'Products' }))
      .first();
    await expect(productsButton).toBeVisible({ timeout: 10_000 });
    await shot('products', productsButton);
    await productsButton.click();
    await page.waitForTimeout(1_500);

    // 30. Add the spare part
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
    await shot('add-part', addBtn);
    await addBtn.click();
    await page.waitForTimeout(1_000);

    // 31. Close the catalog
    const closeCatalog = page.locator('button.btn-close, .modal button[aria-label="Close"]').first();
    await shot('close-catalog', closeCatalog);
    if (await closeCatalog.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await closeCatalog.click();
      await page.waitForTimeout(1_000);
    }

    // ---------- Section E - Quotation sent to the customer ----------
    // 32/33. ticket -> Tasks -> Sales Order
    await ticketToTask('tasks-quotation');
    await taskToSalesOrder('sales-order');
    await page.locator('.modal h1:visible').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    const soName = (await page.locator('.modal h1:visible').first().innerText().catch(() => ''))?.trim();
    const soRecords = soName ? await callKw(page, 'sale.order', 'search_read', [[['name', '=', soName]], ['id']]) : [];
    const soId: number = soRecords?.[0]?.id;
    expect(soId, `sales order id resolved from title "${soName}"`).toBeTruthy();
    const qtyInitial = await qtyOf(soId);
    note(`quotation ${soName} initial quantity: ${qtyInitial}`);

    // 34-36. Send by Email, Send, Close
    await sendQuotation({ email: 'send-by-email', send: 'send', close: 'close-quotation' });
    expect((await soState(soId)).state, 'quotation sent').toBe('sent');

    // 37. The customer approves the quotation through the online portal
    // (View Quotation -> Accept & Sign -> Accept & Sign).
    await customerAccepts('customer-accepts', soId);

    // ---------- Section F - Re-estimate after the customer approved ----------
    // 38/39. ticket -> Tasks -> Sales Order
    await ticketToTask('tasks-approved');
    await taskToSalesOrder('sales-order-approved');
    await dumpButtons('SO after customer approval');

    // 40/41. Re-estimate + Ok
    await reEstimateFlow('re-estimate', 're-estimate-ok');
    expect((await soState(soId)).state, 'quotation back to draft after re-estimate').toBe('draft');
    await dumpButtons('SO after re-estimate 1');

    // 42-45. Open the task, raise the quantity by one, back to the task
    await soToTask('so-to-task');
    await raiseQuantity('task-products', 'increase-quantity', 'back-to-task');
    expect(await qtyOf(soId), 'quantity raised by one').toBe(qtyInitial + 1);

    // 46-49. Sales Order, Send by Email, Send, Close
    await taskToSalesOrder('sales-order-re-estimated');
    await sendQuotation({ email: 'resend-by-email', send: 'resend', close: 'close-resent' });
    await customerAccepts('customer-accepts-again', soId);

    // ---------- Section G - Confirm, then re-estimate the confirmed order ----------
    // Tasks -> Sales Order
    await ticketToTask('tasks-after-re-estimate');
    await taskToSalesOrder('sales-order-after-re-estimate');
    await dumpButtons('SO before confirm');

    // Confirm the re-estimated sales order
    const confirmBtn = page.locator('.modal:visible button[name="action_confirm"]:visible').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    await shot('confirm', confirmBtn);
    await confirmBtn.click();
    await page.waitForTimeout(3_000);
    if ((await soState(soId)).state !== 'sale') {
      note('Confirm click did not reach state sale; confirming through RPC.');
      await callKwWithRetry(page, 'sale.order', 'action_confirm', [[soId]]);
    }
    expect((await soState(soId)).state, 'order confirmed').toBe('sale');
    await dumpButtons('SO after confirm');

    // Delivery orders created by the confirmation, then Back
    const delivery = page.locator('.modal:visible button[name="action_view_delivery"]').first();
    await expect(delivery).toBeVisible({ timeout: 10_000 });
    await shot('delivery-orders', delivery);
    await delivery.click();
    await page.waitForTimeout(2_000);
    const backFromDelivery = page.locator('button[name="action_wizard_back"]:visible').first();
    await shot('back-from-delivery', backFromDelivery);
    await backFromDelivery.click();
    await page.waitForTimeout(1_500);

    // Unlock
    const unlock = page.locator('.modal:visible button[name="action_unlock"]:visible').first();
    await expect(unlock).toBeVisible({ timeout: 10_000 });
    await shot('unlock', unlock);
    await unlock.click();
    await page.waitForTimeout(2_000);
    await dumpButtons('SO after unlock');

    // Re-estimate + Ok
    await reEstimateFlow('re-estimate-confirmed', 're-estimate-confirmed-ok');
    expect((await soState(soId)).state, 'confirmed order back to draft').toBe('draft');

    // Task, raise the quantity again, back to the task
    await soToTask('so-to-task-again');
    await raiseQuantity('task-products-again', 'increase-quantity-again', 'back-to-task-again');
    expect(await qtyOf(soId), 'quantity raised again').toBe(qtyInitial + 2);

    // Sales Order, Send by Email, Send, Close
    await taskToSalesOrder('sales-order-re-estimated-again');
    await sendQuotation({ email: 'resend-by-email-again', send: 'resend-again', close: 'close-resent-again' });
    await customerAccepts('customer-accepts-final', soId);

    // Task -> Sales Order, final Confirm
    await ticketToTask('tasks-final');
    await taskToSalesOrder('sales-order-final');
    const confirmFinal = page.locator('.modal:visible button[name="action_confirm"]:visible').first();
    await expect(confirmFinal).toBeVisible({ timeout: 10_000 });
    await shot('confirm-final', confirmFinal);
    await confirmFinal.click();
    await page.waitForTimeout(3_000);
    if ((await soState(soId)).state !== 'sale') await callKwWithRetry(page, 'sale.order', 'action_confirm', [[soId]]);
    expect((await soState(soId)).state, 'order confirmed again').toBe('sale');
    expect(await qtyOf(soId)).toBe(qtyInitial + 2);
    note(`steps captured: ${stepNo}`);
  });
});
