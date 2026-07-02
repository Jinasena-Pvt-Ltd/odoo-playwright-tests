import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import type { ValidationCaseEntry } from '../utils/ReportAttachment';

interface ReporterOptions {
  outputDir?: string;
}

class ValidationTableReporter implements Reporter {
  private outputDir: string;
  private cases: Array<ValidationCaseEntry & { testTitle: string }> = [];

  constructor(options: ReporterOptions = {}) {
    this.outputDir = options.outputDir ?? 'reports/validation-table';
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    for (const annotation of result.annotations) {
      if (annotation.type === 'validation-case' && annotation.description) {
        try {
          const entry = JSON.parse(annotation.description) as ValidationCaseEntry;
          this.cases.push({ ...entry, testTitle: test.title });
        } catch {
          // malformed annotation — skip
        }
      }
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (this.cases.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Write JSON
    const jsonPath = path.join(this.outputDir, `validation-results-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.cases, null, 2), 'utf-8');

    // Write HTML
    const htmlPath = path.join(this.outputDir, `validation-table-${timestamp}.html`);
    fs.writeFileSync(htmlPath, this.buildHTML(), 'utf-8');

    const total = this.cases.length;
    const passed = this.cases.filter(c => c.passed).length;
    console.log(`\nValidation Table: ${passed}/${total} cases passed → ${htmlPath}`);
  }

  private buildHTML(): string {
    const rows = this.cases
      .map(c => {
        const status = c.passed
          ? '<td class="pass">PASS ✓</td>'
          : '<td class="fail">FAIL ✗</td>';
        return `
          <tr class="${c.passed ? 'pass-row' : 'fail-row'}">
            <td>${esc(c.module)}</td>
            <td>${esc(c.testTitle)}</td>
            <td><code>${esc(c.field)}</code></td>
            <td><code>${esc(c.attemptedValue)}</code></td>
            <td>${esc(c.expectedError)}</td>
            <td>${esc(c.actualError)}</td>
            ${status}
          </tr>`;
      })
      .join('');

    const total = this.cases.length;
    const passed = this.cases.filter(c => c.passed).length;
    const failed = total - passed;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Validation Test Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 32px; color: #1a1a2e; }
    h1 { font-size: 1.6rem; margin-bottom: 4px; }
    .summary { display: flex; gap: 24px; margin-bottom: 20px; }
    .badge { padding: 6px 16px; border-radius: 6px; font-weight: 600; font-size: 0.95rem; }
    .badge-total { background: #e8eaf6; color: #3949ab; }
    .badge-pass  { background: #e8f5e9; color: #2e7d32; }
    .badge-fail  { background: #ffebee; color: #c62828; }
    table { border-collapse: collapse; width: 100%; font-size: 0.88rem; }
    th { background: #3949ab; color: #fff; padding: 10px 12px; text-align: left; }
    td { padding: 8px 12px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }
    code { background: #f5f5f5; padding: 1px 5px; border-radius: 3px; font-size: 0.85em; }
    tr.pass-row:hover { background: #f1f8e9; }
    tr.fail-row { background: #fff8f8; }
    tr.fail-row:hover { background: #ffebee; }
    td.pass { color: #2e7d32; font-weight: 600; }
    td.fail { color: #c62828; font-weight: 600; }
    .generated { margin-top: 24px; font-size: 0.78rem; color: #9e9e9e; }
  </style>
</head>
<body>
  <h1>Validation Test Report</h1>
  <div class="summary">
    <span class="badge badge-total">Total: ${total}</span>
    <span class="badge badge-pass">Passed: ${passed}</span>
    <span class="badge badge-fail">Failed: ${failed}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th>Module</th>
        <th>Test</th>
        <th>Field</th>
        <th>Attempted Value</th>
        <th>Expected Error</th>
        <th>Actual Error</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="generated">Generated: ${new Date().toUTCString()}</p>
</body>
</html>`;
  }
}

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default ValidationTableReporter;
