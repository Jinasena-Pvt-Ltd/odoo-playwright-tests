import { Page } from '@playwright/test';

export class Many2ManyField {
  constructor(
    private readonly page: Page,
    private readonly fieldName: string,
  ) {}

  async addItem(displayName: string): Promise<void> {
    const widget = this.page.locator(`.o_field_widget[name="${this.fieldName}"]`).first();
    const input = widget.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    await input.fill(displayName);

    const dropdown = this.page.locator('.o_field_many2many_dropdown, .o-dropdown--menu').first();
    await dropdown.waitFor({ state: 'visible', timeout: 8_000 });
    await this.page
      .locator('.o_field_many2many_dropdown .o_menu_item, .o-dropdown--menu .o_menu_item')
      .filter({ hasText: displayName })
      .first()
      .click();
  }

  async removeItem(displayName: string): Promise<void> {
    const tag = this.page
      .locator(`.o_field_widget[name="${this.fieldName}"] .badge, .o_field_widget[name="${this.fieldName}"] .o_tag`)
      .filter({ hasText: displayName })
      .first();
    const deleteBtn = tag.locator('.o_delete, .o_badge_delete');
    await deleteBtn.click();
  }

  async getItems(): Promise<string[]> {
    const tags = this.page.locator(`.o_field_widget[name="${this.fieldName}"] .badge .o_tag_badge_text, .o_field_widget[name="${this.fieldName}"] .o_tag span`);
    return tags.allTextContents();
  }

  async hasItem(displayName: string): Promise<boolean> {
    const items = await this.getItems();
    return items.some(item => item.trim() === displayName);
  }
}
