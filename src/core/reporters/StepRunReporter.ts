/**
 * StepRunReporter — writes reports/master-run-report-YYYY-MM-DD.html after every run.
 *
 * The report divides the test cases by test step (Config, Business, Reporting, Permissions, Validations,
 * Edge cases, Archive) and compares runs: every run is saved to reports/run-history/runs.json, and the report
 * shows 1st run / 2nd run / 3rd run … side by side (pass, fail, skipped), what changed between the last two runs,
 * and — for the latest run — every named step (test.step) with its result, the error, a "how to pass" hint and
 * the failure screenshot.
 *
 * Options: { outputDir?: string }  (default "reports")
 * Env:     RUN_LABEL — optional name for this run (default "Nth run"); RUN_HISTORY=off — do not save this run.
 */
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

type Status = 'passed' | 'failed' | 'skipped';

interface StepRow { title: string; durationMs: number; error: string; children: StepRow[] }

interface TestRow {
  key: string;
  module: string;
  stepKey: string;
  describe: string;
  title: string;
  status: Status;
  durationMs: number;
  error: string;
  steps: StepRow[];
  annotations: Array<{ type: string; description: string }>;
  screenshot: string;
}

interface RunResult { status: Status; durationMs: number; error: string }
interface RunRecord { id: string; startedAt: string; label: string; results: Record<string, RunResult> }

const STEP_LABEL: Record<string, string> = {
  config: 'Config', business: 'Business', reporting: 'Reporting', permissions: 'Permissions',
  validations: 'Validations', edge: 'Edge cases', archive: 'Archive', setup: 'Setup', other: 'Other',
};
const STEP_NO: Record<string, string> = {
  config: 'Step 1', business: 'Step 2', reporting: 'Step 3', permissions: 'Step 4',
  validations: 'Step 5', edge: 'Step 6', archive: 'Step 7', setup: '', other: '',
};
const STEP_FOLDER: Record<string, string> = {
  '01-config': 'config', '02-business': 'business', '03-reporting': 'reporting', '04-permissions': 'permissions',
  '05-validations': 'validations', '06-edge-cases': 'edge', '07-archive': 'archive',
};
const STEP_ORDER = ['config', 'business', 'reporting', 'permissions', 'validations', 'edge', 'archive', 'other', 'setup'];
const MAX_RUNS_SHOWN = 6;
const MAX_RUNS_KEPT = 30;

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
  { match: /o_main_navbar|Odoo did not load|Orders'\)\.first\(\)/i,
    text: 'Odoo did not finish loading (slow server or expired session). Re-run the test; if it keeps happening check the server and ODOO_BASE_URL.' },
  { match: /Timeout .* exceeded/i,
    text: 'An element did not appear in time. Check the screenshot: a dialog may be blocking the page, or the data/configuration the step needs is missing.' },
];

