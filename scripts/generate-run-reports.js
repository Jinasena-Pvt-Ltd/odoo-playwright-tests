#!/usr/bin/env node
/**
 * scripts/generate-run-reports.js
 *
 * Writes the two run reports from the data saved by StepRunReporter (reports/run-history/):
 *
 *   reports/master-test-report-YYYY-MM-DD.html  — MASTER report: every test case of the project, divided by
 *                                                  module and test step (config, business, …), with its latest result.
 *   reports/custom-run-report-YYYY-MM-DD.html   — CUSTOM report: progress run by run (1st run, 2nd run, …),
 *                                                  every test PASS / FAIL / SKIP per run, open items with "how to pass",
 *                                                  and the step-by-step detail of the latest run.
 *
 * Usage:  node scripts/generate-run-reports.js      (also called automatically at the end of every test run)
 *
 * Customize the wording without touching code: reports/run-history/notes.json
 *   { "runs": { "2nd run": "Fixed the login wait" },
 *     "callouts": [ { "kind": "info|ok|warn|bad", "html": "Any text shown at the top of the custom report" } ] }
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
try { require('dotenv').config({ path: path.join(ROOT, '.env') }); } catch { /* dotenv optional */ }
const DIR = path.join(ROOT, 'reports', 'run-history');
const OUT = path.join(ROOT, 'reports');

const STEP_LABEL = {
  config: 'Config', business: 'Business', reporting: 'Reporting', permissions: 'Permissions',
  validations: 'Validations', edge: 'Edge cases', archive: 'Archive', setup: 'Setup', other: 'Other',
};
const STEP_NO = { config: 1, business: 2, reporting: 3, permissions: 4, validations: 5, edge: 6, archive: 7 };
const STEP_ORDER = ['config', 'business', 'reporting', 'permissions', 'validations', 'edge', 'archive', 'other', 'setup'];
const MAX_RUNS_SHOWN = 8;

/** "How to pass" hints for problems seen in this project. First match wins. */
const HINTS = [
  [/not allowed to create a lot or serial/i,
    'The logged-in user cannot create serial numbers. In Odoo: Inventory > Configuration > Operation Types > Delivery Orders, switch on "Create New Lots/Serial Numbers" (and make sure the user has the Inventory access right to do it), or use a product/user that already has serials in stock.'],
  [/not found/i,
    'A customer/product used by the test does not exist in this database. Point the test at one that does with CREDIT_CUSTOMER, FLOW_CONTROL_CUSTOMER, SERIAL_PRODUCT_CODE / SERIAL_PRODUCT_NAME.'],
  [/Odoo saved a .* quotation with a blank/i,
    'Odoo finding, not a test problem: the field is not mandatory on the quotation. The test passes once the field is made required (or read-only with a value).'],
  [/confirmed an order with zero/i,
    'Odoo finding: Confirm is available for a line with zero quantity / zero price. The test passes once Odoo blocks it. A confirmed order was left behind — cancel it in Odoo.'],
  [/View Credit Limit Overdue Details should be/i,
    'Odoo only shows this button in some credit positions. If it is not required above the credit limit, remove that check from sales.credit-control.spec.ts.'],
  [/Stuck before Confirm/i,
    'No Confirm / Request / Approve button was usable. Check the customer is within its credit limit and not overdue, or set ODOO_APPROVER_EMAIL / ODOO_APPROVER_PASSWORD so approvals can be given.'],
  [/o_main_navbar|Odoo did not load|Orders'\)\.first\(\)/i,
    'Odoo did not finish loading (slow server or expired session). Re-run the test; if it keeps happening check the server and ODOO_BASE_URL.'],
  [/Timeout .* exceeded/i,
    'An element did not appear in time. Check the screenshot: a dialog may be blocking the page, or the data/configuration the step needs is missing.'],
];
const hintFor = (err) => { const h = HINTS.find(([re]) => re.test(err || '')); return h ? h[1] : ''; };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const secs = (ms) => (ms < 950 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
const when = (iso) => String(iso || '').replace('T', ' ').slice(0, 16);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf-8')); } catch { return fallback; }
}

