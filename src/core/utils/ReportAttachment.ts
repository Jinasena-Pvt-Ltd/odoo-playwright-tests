import { TestInfo, Page } from '@playwright/test';
import * as path from 'path';

export class ReportAttachment {
  constructor(
    private readonly testInfo: TestInfo,
    private readonly page: Page,
  ) {}

  async screenshot(name: string): Promise<void> {
    const buffer = await this.page.screenshot({ fullPage: true });
    await this.testInfo.attach(name, { body: buffer, contentType: 'image/png' });
  }

  async attachJSON(name: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    await this.testInfo.attach(name, {
      body: Buffer.from(content, 'utf-8'),
      contentType: 'application/json',
    });
  }

  async attachText(name: string, content: string): Promise<void> {
    await this.testInfo.attach(name, {
      body: Buffer.from(content, 'utf-8'),
      contentType: 'text/plain',
    });
  }

  async attachHTML(name: string, html: string): Promise<void> {
    await this.testInfo.attach(name, {
      body: Buffer.from(html, 'utf-8'),
      contentType: 'text/html',
    });
  }

  /** Records a validation test case as a test annotation for the ValidationTableReporter */
  recordValidationCase(entry: ValidationCaseEntry): void {
    this.testInfo.annotations.push({
      type: 'validation-case',
      description: JSON.stringify(entry),
    });
  }
}

export interface ValidationCaseEntry {
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
  actualError: string;
  passed: boolean;
}