const strip = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, '').replace(/\[[0-9;]*m/g, '');
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (ms: number): string => (ms < 950 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd']; const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]} run`;
};
const norm = (s: Status | 'timedOut' | 'interrupted'): Status => (s === 'passed' ? 'passed' : s === 'skipped' ? 'skipped' : 'failed');
const ICON: Record<Status, string> = { passed: '✅', failed: '❌', skipped: '⏭' };

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
    const describes = titlePath.slice(2, -1).map(t => t.replace(/@\S+/g, '').trim()).filter(Boolean);
    const title = test.title.replace(/@\S+/g, '').trim();
    const shot = result.attachments.find(a => a.contentType === 'image/png' && a.path);
    let screenshot = '';
    if (shot?.path && fs.existsSync(shot.path)) screenshot = `data:image/png;base64,${fs.readFileSync(shot.path).toString('base64')}`;

    const key = [mod, stepKey, describes.join(' › '), title].join('|');
    this.rows.set(test.id, {
      key, module: mod, stepKey, describe: describes.join(' › '), title,
      status: norm(result.status),
      durationMs: result.duration,
      error: result.errors.map(e => strip(e.message ?? '')).join('\n').trim(),
      steps: collectSteps(result.steps),
      annotations: test.annotations.map(a => ({ type: a.type, description: a.description ?? '' })),
      screenshot,
    });
  }

  // ── History ─────────────────────────────────────────────────────────────────

  private historyFile(): string {
    return path.resolve(this.rootDir, this.outputDir, 'run-history', 'runs.json');
  }

  private loadHistory(): RunRecord[] {
    try {
      const data = JSON.parse(fs.readFileSync(this.historyFile(), 'utf-8'));
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  }

  onEnd(result: FullResult): void {
    const rows = [...this.rows.values()];
    const date = this.startedAt.toISOString().slice(0, 10);
    const outDir = path.resolve(this.rootDir, this.outputDir);
    fs.mkdirSync(outDir, { recursive: true });

    let history = this.loadHistory();
    if (process.env.RUN_HISTORY !== 'off') {
      const record: RunRecord = {
        id: this.startedAt.toISOString(),
        startedAt: this.startedAt.toISOString(),
        label: process.env.RUN_LABEL ?? ordinal(history.length + 1),
        results: Object.fromEntries(rows.map(r => [r.key, { status: r.status, durationMs: r.durationMs, error: r.error.split('\n')[0].slice(0, 240) }])),
      };
      history = [...history, record].slice(-MAX_RUNS_KEPT);
      fs.mkdirSync(path.dirname(this.historyFile()), { recursive: true });
      fs.writeFileSync(this.historyFile(), JSON.stringify(history, null, 1), 'utf-8');
    }

    const file = path.join(outDir, `master-run-report-${date}.html`);
    fs.writeFileSync(file, this.render(rows, result, date, history), 'utf-8');
    const dataDir = path.resolve(this.rootDir, 'test-results');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'run-report-data.json'),
      JSON.stringify(rows.map(r => ({ ...r, screenshot: r.screenshot ? '(embedded)' : '' })), null, 1), 'utf-8');
    console.log(`\nMaster run report: ${file}`);
  }

  // ── HTML ────────────────────────────────────────────────────────────────────

  private renderSteps(steps: StepRow[], prefix = ''): string {
    return steps.map((s, i) => {
      const num = `${prefix}${i + 1}`;
      const failed = !!s.error;
      const own = `<tr class="${failed ? 'sf' : 'sp'}"><td class="n">${num}</td>` +
        `<td class="t" style="padding-left:${10 + (num.split('.').length - 1) * 22}px">${esc(s.title)}${failed ? `<div class="se">${esc(s.error)}</div>` : ''}</td>` +
        `<td class="r">${failed ? '❌ Failed' : '✅ Passed'}</td><td class="d">${secs(s.durationMs)}</td></tr>`;
      return own + this.renderSteps(s.children, `${num}.`);
    }).join('');
  }

  private hintFor(error: string): string {
    return HINTS.find(h => h.match.test(error))?.text ?? '';
  }

  /** What changed for this test between the previous run and the latest run. */
  private trend(prev: RunResult | undefined, cur: RunResult | undefined): { cls: string; text: string } {
    if (!cur) return { cls: 'same', text: '' };
    if (!prev) return { cls: 'same', text: prev === undefined ? 'new' : '' };
    if (prev.status === cur.status) return { cls: 'same', text: 'same' };
    if (cur.status === 'passed') return { cls: 'better', text: '↑ fixed' };
    if (cur.status === 'failed' && prev.status === 'passed') return { cls: 'worse', text: '↓ now failing' };
    if (cur.status === 'failed') return { cls: 'worse', text: '↓ now failing' };
    return { cls: 'same', text: 'changed' };
  }

  private renderTest(r: TestRow, runs: RunRecord[]): string {
    const st = r.status;
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

    const shown = runs.slice(-MAX_RUNS_SHOWN);
    const chips = shown.map(run => {
      const res = run.results[r.key];
      return res ? `<span class="rc ${res.status}" title="${esc(run.label)}: ${res.status}">${esc(run.label.replace(' run', ''))} ${ICON[res.status]}</span>`
        : `<span class="rc none" title="${esc(run.label)}: not in this run">${esc(run.label.replace(' run', ''))} –</span>`;
    }).join('');
    const prev = shown.length > 1 ? shown[shown.length - 2].results[r.key] : undefined;
    const cur = shown.length ? shown[shown.length - 1].results[r.key] : undefined;
    const tr = shown.length > 1 ? this.trend(prev, cur) : { cls: 'same', text: '' };
    const histRows = shown.map(run => {
      const res = run.results[r.key];
      return `<tr><td>${esc(run.label)}</td><td class="muted">${esc(run.startedAt.replace('T', ' ').slice(0, 16))}</td>` +
        `<td>${res ? `${ICON[res.status]} ${res.status}` : '– not in this run'}</td><td class="muted">${res ? secs(res.durationMs) : ''}</td>` +
        `<td class="muted">${res?.error ? esc(res.error.slice(0, 160)) : ''}</td></tr>`;
    }).join('');
    const hist = shown.length > 1
      ? `<h4>Run history</h4><table class="steps"><thead><tr><th>Run</th><th>When</th><th>Result</th><th>Time</th><th>First error</th></tr></thead><tbody>${histRows}</tbody></table>` : '';

    return `<details class="test ${st}" data-status="${st}"${st === 'failed' ? ' open' : ''}>` +
      `<summary><span class="ico">${ICON[st]}</span><span class="tt">${esc(r.title)}</span>${chips}` +
      `${tr.text ? `<span class="tr ${tr.cls}">${tr.text}</span>` : ''}` +
      `<span class="pill ${st}">${label}</span><span class="dur">${secs(r.durationMs)}</span></summary>` +
      `<div class="body">${r.describe ? `<div class="muted">${esc(r.describe)}</div>` : ''}${notes ? `<div>${notes}</div>` : ''}${why}<h4>Latest run — steps</h4>${stepsHtml}${err}${hist}</div></details>`;
  }

  private tally(rows: Array<{ status: Status }>): { p: number; f: number; s: number } {
    return { p: rows.filter(r => r.status === 'passed').length, f: rows.filter(r => r.status === 'failed').length, s: rows.filter(r => r.status === 'skipped').length };
  }

  private render(rows: TestRow[], run: FullResult, date: string, history: RunRecord[]): string {
    const runs = history.slice(-MAX_RUNS_SHOWN);
    const t = this.tally(rows);
    const total = rows.length;
    const host = (process.env.ODOO_BASE_URL ?? '').replace(/^https?:\/\//, '').split('/')[0];
    const totalMs = rows.reduce((a, r) => a + r.durationMs, 0);
    const keys = STEP_ORDER.filter(k => rows.some(r => r.stepKey === k));

    // Overview: per test step × per run
    const runTally = (rec: RunRecord, stepKey?: string): { p: number; f: number; s: number; n: number } => {
      const list = Object.entries(rec.results).filter(([k]) => !stepKey || k.split('|')[1] === stepKey).map(([, v]) => v);
      const x = this.tally(list);
      return { ...x, n: list.length };
    };
    const cell = (x: { p: number; f: number; s: number; n: number }): string =>
      x.n === 0 ? '<td class="c none">–</td>'
        : `<td class="c"><span class="p">${x.p} ✅</span> <span class="f">${x.f} ❌</span> <span class="s">${x.s} ⏭</span></td>`;
    const overviewHead = `<tr><th>Test step</th><th>Test cases</th>${runs.map(r => `<th>${esc(r.label)}<div class="when">${esc(r.startedAt.replace('T', ' ').slice(0, 16))}</div></th>`).join('')}</tr>`;
    const overviewRows = keys.map(k => {
      const n = rows.filter(r => r.stepKey === k).length;
      return `<tr><td><b>${esc(STEP_NO[k] ? `${STEP_NO[k]} · ` : '')}${esc(STEP_LABEL[k] ?? k)}</b></td><td class="c">${n}</td>${runs.map(r => cell(runTally(r, k))).join('')}</tr>`;
    }).join('');
    const overviewTotal = `<tr class="tot"><td><b>All test cases</b></td><td class="c">${total}</td>${runs.map(r => cell(runTally(r))).join('')}</tr>`;

    // Sections by test step
    const sections = keys.map(k => {
      const rs = rows.filter(r => r.stepKey === k);
      const x = this.tally(rs);
      return `<section class="stepgrp" id="step-${k}"><h2>${esc(STEP_NO[k] ? `${STEP_NO[k]} · ` : '')}${esc(STEP_LABEL[k] ?? k)} ` +
        `<small>${rs.length} test cases · ${x.p} passed · ${x.f} failed · ${x.s} skipped / not run</small></h2>` +
        rs.map(r => this.renderTest(r, runs)).join('') + '</section>';
    }).join('');

    const failedList = rows.filter(r => r.status === 'failed')
      .map(r => `<li><b>${esc(r.title)}</b> <span class="muted">(${esc(STEP_LABEL[r.stepKey] ?? r.stepKey)})</span><br><span class="muted">${esc((r.error.split('\n')[0] || '').slice(0, 200))}</span></li>`).join('');

    // Changes between the last two runs
    let changes = '';
    if (runs.length > 1) {
      const a = runs[runs.length - 2]; const b = runs[runs.length - 1];
      const fixed: string[] = []; const broke: string[] = []; const added: string[] = [];
      for (const [k, cur] of Object.entries(b.results)) {
        const prev = a.results[k]; const name = k.split('|').slice(3).join(' ');
        if (!prev) { added.push(name); continue; }
        if (prev.status !== 'passed' && cur.status === 'passed') fixed.push(name);
        if (prev.status === 'passed' && cur.status === 'failed') broke.push(name);
      }
      const li = (l: string[]) => l.length ? `<ul>${l.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="muted">none</p>';
      changes = `<div class="changes"><h2>${esc(a.label)} → ${esc(b.label)}: what changed</h2><div class="cols">` +
        `<div><h4 class="p">↑ Fixed / now passing (${fixed.length})</h4>${li(fixed)}</div>` +
        `<div><h4 class="f">↓ Now failing (${broke.length})</h4>${li(broke)}</div>` +
        `<div><h4>New in this run (${added.length})</h4>${li(added)}</div></div></div>`;
    }

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Master run report ${date}</title>
<style>
:root{--pass:#2e7d32;--fail:#c62828;--skip:#e65100;--line:#e5e7eb;--ink:#1f2937}
*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f8fafc;color:var(--ink);line-height:1.5}
header{background:#0f172a;color:#fff;padding:26px 40px}header h1{margin:0 0 6px;font-size:26px}header p{margin:0;color:#cbd5e1;font-size:14px}
main{max-width:1200px;margin:0 auto;padding:22px 26px 70px}
.sum{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 16px}.box{flex:1 1 150px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 16px;text-align:center}
.box b{display:block;font-size:30px}.box span{font-size:13px;color:#6b7280}.p{color:var(--pass)}.f{color:var(--fail)}.s{color:var(--skip)}
.bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:#e5e7eb;margin-bottom:16px}.bar i{display:block}
h2{margin:30px 0 8px;font-size:20px}.stepgrp h2{border-bottom:2px solid #0f172a;padding-bottom:6px}.stepgrp h2 small{font-weight:400;color:#64748b;font-size:13px;margin-left:8px}
table.ov{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px}
.ov th{background:#0f172a;color:#fff;padding:8px 10px;text-align:center;font-weight:600}.ov th:first-child{text-align:left}.ov th .when{font-weight:400;font-size:11px;color:#cbd5e1}
.ov td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.ov td.c{text-align:center;white-space:nowrap}.ov td.none{color:#9ca3af}.ov tr.tot td{background:#f1f5f9;font-weight:600}
.fails{background:#fef2f2;border-left:4px solid var(--fail);padding:10px 18px;margin:14px 0;border-radius:6px}.fails ul{margin:6px 0 0;padding-left:20px;font-size:14px}
.changes{background:#fff;border:1px solid var(--line);border-radius:10px;padding:4px 18px 14px;margin:18px 0}.changes h2{margin-top:12px}.cols{display:flex;gap:24px;flex-wrap:wrap}.cols>div{flex:1 1 250px}.cols ul{margin:4px 0;padding-left:20px;font-size:13.5px}.cols h4{margin:8px 0 2px}
.filters{display:flex;gap:8px;margin:18px 0 4px;flex-wrap:wrap;align-items:center}.filters span{font-size:13px;color:#64748b}.filters button{border:1px solid var(--line);background:#fff;border-radius:20px;padding:6px 14px;cursor:pointer;font-size:13px}.filters button.on{background:#0f172a;color:#fff;border-color:#0f172a}
details.test{background:#fff;border:1px solid var(--line);border-radius:10px;margin:8px 0;overflow:hidden}details.test.failed{border-color:#fca5a5}
details.test>summary{cursor:pointer;padding:10px 14px;display:flex;align-items:center;gap:8px;list-style:none;flex-wrap:wrap}details.test>summary::-webkit-details-marker{display:none}
.tt{flex:1 1 280px;font-weight:600;font-size:14.5px}.dur{color:#64748b;font-size:12.5px}.pill{font-size:12px;font-weight:700;padding:2px 10px;border-radius:12px;color:#fff}
.pill.passed{background:var(--pass)}.pill.failed{background:var(--fail)}.pill.skipped{background:var(--skip)}
.rc{font-size:12px;border-radius:10px;padding:1px 8px;border:1px solid var(--line);background:#f8fafc;white-space:nowrap}.rc.passed{background:#f0fdf4;border-color:#bbf7d0}.rc.failed{background:#fef2f2;border-color:#fecaca}.rc.skipped{background:#fff7ed;border-color:#fed7aa}.rc.none{color:#9ca3af}
.tr{font-size:12px;font-weight:700}.tr.better{color:var(--pass)}.tr.worse{color:var(--fail)}.tr.same{color:#94a3b8;font-weight:400}
.body{padding:4px 16px 14px;border-top:1px solid var(--line)}.body h4{margin:12px 0 2px;font-size:14px}.muted{color:#64748b;font-size:13px;margin:6px 0}.chip{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:10px;padding:1px 9px;font-size:12px;margin:2px 4px 2px 0}
.skipwhy{background:#fff7ed;border-left:4px solid var(--skip);padding:8px 12px;margin:8px 0;font-size:13.5px}
table.steps{width:100%;border-collapse:collapse;margin:8px 0;font-size:13.5px}.steps th{text-align:left;background:#f1f5f9;padding:6px 10px;border-bottom:1px solid var(--line)}
.steps td{padding:6px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}.steps td.n{width:54px;color:#64748b}.steps td.r{width:96px;white-space:nowrap}.steps td.d{width:80px;color:#64748b;white-space:nowrap}
tr.sf td{background:#fef2f2}.se{color:var(--fail);font-size:12.5px;margin-top:3px}
.err{margin-top:10px;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;background:#fff}.err pre{white-space:pre-wrap;word-break:break-word;background:#fef2f2;padding:10px;border-radius:6px;font-size:12.5px;max-height:260px;overflow:auto}
.hint{background:#ecfdf5;border-left:4px solid var(--pass);padding:8px 12px;margin:8px 0;font-size:13.5px}.err img{max-width:100%;border:1px solid #ccc;border-radius:6px;margin-top:8px}
</style></head><body>
<header><h1>Master run report</h1><p>${esc(date)} · ${esc(host || 'Odoo')} · latest run: ${esc(runs.length ? runs[runs.length - 1].label : 'this run')} · ${esc(run.status)} · test time ${secs(totalMs)}</p></header>
<main>
<h2 style="margin-top:6px">Latest run</h2>
<div class="sum"><div class="box"><b>${total}</b><span>test cases</span></div><div class="box"><b class="p">${t.p}</b><span>passed</span></div>
<div class="box"><b class="f">${t.f}</b><span>failed</span></div><div class="box"><b class="s">${t.s}</b><span>skipped / not run</span></div></div>
<div class="bar"><i style="width:${total ? (t.p / total) * 100 : 0}%;background:var(--pass)"></i><i style="width:${total ? (t.f / total) * 100 : 0}%;background:var(--fail)"></i><i style="width:${total ? (t.s / total) * 100 : 0}%;background:var(--skip)"></i></div>

<h2>Test cases by test step, run by run</h2>
<table class="ov">${overviewHead}${overviewRows}${overviewTotal}</table>

${changes}
${t.f ? `<div class="fails"><b>${t.f} failed in the latest run — what to look at first</b><ul>${failedList}</ul></div>` : '<div class="fails" style="background:#f0fdf4;border-color:var(--pass)"><b>No failures in the latest run.</b></div>'}

<div class="filters"><span>Show:</span><button class="on" data-f="all">All</button><button data-f="failed">Failed</button><button data-f="passed">Passed</button><button data-f="skipped">Skipped / not run</button></div>
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