/** key = project | module | stepKey | describe | title */
const parts = (key) => { const [project, mod, stepKey, describe, ...t] = key.split('|'); return { project, mod, stepKey, describe, title: t.join('|') }; };

function loadData() {
  const runs = readJson('runs.json', []);
  const inventory = readJson('inventory.json', []);
  const latest = readJson('latest-run.json', { rows: [] });
  const notes = readJson('notes.json', { runs: {}, callouts: [] });
  return { runs, inventory, latest, notes };
}

/** Ordered list of every test known: inventory first (file order), then anything seen in runs. */
function allTests({ runs, inventory }) {
  const seen = new Map();
  for (const t of inventory) seen.set(t.key, { ...t });
  for (const r of runs) for (const k of Object.keys(r.results)) {
    if (!seen.has(k)) { const p = parts(k); seen.set(k, { key: k, ...p, placeholder: /^placeholder/i.test(p.title) }); }
  }
  return [...seen.values()];
}

function latestResult(key, runs) {
  for (let i = runs.length - 1; i >= 0; i--) if (runs[i].results[key]) return { ...runs[i].results[key], run: runs[i].label };
  return null;
}

const tally = (list) => ({
  p: list.filter(x => x === 'passed').length, f: list.filter(x => x === 'failed').length,
  s: list.filter(x => x === 'skipped').length, n: list.filter(x => !x).length,
});

// ── shared HTML bits ──────────────────────────────────────────────────────────

const WORD = { passed: 'PASS', failed: 'FAIL', skipped: 'SKIP' };
const CLS = { passed: 'ok', failed: 'bad', skipped: 'skip' };
const cellStatus = (st) => (st ? `<td class="c ${CLS[st]}">${WORD[st]}</td>` : '<td class="c none">–</td>');

