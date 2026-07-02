import { Page } from '@playwright/test';

export class DateField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  /** Sets the field value. Accepts ISO date string (YYYY-MM-DD) or display format (MM/DD/YYYY) */
  async setValue(date: string): Promise<void> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input`).first();
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill('');
    await input.type(this.toDisplayFormat(date));
    // Close the datepicker by pressing Escape or Tab
    await this.page.keyboard.press('Escape');
  }

  async getValue(): Promise<string> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input`).first();
    if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
      return input.inputValue();
    }
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    return (await widget.textContent())?.trim() ?? '';
  }

  async clear(): Promise<void> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input`).first();
    await input.fill('');
    await this.page.keyboard.press('Escape');
  }

  /** Converts ISO date (YYYY-MM-DD) to Odoo's display format (MM/DD/YYYY) */
  private toDisplayFormat(date: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [year, month, day] = date.split('-');
      return `${month}/${day}/${year}`;
    }
    return date; // Already in display format or other
  }
}
