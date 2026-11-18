/**
 * Step 3 — Reporting: are there CUSTOM reports in the ACCOUNTING module, besides the base ones?
 * (Scope: Accounting menus, account.* reports and actions, the report engine and accounting-related modules only.)
 *
 * This is a discovery audit, not a pass/fail check of business behaviour. It reads the instance's metadata over RPC
 * (never changes anything) and looks for customised finance reports in every place they can hide: menus (also
 * inactive / group-restricted / empty ones), PDF report actions and customised QWeb templates, the Enterprise
 * accounting report engine, window/client/server actions, Studio, non-Odoo modules, and other mechanisms.
 *
 * Output: reports/custom-finance-reports-audit-<date>.json and .md (also attached to the test).
 * Run:    npx playwright test accounting.custom-reports-audit --project=admin --no-deps
 * See:    src/modules/accounting/data/custom-reports.scanner.ts for what each dimension (A–H) means.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { CustomReportScanner, toMarkdown } from '../../data/custom-reports.scanner';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Accounting custom finance reports audit @module:accounting @step:reporting @audit', () => {
  test('find every customised finance report (menus, reports, report engine, Studio, modules, other)', async ({ rpc }, testInfo) => {
    test.setTimeout(300_000);
    const instance = process.env.ODOO_BASE_URL ?? 'unknown';
    const result = await new CustomReportScanner(rpc, instance).scan();

    const stamp = new Date().toISOString().slice(0, 10);
    const dir = path.resolve('reports');
    fs.mkdirSync(dir, { recursive: true });
    const md = toMarkdown(result);
    fs.writeFileSync(path.join(dir, `custom-finance-reports-audit-${stamp}.json`), JSON.stringify(result, null, 2));
    fs.writeFileSync(path.join(dir, `custom-finance-reports-audit-${stamp}.md`), md);
    await testInfo.attach('custom-finance-reports-audit.md', { body: md, contentType: 'text/markdown' });
    await testInfo.attach('custom-finance-reports-audit.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });

    // A console summary so the answer is visible without opening the files.
    console.log('\n=== CUSTOM FINANCE REPORTS AUDIT ===');
    console.log(`non-Odoo modules (${result.moduleOrigins.custom.length}): ${result.moduleOrigins.custom.join(', ') || 'none'}`);
    for (const [k, d] of Object.entries(result.dimensions)) {
      console.log(`${k}  ${d.available ? String(d.findings.length).padStart(4) : ' n/a'}  ${d.title}${d.note ? '  — ' + d.note : ''}`);
    }
    const hiddenFlags = ['inactive', 'hidden-from-admin-by-groups', 'hidden-for-users', 'empty-no-action-no-children', 'no-menu-points-here', 'custom-module-not-installed'];
    const hidden = Object.values(result.dimensions).flatMap((d) => d.findings).filter((f) => f.flags.some((x) => hiddenFlags.includes(x)));
    console.log(`\nCustom/odd items that are currently HIDDEN or unreachable: ${hidden.length}`);
    for (const h of hidden.slice(0, 40)) console.log(`  [${h.dimension}] ${h.name}  <${h.model}>  ${h.origin}  ${h.flags.join(', ')}`);

    // The audit itself must have run: the module scan returned something coherent and all 8 dimensions exist.
    expect(result.moduleOrigins.standard, 'installed Odoo modules were read').toBeGreaterThan(0);
    expect(Object.keys(result.dimensions)).toHaveLength(8);
  });
});