const BASE_CSS = `
*{box-sizing:border-box}
body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#fff;color:#111827;line-height:1.5;padding:22px 34px 70px;max-width:1240px;margin:0 auto}
h1{font-size:30px;margin:6px 0 14px;border-bottom:2px solid #111827;padding-bottom:8px}
h2{font-size:23px;margin:34px 0 10px;border-bottom:1px solid #d1d5db;padding-bottom:6px}
h3{font-size:17px;margin:22px 0 6px}
.meta{margin:8px 0 14px}.muted{color:#6b7280;font-size:13px}code{background:#f3f4f6;border-radius:4px;padding:1px 6px;font-size:12.5px}
.call{border-left:5px solid #9ca3af;background:#f9fafb;padding:10px 16px;margin:12px 0}
.call.ok{border-color:#2e7d32;background:#ecfdf5}.call.bad{border-color:#c62828;background:#fef2f2}.call.warn{border-color:#f59e0b;background:#fffbeb}.call.info{border-color:#3b82f6;background:#eff6ff}
table{border-collapse:collapse;width:100%;font-size:14px;margin:8px 0}
th{background:#f3f4f6;text-align:left;padding:7px 10px;border:1px solid #e5e7eb}
td{padding:6px 10px;border:1px solid #e5e7eb;vertical-align:top}
td.c,th.c{text-align:center;white-space:nowrap}
td.ok{color:#2e7d32;font-weight:700}td.bad{color:#c62828;font-weight:700}td.skip{color:#e65100;font-weight:700}td.none{color:#9ca3af}
tr.grp td{background:#f3f4f6;font-weight:700}tr.tot td{font-weight:700;background:#f9fafb}
.p{color:#2e7d32;font-weight:700}.f{color:#c62828;font-weight:700}.s{color:#e65100;font-weight:700}
.chip{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:10px;padding:0 9px;font-size:12px}
.chip.ph{background:#fef3c7;color:#92400e}
details{border:1px solid #e5e7eb;border-radius:8px;margin:8px 0}details>summary{cursor:pointer;padding:8px 12px;font-weight:600;list-style:none}
details>summary::-webkit-details-marker{display:none}details.failed{border-color:#fca5a5}
.body{padding:2px 14px 12px;border-top:1px solid #e5e7eb}
table.steps td.n{width:50px;color:#6b7280}table.steps td.r{width:90px;white-space:nowrap}table.steps td.d{width:80px;white-space:nowrap;color:#6b7280}
tr.sf td{background:#fef2f2}.se{color:#c62828;font-size:12.5px}
pre{white-space:pre-wrap;word-break:break-word;background:#fef2f2;padding:10px;border-radius:6px;font-size:12.5px;max-height:240px;overflow:auto}
.hint{background:#ecfdf5;border-left:4px solid #2e7d32;padding:8px 12px;margin:8px 0;font-size:13.5px}
img{max-width:100%;border:1px solid #d1d5db;border-radius:6px;margin-top:8px}
.bar{display:flex;height:9px;border-radius:5px;overflow:hidden;background:#e5e7eb;min-width:120px}.bar i{display:block}
.boxes{display:flex;gap:12px;flex-wrap:wrap;margin:10px 0}.box{flex:1 1 130px;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;text-align:center}.box b{display:block;font-size:28px}.box span{font-size:12.5px;color:#6b7280}
a{color:#1d4ed8}
`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body>${body}</body></html>`;
}

function stepNum(stepKey) { return STEP_NO[stepKey] ? `Step ${STEP_NO[stepKey]} ` : ''; }

// ── MASTER report ─────────────────────────────────────────────────────────────

function masterReport(data, date, customName) {
  const { runs } = data;
  const tests = allTests(data);
  const status = new Map(tests.map(t => [t.key, latestResult(t.key, runs)]));
  const total = tests.length;
  const impl = tests.filter(t => !t.placeholder).length;
  const t = tally(tests.map(x => status.get(x.key)?.status));
  const mods = [...new Set(tests.map(x => x.mod))].filter(m => m !== 'setup');
  const host = (process.env.ODOO_BASE_URL || '').replace(/^https?:\/\//, '').split('/')[0];

  const stepRows = (list) => STEP_ORDER.filter(k => list.some(x => x.stepKey === k)).map(k => {
    const l = list.filter(x => x.stepKey === k);
    const x = tally(l.map(y => status.get(y.key)?.status));
    const done = l.filter(y => !y.placeholder).length;
    const pct = (n) => (l.length ? (n / l.length) * 100 : 0);
    return `<tr><td><b>${esc(stepNum(k))}${esc(STEP_LABEL[k])}</b></td><td class="c">${l.length}</td><td class="c">${done}</td>` +
      `<td class="c">${l.length - done}</td><td class="c p">${x.p}</td><td class="c f">${x.f}</td><td class="c s">${x.s}</td><td class="c">${x.n}</td>` +
      `<td><div class="bar"><i style="width:${pct(x.p)}%;background:#2e7d32"></i><i style="width:${pct(x.f)}%;background:#c62828"></i><i style="width:${pct(x.s)}%;background:#e65100"></i></div></td></tr>`;
  }).join('');

  const sections = mods.map(m => {
    const ml = tests.filter(x => x.mod === m);
    const body = STEP_ORDER.filter(k => k !== 'setup' && ml.some(x => x.stepKey === k)).map(k => {
      const l = ml.filter(x => x.stepKey === k);
      const rows = l.map((x, i) => {
        const r = status.get(x.key);
        const st = r ? r.status : null;
        return `<tr><td class="c">${i + 1}</td><td>${esc(x.title)}${x.placeholder ? ' <span class="chip ph">placeholder</span>' : ''}` +
          `${x.describe ? `<div class="muted">${esc(x.describe)}</div>` : ''}</td>` +
          `${cellStatus(st)}<td class="c muted">${esc(r ? r.run : 'not run yet')}</td><td class="muted">${esc(x.file || '')}</td></tr>`;
      }).join('');
      return `<h3>${esc(stepNum(k))}${esc(STEP_LABEL[k])} <span class="muted">— ${l.length} test case${l.length === 1 ? '' : 's'}</span></h3>` +
        `<table><tr><th class="c">#</th><th>Test case</th><th class="c">Latest result</th><th class="c">Last run</th><th>Spec file</th></tr>${rows}</table>`;
    }).join('');
    return `<h2>${esc(m.charAt(0).toUpperCase() + m.slice(1))} module — all test cases</h2>${body}`;
  }).join('');

  const customFile = customName ? `<a href="${esc(customName)}">${esc(customName)}</a>` : 'the custom run report';
  const body = `<h1>Sales Testing – Master Test Report</h1>
<div class="meta"><b>Date:</b> ${esc(date)} &nbsp;|&nbsp; <b>Environment:</b> ${esc(host || 'Odoo')} &nbsp;|&nbsp; <b>Runs recorded:</b> ${runs.length}
&nbsp;|&nbsp; <b>Modules:</b> ${esc(mods.join(', ') || '–')}</div>
<div class="call info">This is the <b>master report</b>: every test case in the project, divided by test step (Config, Business, Reporting, Permissions, Validations, Edge cases, Archive), with its latest result. The run-by-run comparison (1st run, 2nd run, …) is in ${customFile}.</div>
<div class="boxes"><div class="box"><b>${total}</b><span>test cases</span></div><div class="box"><b>${impl}</b><span>implemented</span></div>
<div class="box"><b>${total - impl}</b><span>placeholders</span></div><div class="box"><b class="p">${t.p}</b><span>passed</span></div>
<div class="box"><b class="f">${t.f}</b><span>failed</span></div><div class="box"><b class="s">${t.s}</b><span>skipped</span></div><div class="box"><b>${t.n}</b><span>not run yet</span></div></div>
<h2>Summary by test step</h2>
<table><tr><th>Test step</th><th class="c">Test cases</th><th class="c">Implemented</th><th class="c">Placeholders</th><th class="c">Passed</th><th class="c">Failed</th><th class="c">Skipped</th><th class="c">Not run yet</th><th>Progress</th></tr>${stepRows(tests.filter(x => x.stepKey !== 'setup'))}</table>
${sections}`;
  return page('Sales Testing – Master Test Report', body);
}

