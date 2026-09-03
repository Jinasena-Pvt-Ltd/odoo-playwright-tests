import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';

/** account.move form in its "Journal Entry" guise (Cash Purchase's Issue/Settle journals). */
export class JournalEntryFormPage extends BaseFormPage {
  constructor(page: Page) {
    super(page);
  }

  /** Reads the journal's "Total Debit" footer amount (e.g. "15,000.0000 Rs"). */
  async getTotalDebit(): Promise<string> {
    return (await this.page.locator('[data-tooltip="Total Debit"]').first().innerText()).trim();
  }

  /** Posts the journal entry (Draft -> Posted). */
  async post(): Promise<void> {
    await this.page.getByRole('button', { name: 'Post', exact: true }).click();
    await this.waitForOdooReady();
    // "Reverse Entry" only appears once posted (draft shows "Post"/"Cancel Entry").
    await this.page.getByRole('button', { name: 'Reverse Entry', exact: true })
      .waitFor({ state: 'visible', timeout: 15_000 });
  }
}
