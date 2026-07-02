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
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    const text = (await widget.textContent())?.trim() ?? '0';
    return this.parseAmount(text);
  }

  async getRawText(): Promise<string> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    return (await widget.textContent())?.trim() ?? '';
  }

  private parseAmount(text: string): number {
    // Strip currency symbols, commas, whitespace
    const cleaned = text.replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}
