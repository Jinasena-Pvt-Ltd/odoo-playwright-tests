import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export abstract class BaseListPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Search ────────────────────────────────────────────────────────────────────

  async searchFor(query: string): Promise<void> {
    const input = this.page.locator('.o_searchview input, .o_searchview .o_searchview_input').first();
    await input.click();
    // pressSequentially fires per-keystroke events, reliably triggering Odoo's search
    // state even when the search component has just been mounted after a view switch.
    await input.pressSequentially(query, { delay: 30 });
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Enter');
    await this.waitForOdooReady();
  }

  async clearSearch(): Promise<void> {
    const clear = this.page.locator('.o_searchview .o_facet_remove, .o_searchview .o_delete');
    const count = await clear.count();
    for (let i = 0; i < count; i++) {
      await clear.first().click();
    }
    await this.waitForOdooReady();
  }

  async applyFilter(filterLabel: string): Promise<void> {
    // Odoo 17 SaaS (Jinasena): the searchview has a SINGLE nameless icon-only toggle
    // button inside the outer [role="search"] container (button[ref=e67] in the snapshot).
    // The element's role is set via attribute — CSS "search > button" won't match it.
    // Use getByRole: outer search (first) → its only button → click.
    await this.page.getByRole('search').first().getByRole('button').first().click();
    // Wait for the panel to render before searching for items.
    await this.page.waitForTimeout(400);
    // Use exact matching: the Odoo top navbar also has .o_menu_item elements (e.g. "Departments").
    // Partial hasText would match "Departments" when looking for "Archived" filter — exact avoids this.
    const exact = new RegExp(`^\\s*${filterLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    await this.page.locator('.o_menu_item, .dropdown-item').filter({ hasText: exact }).first().click();
    await this.waitForOdooReady();
  }

  async groupBy(groupLabel: string): Promise<void> {
    // Same single toggle button opens the combined Filters + Group By panel.
    await this.page.getByRole('search').first().getByRole('button').first().click();
    await this.page.waitForTimeout(400);
    // Exact match prevents "Department" from matching the navbar "Departments" menu item.
    const exact = new RegExp(`^\\s*${groupLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    await this.page.locator('.o_menu_item, .dropdown-item').filter({ hasText: exact }).first().click();
    // Odoo keeps the search panel open after selecting a Group By item (so users can add more).
    // The open panel overlays the list view and intercepts pointer events on group headers.
    // Press Escape to dismiss it before continuing.
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForSelector('[role="menu"].o_search_bar_menu', { state: 'hidden', timeout: 3_000 }).catch(() => {});
    await this.waitForOdooReady();
  }

  // ── Record selection ──────────────────────────────────────────────────────────

  async selectRecord(rowIndex = 0): Promise<void> {
    const checkboxes = this.page.locator('.o_list_table .o_list_record_selector input[type="checkbox"]');
    await checkboxes.nth(rowIndex).check();
  }

  async selectAll(): Promise<void> {
    const masterCheckbox = this.page.locator('.o_list_table thead .o_list_record_selector input[type="checkbox"]');
    await masterCheckbox.check();
  }

  async getRowCount(): Promise<number> {
    return this.page.locator('.o_list_table .o_data_row').count();
  }

  async clickRowByText(text: string): Promise<void> {
    const row = this.page.locator('.o_list_table .o_data_row').filter({ hasText: text }).first();
    await row.click();
    await this.waitForOdooReady();
  }

  async getColumnValue(rowIndex: number, fieldName: string): Promise<string> {
    const cell = this.page.locator(`.o_list_table .o_data_row:nth-child(${rowIndex + 1}) .o_field_widget[name="${fieldName}"]`);
    return (await cell.textContent())?.trim() ?? '';
  }

  // ── New record button ─────────────────────────────────────────────────────────

  async clickNew(): Promise<void> {
    await this.page.getByRole('button', { name: 'New' }).first().click();
    await this.waitForOdooReady();
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  async getTotalRecordCount(): Promise<number> {
    const pager = this.page.locator('.o_pager .o_pager_counter, .o_pager_value');
    const text = (await pager.textContent()) ?? '';
    const match = text.match(/of\s+(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // ── Action menu (on selected records) ────────────────────────────────────────

  async applyActionOnSelected(action: string): Promise<void> {
    const actionMenu = this.page.locator('.o_control_panel .o_cp_action_menus button, .o_cp_action_menus .o_dropdown_button');
    await actionMenu.first().click();
    await this.page.locator('.dropdown-item').filter({ hasText: action }).first().click();
    await this.waitForOdooReady();
  }

  // ── Assertions ────────────────────────────────────────────────────────────────

  async expectRecordExists(text: string): Promise<void> {
    await expect(
      this.page.locator('.o_list_table .o_data_row').filter({ hasText: text }).first()
    ).toBeVisible();
  }

  async expectNoRecords(): Promise<void> {
    await expect(this.page.locator('.o_nocontent_help, .o_view_nocontent').first()).toBeVisible();
  }
}
