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

  /**
   * Opens the combined Filters/Group By/Favorites panel. Confirmed live via DOM inspection:
   * the searchview's `[role="search"]` landmark ("search role count: 3" in a live probe)
   * is NOT the single button this method previously assumed — `getByRole('search').first()`
   * actually resolved to `.o_cp_searchview` (the outer wrapper), and its first button is the
   * currently-applied filter's own facet chip label, not the dropdown toggle. Clicking it
   * silently edited/reopened that chip instead of opening the panel, so a filter/group label
   * that didn't exist yet would hang for the full test timeout waiting on a menu that was
   * never opened. The actual toggle is the `.o_searchview_dropdown_toggler` button — a
   * sibling of the facet chip, not a descendant of the inner `.o_searchview` search box.
   */
  private async openSearchPanel(): Promise<void> {
    await this.page.locator('.o_searchview_dropdown_toggler').first().click();
    await this.page.locator('.o_search_bar_menu, .dropdown-menu.show').first()
      .waitFor({ state: 'visible', timeout: 5_000 });
  }

  async applyFilter(filterLabel: string): Promise<void> {
    await this.openSearchPanel();
    // Use exact matching: the Odoo top navbar also has .o_menu_item elements (e.g. "Departments").
    // Partial hasText would match "Departments" when looking for "Archived" filter — exact avoids this.
    const exact = new RegExp(`^\\s*${filterLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    // Bounded wait before click: previously, a label that doesn't exist in this action's
    // search panel (e.g. no "Archived" filter configured) silently hung for the entire test
    // timeout instead of failing with a clear, actionable error.
    const item = this.page.locator('.o_menu_item, .dropdown-item').filter({ hasText: exact }).first();
    await item.waitFor({ state: 'visible', timeout: 5_000 });
    await item.click();
    await this.waitForOdooReady();
  }

  /** Same as applyFilter/groupBy's target lookup, but reports availability instead of throwing. */
  async isFilterOrGroupAvailable(label: string): Promise<boolean> {
    await this.openSearchPanel();
    const exact = new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const available = await this.page.locator('.o_menu_item, .dropdown-item').filter({ hasText: exact })
      .first().isVisible({ timeout: 3_000 }).catch(() => false);
    await this.page.keyboard.press('Escape').catch(() => {});
    return available;
  }

  async groupBy(groupLabel: string): Promise<void> {
    await this.openSearchPanel();
    // Exact match prevents "Department" from matching the navbar "Departments" menu item.
    const exact = new RegExp(`^\\s*${groupLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const item = this.page.locator('.o_menu_item, .dropdown-item').filter({ hasText: exact }).first();
    await item.waitFor({ state: 'visible', timeout: 5_000 });
    await item.click();
    // Odoo keeps the search panel open after selecting a Group By item (so users can add more).
    // The open panel overlays the list view and intercepts pointer events on group headers.
    // Press Escape to dismiss it before continuing.
    await this.page.keyboard.press('Escape').catch(() => {});
    await this.page.waitForSelector('.o_search_bar_menu', { state: 'hidden', timeout: 3_000 }).catch(() => {});
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
    // Both `.o_pager_counter` and `.o_pager_value` match live on this instance (nested,
    // not alternatives) — confirmed via a strict-mode violation error naming both.
    // `.first()` picks whichever renders first in DOM order; either contains the same
    // "1-80 / N" text this method parses.
    const pager = this.page.locator('.o_pager .o_pager_counter, .o_pager_value').first();
    const text = (await pager.textContent()) ?? '';
    const match = text.match(/\/\s*(\d+)/) ?? text.match(/of\s+(\d+)/);
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
