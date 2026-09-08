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

    // Verify-and-retry: filling immediately after a fresh blank form finishes rendering
    // can race with OWL still settling the just-mounted field, silently discarding the
    // fill (observed: a product form's Name field left showing its placeholder text
    // despite fill() having resolved without error). One retry is enough in practice.
    for (let attempt = 1; attempt <= 2; attempt++) {
      await input.fill(value);
      const actual = await input.inputValue().catch(() => '');
      if (actual === value) return;
      if (attempt < 2) await this.page.waitForTimeout(500);
    }
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