// ── CUSTOM run report ─────────────────────────────────────────────────────────

function autoSummary(run) {
  const entries = Object.entries(run.results);
  const f = entries.filter(([, v]) => v.status === 'failed');
  const s = entries.filter(([, v]) => v.status === 'skipped').length;
  if (!f.length) return `All ${entries.length - s} executed tests passed${s ? `; ${s} skipped` : ''}.`;
  const short = (t) => { const c = t.split(':')[0]; return (c.length > 8 ? c : t).slice(0, 60); };
  const names = f.slice(0, 3).map(([k]) => short(parts(k).title)).join('; ');
  return `${f.length} failed: ${names}${f.length > 3 ? '…' : ''}.`;
}

function renderSteps(steps, prefix = '') {
  return (steps || []).map((s, i) => {
    const num = `${prefix}${i + 1}`;
    const failed = !!s.error;
    return `<tr class="${failed ? 'sf' : ''}"><td class="n">${num}</td><td style="padding-left:${10 + (num.split('.').length - 1) * 22}px">${esc(s.title)}${failed ? `<div class="se">${esc(s.error)}</div>` : ''}</td>` +
      `<td class="r">${failed ? '❌ Failed' : '✅ Passed'}</td><td class="d">${secs(s.durationMs)}</td></tr>` + renderSteps(s.children, `${num}.`);
  }).join('');
}

