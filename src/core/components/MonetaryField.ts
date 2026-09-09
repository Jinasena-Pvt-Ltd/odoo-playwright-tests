import { Page } from '@playwright/test';

export class MonetaryField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async setValue(amount: number): Promise<void> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input`).first();
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill(amount.toString());
  }

  async getValue(): Promise<number> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input`).first();
    if (await input.isVisible({ timeout: 300 }).catch(() => false)) {
      const raw = await input.inputValue();
      return this.parseAmount(raw);
    }
    const text = await this.getRawText();
    return this.parseAmount(text);
  }

  async getRawText(): Promise<string> {
    // Odoo's tax-totals widget (used for amount_untaxed/amount_tax/amount_total on the
    // Sale Order form) renders its readonly value as a bare `<span name="...">` with no
    // `.o_field_widget` wrapper class — confirmed live (0 matches for the compound
    // selector, vs. 1 for the bare attribute), unlike most other monetary fields on the
    // form. `.o_field_widget[name=...]` is tried first since it's more specific/reliable
    // where it does apply; the bare `[name=...]` is the fallback for this widget's markup.
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    if (await widget.isVisible({ timeout: 2_000 }).catch(() => false)) {
      return (await widget.textContent())?.trim() ?? '';
    }
    const bare = this.page.locator(`[name="${this.fieldName}"]`).first();
    await bare.waitFor({ state: 'visible', timeout: 15_000 });
    return (await bare.textContent())?.trim() ?? '';
  }

  private parseAmount(text: string): number {
    // Strip currency symbols, commas, whitespace
    const cleaned = text.replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}
