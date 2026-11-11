/**
 * Step 2 - Business Logic for the plm module.
 *
 * Covers the "PLM_1 - How to Create BOM Revisions" Odoo Tour export: PLM app ->
 * Engineering Changes -> New ECO -> name + product -> Start Revision -> open the
 * new (archived) BOM copy -> change a component quantity and add a component ->
 * back to the ECO -> BoM Changes -> Validated -> Approve -> Apply Changes ->
 * check the new BOM version is the active one.
 *
 * Instead of revising the real JMC10D product the spec builds a throw-away
 * "[TEST]" product with a small BOM through RPC (set-up only) and revises that.
 * The documented steps themselves are all driven through the UI.
 *
 * See notes/plm.how-to-create-bom-revisions.guide.md (and the matching
 * PLM_1_How-to-create-bom-revisions.guide.html manual).
 *
 * Every guide screenshot is captured BEFORE the step's action, with the
 * element about to be used framed in red (see `shot` below).
 */
import { Page, Locator } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { PLM_TEST_CONFIG } from '../../data/plm.master-data';

async function callKw(page: Page, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ model, method, args, kwargs }) => {
      const res = await fetch('/web/dataset/call_kw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { model, method, args, kwargs } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.data?.message ?? data.error.message ?? 'RPC error');
      return data.result;
    },
    { model, method, args, kwargs },
  );
}

