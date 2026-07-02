import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export abstract class BaseKanbanPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async getColumnCount(): Promise<number> {
    return this.page.locator('.o_kanban_group').count();
  }

  async getCardCountInColumn(columnTitle: string): Promise<number> {
    const column = this.page
      .locator('.o_kanban_group')
      .filter({ hasText: columnTitle })
      .first();
    return column.locator('.o_kanban_record').count();
  }

  async clickCard(cardTitle: string): Promise<void> {
    await this.page
      .locator('.o_kanban_record')
      .filter({ hasText: cardTitle })
      .first()
      .click();
    await this.waitForOdooReady();
  }

  async clickQuickCreate(columnTitle: string): Promise<void> {
    const column = this.page
      .locator('.o_kanban_group')
      .filter({ hasText: columnTitle })
      .first();
    await column.locator('.o_kanban_quick_add').click();
  }

  async clickNew(): Promise<void> {
    await this.page.locator('.o_control_panel button[accesskey="n"], .o_control_panel .o_button_new').first().click();
    await this.waitForOdooReady();
  }

  async searchFor(query: string): Promise<void> {
    const input = this.page.locator('.o_searchview input, .o_searchview .o_searchview_input').first();
    await input.click();
    await input.pressSequentially(query, { delay: 30 });
    await this.page.waitForTimeout(300);
    await this.page.keyboard.press('Enter');
    await this.waitForOdooReady();
  }
}
