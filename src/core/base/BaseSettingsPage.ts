import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export abstract class BaseSettingsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Navigate to the module's settings section ─────────────────────────────────

  abstract navigateToSettings(): Promise<void>;

  // ── Boolean toggle helpers ────────────────────────────────────────────────────

  /** Returns whether a setting checkbox is currently checked */
  async isEnabled(fieldName: string): Promise<boolean> {
    const checkbox = this.page.locator(
      `[name="${fieldName}"] input[type="checkbox"], input[id="${fieldName}"]`
    ).first();
    await checkbox.waitFor({ state: 'visible', timeout: 5_000 });
    return checkbox.isChecked();
  }

  /** Enables a setting if not already enabled */
  async enable(fieldName: string): Promise<void> {
    const checkbox = this.page.locator(
      `[name="${fieldName}"] input[type="checkbox"], input[id="${fieldName}"]`
    ).first();
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
  }

  /** Disables a setting if not already disabled */
  async disable(fieldName: string): Promise<void> {
    const checkbox = this.page.locator(
      `[name="${fieldName}"] input[type="checkbox"], input[id="${fieldName}"]`
    ).first();
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  /** Saves the settings form */
  async saveSettings(): Promise<void> {
    await this.page.locator('.o_settings_container .o_field_boolean button[name="execute"], #o_settings_save_button, button[data-name="execute"]').first().click();
    await this.waitForOdooReady();
    // Odoo shows "Settings saved" notification
    await this.expectSuccessToast().catch(() => {
      // Some Odoo versions auto-save without a toast
    });
  }

  /** Resets settings to default (if the discard button is available) */
  async discardSettings(): Promise<void> {
    const discardBtn = this.page.locator('.o_settings_container .o_discard_button, button[class*="o_settings_discard"]');
    if (await discardBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await discardBtn.click();
      await this.waitForOdooReady();
    }
  }

  // ── Selection field in settings ───────────────────────────────────────────────

  async selectOption(fieldName: string, value: string): Promise<void> {
    const select = this.page.locator(`[name="${fieldName}"] select`).first();
    await select.selectOption({ label: value });
  }

  async getSelectedOption(fieldName: string): Promise<string> {
    const select = this.page.locator(`[name="${fieldName}"] select`).first();
    return select.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]?.text ?? '');
  }

  // ── Assert setting state ──────────────────────────────────────────────────────

  async expectEnabled(fieldName: string): Promise<void> {
    const checkbox = this.page.locator(
      `[name="${fieldName}"] input[type="checkbox"], input[id="${fieldName}"]`
    ).first();
    await expect(checkbox).toBeChecked();
  }

  async expectDisabled(fieldName: string): Promise<void> {
    const checkbox = this.page.locator(
      `[name="${fieldName}"] input[type="checkbox"], input[id="${fieldName}"]`
    ).first();
    await expect(checkbox).not.toBeChecked();
  }
}
