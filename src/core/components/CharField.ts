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
    // Brief settle before the first fill — a freshly-mounted field (esp. the
    // auto-resizing <textarea> widget) can still be initializing for a moment after
    // becoming "visible", silently discarding an immediate fill.
    await this.page.waitForTimeout(300);

    // Verify-and-retry: filling immediately after a fresh blank form finishes rendering
    // can race with OWL still settling the just-mounted field, silently discarding the
    // fill (observed repeatedly: a product form's Name field left showing its
    // placeholder text despite fill() having resolved without error).
    for (let attempt = 1; attempt <= 4; attempt++) {
      if (attempt <= 2) {
        await input.fill(value);
      } else {
        // Fallback strategy: real keystrokes trigger OWL's reactive input handlers
        // more reliably than a raw fill() for some custom widgets (e.g. the
        // auto-resizing translatable-text textarea) — clear first, then type.
        await input.click();
        await input.selectText().catch(() => {});
        await input.press('Delete').catch(() => {});
        await input.pressSequentially(value, { delay: 30 });
      }
      const actual = await input.inputValue().catch(() => '');
      if (actual === value) return;
      if (attempt < 4) await this.page.waitForTimeout(700);
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
