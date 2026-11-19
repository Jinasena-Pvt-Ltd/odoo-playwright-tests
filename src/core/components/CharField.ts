import { Page } from '@playwright/test';

export class CharField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async setValue(value: string): Promise<void> {
    const input = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input`).first();
    await input.waitFor({ state: 'visible', timeout: 15_000 });
    await input.fill(value);
  }

  async getValue(): Promise<string> {
    // In edit mode: return input value; in read mode: return span text
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
  }
}
