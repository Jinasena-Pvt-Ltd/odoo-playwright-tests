/**
 * StepRunReporter — writes reports/master-run-report-YYYY-MM-DD.html after every run.
 *
 * A self-contained, step-by-step run report: for every test it lists the named steps (test.step) that ran,
 * which step failed, Odoo's / Playwright's error message, a "how to pass" hint for known problems and the
 * failure screenshot. Tests are grouped by module and test step (config, business, validations, …).
 *
 * Also writes test-results/run-report-data.json with the same data.
 * Options: { outputDir?: string }  (default "reports")
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface StepRow { title: string; durationMs: number; error: string; children: StepRow[] }

interface TestRow {
  module: string;
  stepKey: string;
  describe: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  durationMs: number;
  error: string;
  steps: StepRow[];
  annotations: Array<{ type: string; description: string }>;
  screenshot: string;
}

const STEP_LABEL: Record<string, string> = {
  config: 'Step 1 · Configuration', business: 'Step 2 · Business logic', reporting: 'Step 3 · Reporting',
  permissions: 'Step 4 · Permissions', validations: 'Step 5 · Validations', edge: 'Step 6 · Edge cases',
  archive: 'Step 7 · Archive', setup: 'Setup', other: 'Other',
};
const STEP_FOLDER: Record<string, string> = {
  '01-config': 'config', '02-business': 'business', '03-reporting': 'reporting', '04-permissions': 'permissions',
  '05-validations': 'validations', '06-edge-cases': 'edge', '07-archive': 'archive',
};
const STEP_ORDER = ['config', 'business', 'reporting', 'permissions', 'validations', 'edge', 'archive', 'other', 'setup'];

/** "How to pass" hints for problems seen in this project. First match wins. */
const HINTS: Array<{ match: RegExp; text: string }> = [
  { match: /not allowed to create a lot or serial/i,
    text: 'The logged-in user cannot create serial numbers. In Odoo: Inventory > Configuration > Operation Types > Delivery Orders, switch on "Create New Lots/Serial Numbers" (and make sure the user has the Inventory access right to do it), or pick a product/user that already has serials in stock.' },
  { match: /not found/i,
    text: 'A customer/product used by the test does not exist in this database. Point the test at one that does with CREDIT_CUSTOMER, FLOW_CONTROL_CUSTOMER, SERIAL_PRODUCT_CODE / SERIAL_PRODUCT_NAME.' },
  { match: /Odoo saved a .* quotation with a blank/i,
    text: 'This is an Odoo finding, not a test problem: the field is not mandatory on the quotation. The test passes once the field is made required (or read-only with a value).' },
  { match: /confirmed an order with zero/i,
    text: 'This is an Odoo finding: Confirm is available for a line with zero quantity / zero price. The test passes once Odoo blocks it. A confirmed order was left behind — cancel it in Odoo.' },
  { match: /View Credit Limit Overdue Details should be/i,
    text: 'Odoo only shows this button in some credit positions. If it is not required above the credit limit, remove that check from sales.credit-control.spec.ts.' },
  { match: /Stuck before Confirm/i,
    text: 'No Confirm / Request / Approve button was usable. Check the customer is within its credit limit and not overdue, or set ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD so approvals can be given.' },
  { match: /waiting for locator\('\.o_main_navbar'\)/i,
    text: 'Odoo did not finish loading (slow server or expired session). Re-run the test; if it keeps happening check the server and ODOO_BASE_URL.' },
  { match: /Timeout .* exceeded/i,
    text: 'An element did not appear in time. Check the screenshot: a dialog may be blocking the page, or the data/configuration the step needs is missing.' },
];

const strip = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[[0-9;]*m/g, '');
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (ms: number): string => (ms < 950 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);

function collectSteps(steps: TestStep[]): StepRow[] {
  const out: StepRow[] = [];
  for (const s of steps) {
    if (s.category === 'test.step') {
      out.push({
        title: s.title,
        durationMs: s.duration,
        error: s.error ? strip(s.error.message ?? '').split('\n')[0].slice(0, 300) : '',
        children: collectSteps(s.steps),
      });
    } else {
      out.push(...collectSteps(s.steps)); // hooks / api calls: keep only the named steps inside them
    }
  }
  return out;
}