test.describe('PLM - How to Create BOM Revisions @module:plm @step:business', () => {

  test('a BOM revision is created through an ECO, validated, approved and applied @smoke @e2e', async ({ page }, testInfo) => {
    test.setTimeout(300_000);

    const note = (description: string) => test.info().annotations.push({ type: 'note', description });

    // Screenshot of the state BEFORE the step's action, target framed in red.
    // shot('slug') -> NN-slug.png ; shot('+b-slug') -> NNb-slug.png (extra image).
    let stepNo = 0;
    const appears = (loc: Locator, ms: number) => loc.waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false);
    const shot = async (slug: string, target?: Locator) => {
      let name: string;
      if (slug.startsWith('+')) {
        name = `${String(stepNo).padStart(2, '0')}${slug.slice(1)}.png`;
      } else {
        stepNo += 1;
        name = `${String(stepNo).padStart(2, '0')}-${slug}.png`;
      }
      await page.waitForTimeout(1_000);
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

    const field = (name: string) => page.locator(`.o_form_view .o_field_widget[name="${name}"]`);
    const tab = (name: string) => page.locator(`a[name="${name}"]:visible`).first();
    const pickOption = async (text: string) => {
      const options = page.locator('.o-autocomplete--dropdown-item, .ui-menu-item');
      const matching = options.filter({ hasText: text });
      await matching.first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
      await ((await matching.count()) > 0 ? matching.first() : options.first()).click();
      await page.waitForTimeout(500);
    };
    const settle = async () => {
      await page.waitForLoadState('load').catch(() => undefined);
      await page.waitForTimeout(1_200);
    };

    // ---------- Set-up through RPC: a [TEST] product with a small BOM ----------
    await page.goto('/web');
    await page.waitForTimeout(3_000);
    const productName = uniqueName('M-JMC10D BOM revision');
    const ecoName = uniqueName('M-JMC10D-V1.0');
    const comps: { id: number }[] = await callKw(page, 'product.product', 'search_read', [[['default_code', 'in', ['04WE 004', '08BV 052']]], ['id']], { limit: 2 });
    expect(comps.length, 'two existing components found').toBe(2);
    const tmplId: number = await callKw(page, 'product.template', 'create', [{ name: productName, default_code: 'TEST-JMC10D', detailed_type: 'product', x_studio_item_approved: true, barcode: `TST${Date.now()}` }]);
    const bomId: number = await callKw(page, 'mrp.bom', 'create', [{
      product_tmpl_id: tmplId,
      product_qty: 1,
      bom_line_ids: [
        [0, 0, { product_id: comps[0].id, product_qty: PLM_TEST_CONFIG.oldQty }],
        [0, 0, { product_id: comps[1].id, product_qty: 2 }],
      ],
    }]);
    note(`set-up: product template ${tmplId}, BOM ${bomId}`);
    let ecoId = 0;

    try {
      // ---------- Section A - Create the ECO ----------
      // 1. PLM app
      const plmIcon = page.locator('[data-menu-xmlid="mrp_plm.menu_mrp_plm_root"]');
      if (!(await appears(plmIcon, 4_000))) await page.locator('a.o_menu_toggle').click();
      await plmIcon.waitFor({ state: 'visible', timeout: 15_000 });
      await plmIcon.scrollIntoViewIfNeeded();
      await shot('plm-app', plmIcon);
      await plmIcon.click();
      await settle();

      // 2. Engineering Changes
      const ecButton = page.locator('.o_kanban_view button:visible', { hasText: /Engineering Changes/ }).first();
      await expect(ecButton).toBeVisible({ timeout: 15_000 });
      await shot('engineering-changes', ecButton);
      await ecButton.click();
      await settle();

      // 3. New
      const newBtn = page.locator('.o_control_panel button.btn-primary:visible', { hasText: /^\s*New\s*$/ }).first();
      await shot('new-eco', newBtn);
      await newBtn.click();
      await expect(field('name')).toBeVisible({ timeout: 15_000 });

      // ---------- Section B - Describe the ECO and start the revision ----------
      // 4. ECO name (standard: M-<product code>-V<version>)
      await shot('eco-name', field('name'));
      await field('name').locator('input').fill(ecoName);

      // 5. Product
      await shot('product', field('product_tmpl_id'));
      const prodInput = field('product_tmpl_id').locator('input').first();
      await prodInput.fill('TEST-JMC10D');
      await pickOption(productName);
      await page.waitForTimeout(1_000);
      await expect(prodInput).toHaveValue(/BOM revision/, { timeout: 8_000 });

      await page.waitForTimeout(2_000);
      const bomInput = field('bom_id').locator('input').first();
      if (!(await bomInput.inputValue().catch(() => ''))) {
        note('Bill of Materials not auto-filled after choosing the product; picking it manually');
        await bomInput.click();
        await pickOption(productName);
        await page.waitForTimeout(1_000);
      }

      // 6. Start Revision
      const startRev = page.locator('button[name="action_new_revision"]:visible');
      await expect(startRev).toBeVisible({ timeout: 10_000 });
      await shot('start-revision', startRev);
      await startRev.click();
      await settle();

      // 7. Open the new BOM (V2)
      const openBom = page.locator('button[name="open_new_bom"]:visible');
      await expect(openBom).toBeVisible({ timeout: 15_000 });
      await shot('open-new-bom', openBom);
      const ecoRead = await callKw(page, 'mrp.eco', 'search_read', [[['product_tmpl_id', '=', tmplId]], ['id', 'new_bom_id']]);
      ecoId = ecoRead[0].id;
      note(`ECO ${ecoId}, new BOM ${JSON.stringify(ecoRead[0].new_bom_id)}`);
      await openBom.click();
      await settle();

      // ---------- Section C - Edit the BOM copy ----------
      // 8. Miscellaneous tab (shows the copy is archived)
      const misc = tab('miscellaneous');
      await expect(misc).toBeVisible({ timeout: 15_000 });
      await shot('miscellaneous', misc);
      await misc.click();
      await page.waitForTimeout(800);
      await shot('+b-archived');

      // 9. Components tab
      const comp = tab('components');
      await shot('components', comp);
      await comp.click();
      await page.waitForTimeout(800);

      // 10. Quantity of the first line
      const firstQty = page.locator('.o_field_one2many tr.o_data_row').first().locator('td[name="product_qty"]');
      await expect(firstQty).toBeVisible({ timeout: 10_000 });
      await shot('qty-cell', firstQty);
      await firstQty.click();
      const qtyInput = page.locator('.o_field_one2many tr.o_selected_row td[name="product_qty"] input').first();
      await qtyInput.waitFor({ state: 'visible', timeout: 8_000 });
      await qtyInput.fill(String(PLM_TEST_CONFIG.newQty));
      await qtyInput.press('Enter');
      await page.waitForTimeout(800);

      // 11. Add a line
      const addLine = page.locator('.o_field_one2many td.o_field_x2many_list_row_add a:visible').first();
      await shot('add-a-line', addLine);
      await addLine.click();
      const compInput = page.locator('.o_field_one2many tr.o_selected_row td[name="product_id"] input').first();
      await compInput.waitFor({ state: 'visible', timeout: 8_000 });

      // 12. Component code
      await shot('component-code', compInput);
      await compInput.fill(PLM_TEST_CONFIG.addedComponentCode);
      await pickOption(PLM_TEST_CONFIG.addedComponentCode);
      await page.waitForTimeout(800);
      await shot('+b-component-added');

      // 13. Back to the ECO (breadcrumb; saves the BOM)
      const back = page.locator('.o_breadcrumb .breadcrumb-item:not(.active) a').last();
      await shot('back-to-eco', back);
      await back.click();
      await settle();
      await expect(tab('bom_changes')).toBeVisible({ timeout: 15_000 });

      // ---------- Section D - Validate, approve and apply ----------
      // 14. BoM Changes tab
      const changes = tab('bom_changes');
      await shot('bom-changes', changes);
      await changes.click();
      await page.waitForTimeout(1_000);
      await shot('+b-changes-list');

      // 15. Stage -> Validated (status bar)
      const validated = page.locator('.o_statusbar_status button:visible', { hasText: 'Validated' }).first();
      await shot('validated', validated);
      await validated.click();
      await settle();

      // 16. Approve
      const approve = page.locator('button[name="approve"]:visible');
      await expect(approve).toBeVisible({ timeout: 15_000 });
      await shot('approve', approve);
      await approve.click();
      await settle();

      // 17. Approvals tab
      const approvals = tab('approvals');
      await shot('approvals', approvals);
      await approvals.click();
      await page.waitForTimeout(1_000);
      await shot('+b-approval-details');

      // 18. Apply Changes
      const apply = page.locator('button[name="action_apply"]:visible');
      await expect(apply).toBeVisible({ timeout: 15_000 });
      await shot('apply-changes', apply);
      await apply.click();
      await settle();

      // ---------- Section E - Check the new version ----------
      const bomsAfter = await callKw(page, 'mrp.bom', 'search_read', [[['product_tmpl_id', '=', tmplId]], ['version', 'active']], { context: { active_test: false } });
      note(`BOMs after apply: ${JSON.stringify(bomsAfter)}`);
      const active = bomsAfter.filter((b: { active: boolean }) => b.active);
      expect(active.length, 'exactly one active BOM').toBe(1);
      expect(active[0].version, 'active BOM is the new version').toBe(2);

      // 19. Product link on the ECO
      const prodLink = page.locator('.o_form_view a.o_form_uri:visible', { hasText: 'BOM revision' }).first();
      await expect(prodLink).toBeVisible({ timeout: 15_000 });
      await shot('product-link', prodLink);
      await prodLink.click();
      await settle();

      // 20. More
      const more = page.locator('button.o_button_more:visible').first();
      await shot('more', more);
      await more.click();
      await page.waitForTimeout(600);

      // 21. Bill of Materials
      const bomStat = page.locator('.o-dropdown--menu button:visible, button.oe_stat_button:visible', { hasText: /Bill of Materials/ }).first();
      await shot('bill-of-materials', bomStat);
      await bomStat.click();
      await settle();

      // The BOM opens directly when the product has a single active BOM; with several
      // (e.g. the real JMC10D) a list appears first and the row is clicked.
      const bomRow = page.locator('tr.o_data_row td[name="product_tmpl_id"]').first();
      if (await appears(bomRow, 4_000)) {
        note('BOM list shown; opening the row');
        await bomRow.click();
      }
      await settle();

      // 22. Miscellaneous: new version
      const misc2 = tab('miscellaneous');
      await expect(misc2).toBeVisible({ timeout: 15_000 });
      await shot('check-version', misc2);
      await misc2.click();
      await page.waitForTimeout(800);
      await shot('+b-version');
    } catch (err) {
      await page.screenshot({ path: testInfo.outputPath('failure-state.png'), fullPage: true }).catch(() => undefined);
      throw err;
    } finally {
      // Clean-up: only [TEST] records exist; archive them (applied ECOs cannot be deleted).
      await page.goto('/web').catch(() => undefined);
      const bomIds: number[] = await callKw(page, 'mrp.bom', 'search', [[['product_tmpl_id', '=', tmplId]]], { context: { active_test: false } }).catch(() => []);
      await callKw(page, 'mrp.bom', 'write', [bomIds, { active: false }]).catch((e) => note(`bom cleanup: ${(e as Error).message}`));
      if (ecoId) await callKw(page, 'mrp.eco', 'unlink', [[ecoId]]).catch((e) => note(`eco cleanup: ${(e as Error).message}`));
      await callKw(page, 'product.template', 'write', [[tmplId], { active: false }]).catch((e) => note(`product cleanup: ${(e as Error).message}`));
    }
  });
});
