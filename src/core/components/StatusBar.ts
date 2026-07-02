import { Page, expect } from '@playwright/test';

export class StatusBar {
  constructor(private readonly page: Page) {}

  /** Clicks a status bar action button by its visible label */
  async clickButton(label: string): Promise<void> {
    const btn = this.page
      .locator('.o_statusbar_buttons button, .o_statusbar_buttons .btn')
      .filter({ hasText: label })
      .first();
    await btn.waitFor({ state: 'visible', timeout: 8_000 });
    await btn.click();
  }

  /** Returns the label of the currently active/highlighted state */
  async getActiveState(): Promise<string> {
    // Odoo 17 highlights the active state with btn-primary class or aria-current
    const active = this.page.locator(
      '.o_statusbar_status .o_arrow_button.btn-primary span, ' +
      '.o_statusbar_status .o_statusbar_button.active span, ' +
      '.o_statusbar_status li[aria-current="step"] span'
    ).first();
    await active.waitFor({ state: 'visible', timeout: 5_000 });
    return (await active.textContent())?.trim() ?? '';
  }

  /** Waits until the status bar shows the expected state */
  async waitForState(state: string, timeout = 15_000): Promise<void> {
    await expect(
      this.page.locator('.o_statusbar_status').filter({ hasText: state })
    ).toBeVisible({ timeout });
  }

  /** Checks whether an action button with the given label is visible */
  async isButtonVisible(label: string): Promise<boolean> {
    return this.page
      .locator('.o_statusbar_buttons button, .o_statusbar_buttons .btn')
      .filter({ hasText: label })
      .first()
      .isVisible({ timeout: 1_000 })
      .catch(() => false);
  }
}