export default class StepRunReporter implements Reporter {
  private rows = new Map<string, TestRow>();
  private startedAt = new Date();
  private outputDir: string;
  private rootDir = process.cwd();

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = options.outputDir ?? 'reports';
  }

  onBegin(config: FullConfig, _suite: Suite): void {
    this.rootDir = config.rootDir ? path.resolve(config.rootDir, '..') : process.cwd();
    this.startedAt = new Date();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const file = test.location.file.replace(/\\/g, '/');
    const mod = (file.match(/\/modules\/([^/]+)\//) ?? [])[1] ?? (file.includes('/fixtures/') ? 'setup' : 'other');
    const folder = (file.match(/\/tests\/([^/]+)\//) ?? [])[1] ?? '';
    const stepKey = mod === 'setup' ? 'setup' : STEP_FOLDER[folder] ?? 'other';
    const titlePath = test.titlePath().filter(Boolean);
    // [project, file, ...describes, title]
    const describes = titlePath.slice(2, -1).map(t => t.replace(/@\S+/g, '').trim()).filter(Boolean);
    const shot = result.attachments.find(a => a.contentType === 'image/png' && a.path);
    let screenshot = '';
    if (shot?.path && fs.existsSync(shot.path)) screenshot = `data:image/png;base64,${fs.readFileSync(shot.path).toString('base64')}`;

    this.rows.set(test.id, {
      module: mod,
      stepKey,
      describe: describes.join(' › '),
      title: test.title.replace(/@\S+/g, '').trim(),
      status: result.status,
      durationMs: result.duration,
      error: result.errors.map(e => strip(e.message ?? '')).join('\n').trim(),
      steps: collectSteps(result.steps),
      annotations: test.annotations.map(a => ({ type: a.type, description: a.description ?? '' })),
      screenshot,
    });
  }

  onEnd(result: FullResult): void {
    const rows = [...this.rows.values()];
    const date = this.startedAt.toISOString().slice(0, 10);
    const outDir = path.resolve(this.rootDir, this.outputDir);
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `master-run-report-${date}.html`);
    fs.writeFileSync(file, this.render(rows, result, date), 'utf-8');
    const dataDir = path.resolve(this.rootDir, 'test-results');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'run-report-data.json'),
      JSON.stringify(rows.map(r => ({ ...r, screenshot: r.screenshot ? '(embedded)' : '' })), null, 1), 'utf-8');
    console.log(`\nStep-by-step run report: ${file}`);
  }

  // ── HTML ────────────────────────────────────────────────────────────────────

  private renderSteps(steps: StepRow[], prefix = ''): string {
    return steps.map((s, i) => {
      const num = `${prefix}${i + 1}`;
      const failed = !!s.error;
      const own = `<tr class="${failed ? 'sf' : 'sp'}"><td class="n">${num}</td>` +
        `<td class="t" style="padding-left:${10 + prefix.split('.').length * 0 + (num.split('.').length - 1) * 22}px">${esc(s.title)}${failed ? `<div class="se">${esc(s.error)}</div>` : ''}</td>` +
        `<td class="r">${failed ? '❌ Failed' : '✅ Passed'}</td><td class="d">${secs(s.durationMs)}</td></tr>`;
      return own + this.renderSteps(s.children, `${num}.`);
    }).join('');
  }

  private hintFor(error: string): string {
    return HINTS.find(h => h.match.test(error))?.text ?? '';
  }

  private renderTest(r: TestRow, id: number): string {
    const st = r.status === 'timedOut' ? 'failed' : r.status;
    const icon = st === 'passed' ? '✅' : st === 'failed' ? '❌' : '⏭';
    const label = st === 'passed' ? 'Passed' : st === 'failed' ? 'Failed' : (r.annotations.find(a => a.type === 'skip')?.description ? 'Skipped' : 'Not run');
    const skipWhy = r.annotations.find(a => a.type === 'skip')?.description ?? '';
    const notRun = st === 'skipped' && !skipWhy && !r.steps.length
      ? 'Not run: an earlier test in this flow failed, or the test was skipped before it started.' : '';
    const notes = r.annotations.filter(a => a.type !== 'skip' && a.description)
      .map(a => `<span class="chip">${esc(a.type)}: ${esc(a.description)}</span>`).join('');
    const stepsHtml = r.steps.length
      ? `<table class="steps"><thead><tr><th>#</th><th>Step</th><th>Result</th><th>Time</th></tr></thead><tbody>${this.renderSteps(r.steps)}</tbody></table>`
      : '<p class="muted">No named steps were recorded for this test.</p>';
    const hint = r.error ? this.hintFor(r.error) : '';
    const err = r.error
      ? `<div class="err"><b>What went wrong</b><pre>${esc(r.error.slice(0, 1800))}</pre>${hint ? `<div class="hint"><b>How to pass:</b> ${esc(hint)}</div>` : ''}${r.screenshot ? `<img src="${r.screenshot}" alt="failure screenshot">` : ''}</div>`
      : '';
    const why = skipWhy ? `<div class="skipwhy">${esc(skipWhy)}</div>` : notRun ? `<div class="skipwhy">${notRun}</div>` : '';
    return `<details class="test ${st}" data-status="${st}"${st === 'failed' ? ' open' : ''}>` +
      `<summary><span class="ico">${icon}</span><span class="tt">${esc(r.title)}</span>` +
      `<span class="pill ${st}">${label}</span><span class="dur">${secs(r.durationMs)}</span></summary>` +
      `<div class="body">${r.describe ? `<div class="muted">${esc(r.describe)}</div>` : ''}${notes ? `<div>${notes}</div>` : ''}${why}${stepsHtml}${err}</div></details>`;
  }

  private render(rows: TestRow[], run: FullResult, date: string): string {
    const count = (s: string) => rows.filter(r => (r.status === 'timedOut' ? 'failed' : r.status) === s).length;
    const passed = count('passed'); const failed = count('failed'); const skipped = count('skipped');
    const total = rows.length;
    const host = (process.env.ODOO_BASE_URL ?? '').replace(/^https?:\/\//, '').split('/')[0];
    const totalMs = rows.reduce((a, r) => a + r.durationMs, 0);

    const modules = [...new Set(rows.map(r => r.module))].sort((a, b) => (a === 'setup' ? 1 : b === 'setup' ? -1 : a.localeCompare(b)));
    let id = 0;
    const sections = modules.map(mod => {
      const modRows = rows.filter(r => r.module === mod);
      const stepKeys = STEP_ORDER.filter(k => modRows.some(r => r.stepKey === k));
      const body = stepKeys.map(k => {
        const rs = modRows.filter(r => r.stepKey === k);
        const f = rs.filter(r => r.status === 'failed' || r.status === 'timedOut').length;
        const p = rs.filter(r => r.status === 'passed').length;
        const s = rs.length - f - p;
        return `<div class="stepgrp"><h3>${esc(STEP_LABEL[k] ?? k)} <small>${p} passed · ${f} failed · ${s} skipped / not run</small></h3>` +
          rs.map(r => this.renderTest(r, id++)).join('') + '</div>';
      }).join('');
      return `<section class="mod"><h2>${esc(mod === 'setup' ? 'Setup' : mod.charAt(0).toUpperCase() + mod.slice(1))} module</h2>${body}</section>`;
    }).join('');

    const failedList = rows.filter(r => r.status === 'failed' || r.status === 'timedOut')
      .map(r => `<li><b>${esc(r.title)}</b><br><span class="muted">${esc((r.error.split('\n')[0] || '').slice(0, 200))}</span></li>`).join('');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Master run report ${date}</title>
<style>
:root{--pass:#2e7d32;--fail:#c62828;--skip:#e65100;--line:#e5e7eb;--ink:#1f2937}
*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f8fafc;color:var(--ink);line-height:1.5}
header{background:#0f172a;color:#fff;padding:26px 40px}header h1{margin:0 0 6px;font-size:26px}header p{margin:0;color:#cbd5e1;font-size:14px}
main{max-width:1150px;margin:0 auto;padding:22px 26px 70px}
.sum{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 16px}.box{flex:1 1 150px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 16px;text-align:center}
.box b{display:block;font-size:30px}.box span{font-size:13px;color:#6b7280}.p{color:var(--pass)}.f{color:var(--fail)}.s{color:var(--skip)}
.bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:#e5e7eb;margin-bottom:16px}.bar i{display:block}
.filters{display:flex;gap:8px;margin:10px 0 4px;flex-wrap:wrap}.filters button{border:1px solid var(--line);background:#fff;border-radius:20px;padding:6px 14px;cursor:pointer;font-size:13px}.filters button.on{background:#0f172a;color:#fff;border-color:#0f172a}
.fails{background:#fef2f2;border-left:4px solid var(--fail);padding:10px 18px;margin:14px 0;border-radius:6px}.fails ul{margin:6px 0 0;padding-left:20px;font-size:14px}
.mod h2{margin:30px 0 8px;font-size:20px;border-bottom:2px solid #0f172a;padding-bottom:6px}.stepgrp h3{margin:18px 0 8px;font-size:16px;color:#334155}.stepgrp h3 small{font-weight:400;color:#64748b;font-size:12.5px;margin-left:8px}
details.test{background:#fff;border:1px solid var(--line);border-radius:10px;margin:8px 0;overflow:hidden}details.test.failed{border-color:#fca5a5}
details.test>summary{cursor:pointer;padding:10px 14px;display:flex;align-items:center;gap:10px;list-style:none}details.test>summary::-webkit-details-marker{display:none}
.tt{flex:1;font-weight:600;font-size:14.5px}.dur{color:#64748b;font-size:12.5px}.pill{font-size:12px;font-weight:700;padding:2px 10px;border-radius:12px;color:#fff}
.pill.passed{background:var(--pass)}.pill.failed{background:var(--fail)}.pill.skipped{background:var(--skip)}
.body{padding:4px 16px 14px;border-top:1px solid var(--line)}.muted{color:#64748b;font-size:13px;margin:6px 0}.chip{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:10px;padding:1px 9px;font-size:12px;margin:2px 4px 2px 0}
.skipwhy{background:#fff7ed;border-left:4px solid var(--skip);padding:8px 12px;margin:8px 0;font-size:13.5px}
table.steps{width:100%;border-collapse:collapse;margin:10px 0;font-size:13.5px}.steps th{text-align:left;background:#f1f5f9;padding:6px 10px;border-bottom:1px solid var(--line)}
.steps td{padding:6px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}.steps td.n{width:54px;color:#64748b}.steps td.r{width:96px;white-space:nowrap}.steps td.d{width:80px;color:#64748b;white-space:nowrap}
tr.sf td{background:#fef2f2}.se{color:var(--fail);font-size:12.5px;margin-top:3px}
.err{margin-top:10px;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;background:#fff}.err pre{white-space:pre-wrap;word-break:break-word;background:#fef2f2;padding:10px;border-radius:6px;font-size:12.5px;max-height:260px;overflow:auto}
.hint{background:#ecfdf5;border-left:4px solid var(--pass);padding:8px 12px;margin:8px 0;font-size:13.5px}.err img{max-width:100%;border:1px solid #ccc;border-radius:6px;margin-top:8px}
</style></head><body>
<header><h1>Master run report — step by step</h1><p>${esc(date)} · ${esc(host || 'Odoo')} · ${esc(run.status)} · total test time ${secs(totalMs)}</p></header>
<main>
<div class="sum"><div class="box"><b>${total}</b><span>tests</span></div><div class="box"><b class="p">${passed}</b><span>passed</span></div>
<div class="box"><b class="f">${failed}</b><span>failed</span></div><div class="box"><b class="s">${skipped}</b><span>skipped / not run</span></div></div>
<div class="bar"><i style="width:${total ? (passed / total) * 100 : 0}%;background:var(--pass)"></i><i style="width:${total ? (failed / total) * 100 : 0}%;background:var(--fail)"></i><i style="width:${total ? (skipped / total) * 100 : 0}%;background:var(--skip)"></i></div>
${failed ? `<div class="fails"><b>${failed} failed — what to look at first</b><ul>${failedList}</ul></div>` : '<div class="fails" style="background:#f0fdf4;border-color:var(--pass)"><b>No failures in this run.</b></div>'}
<div class="filters"><button class="on" data-f="all">All</button><button data-f="failed">Failed</button><button data-f="passed">Passed</button><button data-f="skipped">Skipped / not run</button></div>
${sections}
</main>
<script>
document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');
  var f=b.getAttribute('data-f');
  document.querySelectorAll('details.test').forEach(function(d){d.style.display=(f==='all'||d.getAttribute('data-status')===f)?'':'none'});
});});
</script></body></html>`;
  }
}
