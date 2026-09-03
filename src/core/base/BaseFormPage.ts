import { Page, expect, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export abstract class BaseFormPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ── Form actions ─────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    const saveBtn = this.page.locator('.o_form_button_save, button[name="save_manually"]').first();
    await saveBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await saveBtn.click();
    // Wait until the form leaves edit mode (save button disappears). This instance can
    // occasionally take well over 10s to settle under load.
    await expect(saveBtn).toBeHidden({ timeout: 20_000 });
    await this.waitForOdooReady();
  }

  async discard(): Promise<void> {
    const discardBtn = this.page.locator('.o_form_button_cancel').first();
    await discardBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await discardBtn.click();
    // Handle "Discard changes?" confirmation if it appears
    const confirmBtn = this.page.locator('.modal .btn-primary').first();
    const hasConfirm = await confirmBtn.isVisible({ timeout: 1_500 }).catch(() => false);
    if (hasConfirm) {
      await confirmBtn.click();
      await this.page.waitForSelector('.modal', { state: 'hidden', timeout: 5_000 });
    }
    await this.waitForOdooReady();
  }

  /** Clicks a status bar action button (e.g. "Confirm", "Approve", "Refuse") */
  async clickStatusButton(label: string): Promise<void> {
    const btn = this.page
      .locator('.o_statusbar_buttons button, .o_statusbar_buttons .btn')
      .filter({ hasText: label })
      .first();
    await btn.waitFor({ state: 'visible', timeout: 8_000 });
    await btn.click();
    await this.waitForOdooReady();
  }

  /** Returns the currently highlighted status in the status bar */
  async getCurrentStatus(): Promise<string> {
    const active = this.page.locator('.o_statusbar_status .o_arrow_button.btn-primary, .o_statusbar_status li.o_arrow_button_current span');
    await active.waitFor({ state: 'visible', timeout: 5_000 });
    return (await active.textContent())?.trim() ?? '';
  }

  async waitForStatus(status: string): Promise<void> {
    const selector = `.o_statusbar_status .o_arrow_button.btn-primary:has-text("${status}"), .o_statusbar_status li.o_arrow_button_current span:has-text("${status}")`;
    await this.page.waitForSelector(selector, { timeout: 15_000 });
  }

  // ── Field access ─────────────────────────────────────────────────────────────

  /** Returns the display value of any field by its name attribute */
  async getFieldValue(fieldName: string): Promise<string> {
    const widget = this.page.locator(`.o_field_widget[name="${fieldName}"]`);
    await widget.waitFor({ state: 'visible', timeout: 5_000 });

    // Try input first, then span/div display
    const input = widget.locator('input').first();
    if (await input.isVisible({ timeout: 500 }).catch(() => false)) {
      return (await input.inputValue()) ?? '';
    }
    return (await widget.textContent())?.trim() ?? '';
  }

  /** Returns the error message shown for a field */
  async getFieldError(fieldName: string): Promise<string> {
    // --- Signal 1: field has .o_field_invalid class (standard Odoo validation) ---
    const invalidWidget = this.page.locator(`.o_field_widget[name="${fieldName}"].o_field_invalid`);
    if (await invalidWidget.isVisible({ timeout: 1_500 }).catch(() => false)) {
      // Hover to trigger the validation tooltip/popover
      await invalidWidget.hover().catch(() => {});
      const tooltip = this.page.locator(
        '.o-tooltip--validation-error, .o_tooltip_info, .tooltip .tooltip-inner',
      ).first();
      if (await tooltip.isVisible({ timeout: 1_000 }).catch(() => false)) {
        const text = (await tooltip.textContent())?.trim() ?? '';
        if (text) return text;
      }
      return 'This field is required';
    }

    // --- Signal 2: inline error messages used by some field types ---
    const inlineError = this.page.locator(
      `.o_field_widget[name="${fieldName}"] ~ .o_field_invalid_tooltip,
       [name="${fieldName}"] .o_error_message,
       .o_form_view .invalid-feedback[data-field="${fieldName}"]`,
    ).first();
    if (await inlineError.isVisible({ timeout: 500 }).catch(() => false)) {
      return (await inlineError.textContent())?.trim() ?? '';
    }

    // --- Signal 3: Odoo 17 SaaS re-opens the required Many2One dropdown on failed save
    // instead of adding .o_field_invalid. The combobox becomes aria-expanded="true"
    // (confirmed from DOM snapshot after a save attempt with empty required Many2One).
    const expandedCombo = this.page.locator(
      `.o_field_widget[name="${fieldName}"] [aria-expanded="true"]`,
    ).first();
    if (await expandedCombo.isVisible({ timeout: 500 }).catch(() => false)) {
      return 'This field is required';
    }

    // --- Signal 4: notification toast (Odoo 17 may show "Invalid fields: ..." as a toast) ---
    const notification = this.page.locator(
      '.o_notification_manager .o_notification',
    ).first();
    if (await notification.isVisible({ timeout: 1_000 }).catch(() => false)) {
      const notifText = (await notification.textContent())?.trim() ?? '';
      if (notifText.length > 0) return notifText;
    }

    return '';
  }

  /** Returns all field-level error messages currently visible on the form */
  async getAllFieldErrors(): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};
    const invalidFields = await this.page.locator('.o_field_widget.o_field_invalid').all();
    for (const field of invalidFields) {
      const name = await field.getAttribute('name') ?? 'unknown';
      const msg = await field.locator('.o_tooltip_info, .o_error_message').textContent().catch(() => '');
      errors[name] = msg?.trim() ?? '';
    }
    return errors;
  }

  // ── Chatter ───────────────────────────────────────────────────────────────────

  async sendChatterMessage(message: string): Promise<void> {
    const sendBtn = this.page.locator('.o_chatter .o_send_message_btn, .o_chatter button[data-action="toggle_send_message"]');
    await sendBtn.click();
    const textarea = this.page.locator('.o_chatter .o_mail_composer textarea, .o_chatter .o_composer_text_field').first();
    await textarea.fill(message);
    await this.page.locator('.o_chatter .o_mail_send_button').click();
    await this.waitForOdooReady();
  }

  async logNote(note: string): Promise<void> {
    const logBtn = this.page.locator('.o_chatter .o_log_note_btn, .o_chatter button[data-action="toggle_log_note"]');
    await logBtn.click();
    const textarea = this.page.locator('.o_chatter .o_mail_composer textarea, .o_chatter .o_composer_text_field').first();
    await textarea.fill(note);
    await this.page.locator('.o_chatter .o_mail_send_button').click();
    await this.waitForOdooReady();
  }

  async getChatterMessageCount(): Promise<number> {
    const messages = this.page.locator('.o_chatter .o_message');
    return messages.count();
  }

  // ── Action menu (cog) ─────────────────────────────────────────────────────────

  async clickActionMenuItem(label: string): Promise<void> {
    const cog = this.page.locator('.o_cp_action_menus button, .o_form_status_bar .o_status_bar_additional_actions button').first();
    await cog.click();
    await this.page.locator('.dropdown-item, .o_menu_item').filter({ hasText: label }).first().click();
    await this.waitForOdooReady();
  }

  /** Archive the current record via the Action menu */
  async archiveRecord(): Promise<void> {
    await this.clickActionMenuItem('Archive');
    await this.confirmDialog();
  }

  /** Duplicates the current record via the Action menu */
  async duplicateRecord(): Promise<void> {
    await this.clickActionMenuItem('Duplicate');
    await this.waitForOdooReady();
  }

  // ── Smart buttons ─────────────────────────────────────────────────────────────

  /** Returns the numeric count shown on a stat/smart button matching `label`. */
  async getSmartButtonCount(label: string): Promise<number> {
    // Odoo 17 SaaS renders stat buttons as plain <button> elements inside .o_button_box.
    // The classic .o_stat_button / .oe_stat_button classes are kept as fallbacks.
    const btn = this.page
      .locator('.o_button_box button, .o_stat_button, .oe_stat_button')
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    const badge = btn.locator('.o_stat_value, .o_field_integer, .o_button_icon + span').first();
    const text = (await badge.textContent())?.trim() ?? '0';
    return parseInt(text.replace(/[^0-9]/g, '') || '0', 10);
  }

  /** Clicks a stat/smart button matching `label`. */
  async clickSmartButton(label: string): Promise<void> {
    const btn = this.page
      .locator('.o_button_box button, .o_stat_button, .oe_stat_button')
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
    await btn.waitFor({ state: 'visible', timeout: 10_000 });
    await btn.click();
    await this.waitForOdooReady();
  }

  // ── New record ────────────────────────────────────────────────────────────────

  async clickNew(): Promise<void> {
    // Use a role-based selector that works in both list context (control-panel New button)
    // and form context (breadcrumb New button when a smart button opens directly into a form).
    // Matches the same pattern already used in BaseListPage.clickNew().
    await this.page.getByRole('button', { name: /^New$/ }).first().click();
    await this.waitForOdooReady();
  }

  // ── Breadcrumb ────────────────────────────────────────────────────────────────

  async navigateBack(levels = 1): Promise<void> {
    for (let i = 0; i < levels; i++) {
      const back = this.page.locator('.o_breadcrumb .o_back_button, .breadcrumb-item:nth-last-child(2)').first();
      await back.click();
      await this.waitForOdooReady();
    }
  }

  // ── Generic field locator ─────────────────────────────────────────────────────

  fieldWidget(fieldName: string): Locator {
    return this.page.locator(`.o_field_widget[name="${fieldName}"]`);
  }
}