function customReport(data, date, masterName) {
  const { runs, notes, latest } = data;
  const shown = runs.slice(-MAX_RUNS_SHOWN);
  const tests = allTests(data);
  const nowStatus = new Map(tests.map(t => [t.key, latestResult(t.key, runs)]));
  const now = tally(tests.map(t => nowStatus.get(t.key)?.status));
  const host = (process.env.ODOO_BASE_URL || '').replace(/^https?:\/\//, '').split('/')[0];
  const lastRun = runs[runs.length - 1];

  // 1. progress by run
  const progress = shown.map(r => {
    const x = tally(Object.values(r.results).map(v => v.status));
    const notRun = tests.filter(t => !r.results[t.key] && t.stepKey !== 'setup').length;
    const note = (notes.runs && notes.runs[r.label]) || r.note || autoSummary(r);
    return `<tr><td><b>${esc(r.label)}</b><div class="muted">${esc(when(r.startedAt))}</div></td><td class="c p">${x.p}</td><td class="c f">${x.f}</td><td class="c s">${x.s}</td><td class="c">${notRun}</td><td>${esc(note)}</td></tr>`;
  }).join('');
  const nowRow = `<tr class="tot"><td>Now (all ${tests.length})</td><td class="c p">${now.p}</td><td class="c f">${now.f}</td><td class="c s">${now.s}</td><td class="c">${now.n}</td>` +
    `<td>${now.f ? `${now.f} still failing — see section 3.` : 'No failures.'}</td></tr>`;

  // 2. every test, run by run
  const head = `<tr><th>Step</th><th>Test</th>${shown.map(r => `<th class="c">${esc(r.label.replace(' run', ''))}</th>`).join('')}<th class="c">Now</th></tr>`;
  const matrix = STEP_ORDER.filter(k => tests.some(t => t.stepKey === k)).map(k => {
    const l = tests.filter(t => t.stepKey === k);
    const rows = l.map((t, i) => {
      const cells = shown.map(r => cellStatus(r.results[t.key] ? r.results[t.key].status : null)).join('');
      const n = nowStatus.get(t.key);
      return `<tr><td class="c">${i + 1}</td><td>${esc(t.title)}${t.placeholder ? ' <span class="chip ph">placeholder</span>' : ''}</td>${cells}${cellStatus(n ? n.status : null)}</tr>`;
    }).join('');
    return `<tr class="grp"><td colspan="${3 + shown.length}">${esc(stepNum(k))}${esc(STEP_LABEL[k])}</td></tr>${rows}`;
  }).join('');

  // 3. open items (latest known failing)
  const rowsByKey = new Map((latest.rows || []).map(r => [r.key, r]));
  const open = tests.filter(t => nowStatus.get(t.key)?.status === 'failed');
  const openRows = open.map(t => {
    const n = nowStatus.get(t.key);
    const det = rowsByKey.get(t.key);
    const err = (det && det.error) || n.error || '';
    return `<tr><td><b>${esc(t.title)}</b><div class="muted">${esc(stepNum(t.stepKey))}${esc(STEP_LABEL[t.stepKey])}</div></td>` +
      `<td>${esc(err.split('\n')[0].slice(0, 220))}</td><td>${esc(hintFor(err) || 'Open the step detail in section 4 and the screenshot for this test.')}</td></tr>`;
  }).join('');

  // 4. latest run detail
  const rows = latest.rows || [];
  const detail = STEP_ORDER.filter(k => rows.some(r => r.stepKey === k)).map(k => {
    const l = rows.filter(r => r.stepKey === k);
    const items = l.map(r => {
      const st = r.status;
      const why = (r.annotations || []).find(a => a.type === 'skip');
      const steps = (r.steps || []).length
        ? `<table class="steps"><tr><th>#</th><th>Step</th><th>Result</th><th>Time</th></tr>${renderSteps(r.steps)}</table>`
        : '<p class="muted">No named steps recorded.</p>';
      const err = r.error ? `<pre>${esc(r.error.slice(0, 1800))}</pre>${hintFor(r.error) ? `<div class="hint"><b>How to pass:</b> ${esc(hintFor(r.error))}</div>` : ''}${r.screenshot ? `<img src="${r.screenshot}" alt="failure screenshot">` : ''}` : '';
      const notes2 = (r.annotations || []).filter(a => a.type !== 'skip' && a.description).map(a => `<span class="chip">${esc(a.type)}: ${esc(a.description)}</span>`).join(' ');
      return `<details class="${st}"${st === 'failed' ? ' open' : ''}><summary>${st === 'passed' ? '✅' : st === 'failed' ? '❌' : '⏭'} ${esc(r.title)} <span class="muted">— ${WORD[st]} · ${secs(r.durationMs)}</span></summary>` +
        `<div class="body">${r.describe ? `<div class="muted">${esc(r.describe)}</div>` : ''}${notes2}${why ? `<div class="call warn">${esc(why.description)}</div>` : ''}${steps}${err}</div></details>`;
    }).join('');
    return `<h3>${esc(stepNum(k))}${esc(STEP_LABEL[k])}</h3>${items}`;
  }).join('');

  const callouts = (notes.callouts || []).map(c => `<div class="call ${esc(c.kind || 'info')}">${c.html || ''}</div>`).join('');
  const masterLink = masterName ? `<a href="${esc(masterName)}">${esc(masterName)}</a>` : 'the master report';
  const label = lastRun ? lastRun.label : 'latest run';

  const body = `<h1>Sales Testing – Custom Run Report (${esc(label)})</h1>
<div class="meta"><b>Repo:</b> odoo-playwright-tests (module <code>sales</code>) &nbsp;|&nbsp; <b>Date:</b> ${esc(date)} &nbsp;|&nbsp; <b>Environment:</b> ${esc(host || 'Odoo')} &nbsp;|&nbsp; <b>Runs recorded:</b> ${runs.length}</div>
<div class="muted">"Now" = the latest result of every test. The full list of test cases by step is in the master report: ${masterLink}.</div>
<div class="call ok"><b>Now: <span class="p">${now.p} passed</span>, <span class="f">${now.f} failed</span>, <span class="s">${now.s} skipped</span></b>${now.n ? `, ${now.n} not run yet` : ''} out of ${tests.length} test cases.</div>
${callouts}
<h2>1. Progress by run</h2>
<table><tr><th>Run</th><th class="c">Passed</th><th class="c">Failed</th><th class="c">Skipped</th><th class="c">Not run</th><th>What happened</th></tr>${progress}${nowRow}</table>
<h2>2. Every test, run by run</h2>
<table>${head}${matrix}</table>
<h2>3. Open items — what still fails and how to make it pass</h2>
${open.length ? `<table><tr><th>Test</th><th>Result</th><th>How to make it pass</th></tr>${openRows}</table>` : '<div class="call ok">Nothing open: no test is failing.</div>'}
<h2>4. Step by step — latest run (${esc(label)})</h2>
<div class="muted">Each test lists the named steps that ran, which step failed, Odoo's error, and the failure screenshot.</div>
${detail || '<p class="muted">No run detail saved yet.</p>'}`;
  return page(`Sales Testing – Custom Run Report (${label})`, body);
}

// ── main ──────────────────────────────────────────────────────────────────────

function generate() {
  const data = loadData();
  if (!data.runs.length && !data.inventory.length) { console.log('No run history yet — nothing to report.'); return null; }
  const last = data.runs[data.runs.length - 1];
  const date = (last ? last.startedAt : new Date().toISOString()).slice(0, 10);
  const masterName = `master-test-report-${date}.html`;
  const customName = `custom-run-report-${date}.html`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, masterName), masterReport(data, date, customName), 'utf-8');
  fs.writeFileSync(path.join(OUT, customName), customReport(data, date, masterName), 'utf-8');
  console.log(`\nMaster report: ${path.join(OUT, masterName)}\nCustom run report: ${path.join(OUT, customName)}`);
  return { master: path.join(OUT, masterName), custom: path.join(OUT, customName) };
}

module.exports = { generate };
if (require.main === module) generate();
