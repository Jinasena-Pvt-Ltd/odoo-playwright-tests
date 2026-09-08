import { Page } from '@playwright/test';

export class CharField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async setValue(value: string): Promise<void> {
    // Most char fields render an <input>, but Odoo's translatable/multi-line text
    // widget (e.g. product.template's `name`) renders a <textarea> instead — support both.
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input, .o_field_widget[name="${this.fieldName}"] textarea`).first();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.fill(value);
  }

  async getValue(): Promise<string> {
    // In edit mode: return input/textarea value; in read mode: return span text
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input, .o_field_widget[name="${this.fieldName}"] textarea`).first();
    if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
      return input.inputValue();
    }
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    return (await widget.textContent())?.trim() ?? '';
  }

  async clear(): Promise<void> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input, .o_field_widget[name="${this.fieldName}"] textarea`).first();
    await input.fill('');
  }
}
