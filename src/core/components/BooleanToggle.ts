import { Page, expect } from '@playwright/test';

export class BooleanToggle {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async enable(): Promise<void> {
    const checkbox = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input[type="checkbox"]`).first();
    if (!(await checkbox.isChecked())) {
      await checkbox.check();
    }
  }

  async disable(): Promise<void> {
    const checkbox = this.page.locator(`.o_field_widget[name="${this.fieldName}"] input[type="checkbox"]`).first();
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  async isChecked(): Promise<boolean> {
    return this.page.locator(`.o_field_widget[name="${this.fieldName}"] input[type="checkbox"]`).first().isChecked();
  }

  async expectChecked(): Promise<void> {
    await expect(this.page.locator(`.o_field_widget[name="${this.fieldName}"] input[type="checkbox"]`).first()).toBeChecked();
  }

  async expectUnchecked(): Promise<void> {
    await expect(this.page.locator(`.o_field_widget[name="${this.fieldName}"] input[type="checkbox"]`).first()).not.toBeChecked();
  }
}
