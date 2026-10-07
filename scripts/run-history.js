#!/usr/bin/env node
/**
 * Run-history report: shows, for every test, what passed / failed / was skipped in run 1, run 2, run 3 ...
 *
 *   node scripts/run-history.js record [--results <file>] [--label "text"] [--module sales]
 *       Reads a Playwright JSON result file (default: test-results/results.json), appends it to the
 *       history as the next run, then rebuilds the HTML report.
 *   node scripts/run-history.js report
 *       Rebuilds the HTML report from the stored history only.
 *
 * Data:   reports/run-history/history.json
 * Report: reports/run-history-report.html   (self-contained, no internet needed)
 *
 * --results may also point at a console log that ends with the JSON reporter's output.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HIST_DIR = path.join(ROOT, 'reports', 'run-history');
const HIST_FILE = path.join(HIST_DIR, 'history.json');
const HTML_FILE = path.join(ROOT, 'reports', 'run-history-report.html');
const STEP_ORDER = ['config', 'business', 'reporting', 'permissions', 'validations', 'edge', 'archive'];
const STEP_FOLDER = {
  '01-config': 'config', '02-business': 'business', '03-reporting': 'reporting', '04-permissions': 'permissions',
  '05-validations': 'validations', '06-edge-cases': 'edge', '07-archive': 'archive',
};
const STEP_LABEL = {
  config: 'Step 1 — Configuration', business: 'Step 2 — Business Logic', reporting: 'Step 3 — Reporting',
  permissions: 'Step 4 — Permissions', validations: 'Step 5 — Validations', edge: 'Step 6 — Edge Cases',
  archive: 'Step 7 — Archive', other: 'Other',
};

// ── helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stripAnsi = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '');
const cleanTitle = (s) => String(s).replace(/\s@[\w:-]+/g, '').trim();
const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };

function readJsonLike(file) {
  const text = fs.readFileSync(file, 'utf8');
  try { return JSON.parse(text); } catch { /* maybe a console log that ends with the JSON report */ }
  const start = text.indexOf('{\n  "config"');
  if (start < 0) throw new Error(`No Playwright JSON found in ${file}`);
  return JSON.parse(text.slice(start));
}

function mapStatus(test, last) {
  if (test.status === 'skipped' || (last && last.status === 'skipped')) return 'SKIP';
  if (!last) return 'NOTRUN';
  if (last.status === 'passed') return 'PASS';
  return 'FAIL'; // failed, timedOut, interrupted
}

/** Walks the Playwright JSON tree and returns { key: testRecord } for module tests (setup project excluded). */
function collect(report, onlyModule) {
  const out = {};
  const walk = (suite, chain, isFile) => {
    const nextChain = isFile ? chain : chain.concat(suite.title);
    for (const sp of suite.specs || []) {
      for (const t of sp.tests || []) {
        if (t.projectName === 'setup') continue;
        const file = (sp.file || suite.file || '').replace(/\\/g, '/');
        const modMatch = file.match(/modules\/([^/]+)\//);
        if (onlyModule && (!modMatch || modMatch[1] !== onlyModule)) continue;
        const folder = (file.match(/tests\/([^/]+)\//) || [])[1];
        const describe = nextChain.join(' › ');
        const stepTag = (describe.match(/@step:([\w-]+)/) || [])[1];
        const step = STEP_FOLDER[folder] || stepTag || 'other';
        const last = (t.results || [])[(t.results || []).length - 1];
        const status = mapStatus(t, last);
        const err = last && last.error ? stripAnsi(last.error.message || '').split('\n').filter(Boolean).slice(0, 4).join(' ⏎ ').slice(0, 400) : '';
        const key = `${file} :: ${describe} › ${sp.title}`;
        out[key] = {
          title: cleanTitle(sp.title), group: cleanTitle(describe), step, file, status,
          durationMs: last ? last.duration : 0,
          error: status === 'FAIL' ? err : '',
          flaky: t.status === 'flaky',
        };
      }
    }
    for (const child of suite.suites || []) walk(child, nextChain, false);
  };
  for (const top of report.suites || []) walk(top, [], true);
  return out;
}

function counts(tests) {
  const c = { PASS: 0, FAIL: 0, SKIP: 0, NOTRUN: 0 };
  Object.values(tests).forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
  return c;
}

function loadHistory() {
  if (!fs.existsSync(HIST_FILE)) return { runs: [] };
  return JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
}
function saveHistory(h) {
  fs.mkdirSync(HIST_DIR, { recursive: true });
  fs.writeFileSync(HIST_FILE, JSON.stringify(h, null, 2), 'utf8');
}

// ── record ───────────────────────────────────────────────────────────────────
function record() {
  const file = path.resolve(ROOT, arg('--results') || 'test-results/results.json');
  if (!fs.existsSync(file)) throw new Error(`Result file not found: ${file}`);
  const report = readJsonLike(file);
  const tests = collect(report, arg('--module'));
  if (Object.keys(tests).length === 0) throw new Error('No tests found in the result file (check --module).');
  // --overrides <file.json>: rebuild a past run from notes. The result file is only used for the list of tests;
  // statuses come from rules: { "default": "NOTRUN", "rules": [ { "match": "regex on test title", "status": "PASS|FAIL|SKIP", "error": "text" } ] }
  const overridesFile = arg('--overrides');
  if (overridesFile) {
    const ov = JSON.parse(fs.readFileSync(path.resolve(ROOT, overridesFile), 'utf8'));
    const rules = (ov.rules || []).map((r) => ({ ...r, re: new RegExp(r.match, 'i') }));
    Object.values(tests).forEach((t) => {
      const rule = rules.find((r) => r.re.test(t.title));
      t.status = rule ? rule.status : (ov.default || 'NOTRUN');
      t.error = rule && rule.status === 'FAIL' ? (rule.error || '') : '';
      t.durationMs = rule && rule.durationMs ? rule.durationMs : 0;
      t.flaky = false;
    });
  }
  const history = loadHistory();
  const id = history.runs.length ? history.runs[history.runs.length - 1].id + 1 : 1;
  history.runs.push({
    id,
    at: arg('--at') || (report.stats && report.stats.startTime) || new Date().toISOString(),
    durationMs: overridesFile ? 0 : ((report.stats && report.stats.duration) || 0),
    label: arg('--label') || `Run ${id}`,
    source: path.basename(file),
    reconstructed: process.argv.includes('--reconstructed'),
    tests,
  });
  saveHistory(history);
  console.log(`Recorded run ${id}: ${JSON.stringify(counts(tests))}`);
}

// ── report ───────────────────────────────────────────────────────────────────
function trend(statuses) {
  const n = statuses.length;
  const last = statuses[n - 1];
  const prev = n > 1 ? statuses[n - 2] : undefined;
  if (last === 'NOTRUN') return { text: 'Not run in the latest run', cls: 'muted' };
  if (last === 'SKIP') return { text: 'Skipped', cls: 'skip' };
  if (last === 'PASS') {
    let firstOfStreak = n - 1;
    while (firstOfStreak > 0 && statuses[firstOfStreak - 1] === 'PASS') firstOfStreak--;
    if (firstOfStreak === 0) return { text: n > 1 ? 'Always passing' : 'Passing', cls: 'pass' };
    const before = statuses[firstOfStreak - 1];
    if (before === 'FAIL') return { text: `Fixed in run ${firstOfStreak + 1}`, cls: 'fixed' };
    return { text: 'Passing', cls: 'pass' };
  }
  // FAIL
  if (prev === 'PASS') return { text: 'Regressed (passed before)', cls: 'fail' };
  if (n === 1) return { text: 'Failing', cls: 'fail' };
  return { text: 'Still failing', cls: 'fail' };
}

function badge(t, runIdx) {
  if (!t) return '<span class="b none">—</span>';
  const s = t.status;
  const label = { PASS: 'PASS', FAIL: 'FAIL', SKIP: 'SKIP', NOTRUN: 'NOT RUN' }[s];
  const cls = { PASS: 'pass', FAIL: 'fail', SKIP: 'skip', NOTRUN: 'none' }[s];
  const dur = t.durationMs ? ` <span class="dur">${(t.durationMs / 1000).toFixed(0)}s</span>` : '';
  if (s === 'FAIL' && t.error) {
    return `<details class="fd"><summary><span class="b ${cls}">${label}</span>${dur}</summary><div class="why">${esc(t.error)}</div></details>`;
  }
  return `<span class="b ${cls}">${label}</span>${s === 'PASS' ? dur : ''}${t.flaky ? ' <span class="dur">flaky</span>' : ''}`;
}

function report() {
  const history = loadHistory();
  if (history.runs.length === 0) throw new Error('No runs recorded yet. Run: node scripts/run-history.js record');
  const runs = history.runs;
  let pkg = 'Odoo E2E';
  try { pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name || pkg; } catch { /* ignore */ }

  // union of tests in first-seen order
  const keys = [];
  const meta = {};
  runs.forEach((r) => Object.entries(r.tests).forEach(([k, t]) => { if (!meta[k]) { meta[k] = t; keys.push(k); } }));

  const perRunCounts = runs.map((r) => counts(r.tests));
  const maxTotal = Math.max(...perRunCounts.map((c) => c.PASS + c.FAIL + c.SKIP + c.NOTRUN), 1);

  // ── run summary cards
  const cards = runs.map((r, i) => {
    const c = perRunCounts[i];
    const total = c.PASS + c.FAIL + c.SKIP + c.NOTRUN;
    const ran = c.PASS + c.FAIL;
    const rate = ran ? Math.round((c.PASS / ran) * 100) : 0;
    const prev = i > 0 ? perRunCounts[i - 1] : null;
    const delta = prev ? c.PASS - prev.PASS : null;
    const deltaTxt = delta === null ? '' : `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} passing vs run ${runs[i - 1].id}</span>`;
    const w = (n) => (n / maxTotal) * 100;
    return `<div class="card">
      <div class="card-h">Run ${r.id}${r.reconstructed ? ' <span class="tag">reconstructed</span>' : ''}</div>
      <div class="card-sub">${esc(r.label)}</div>
      <div class="card-sub">${esc(new Date(r.at).toLocaleString())}${r.durationMs ? ' · ' + Math.round(r.durationMs / 60000) + ' min' : ''}</div>
      <div class="bar"><i class="p" style="width:${w(c.PASS)}%"></i><i class="f" style="width:${w(c.FAIL)}%"></i><i class="s" style="width:${w(c.SKIP)}%"></i><i class="n" style="width:${w(c.NOTRUN)}%"></i></div>
      <div class="nums"><b class="t-pass">${c.PASS}</b> passed · <b class="t-fail">${c.FAIL}</b> failed · <b class="t-skip">${c.SKIP}</b> skipped${c.NOTRUN ? ` · <b>${c.NOTRUN}</b> not run` : ''}</div>
      <div class="rate">${rate}% of executed tests passed ${deltaTxt}</div>
      <div class="card-sub">${total} tests listed</div>
    </div>`;
  }).join('');

  // ── what changed between consecutive runs
  const changes = runs.slice(1).map((r, idx) => {
    const p = runs[idx];
    const fixed = [], broke = [], still = [];
    keys.forEach((k) => {
      const a = p.tests[k] && p.tests[k].status, b = r.tests[k] && r.tests[k].status;
      if (a === 'FAIL' && b === 'PASS') fixed.push(k);
      else if (a === 'PASS' && b === 'FAIL') broke.push(k);
      else if (a === 'FAIL' && b === 'FAIL') still.push(k);
    });
    const li = (arr, cls) => arr.length ? `<ul>${arr.map((k) => `<li class="${cls}">${esc(meta[k].title)}</li>`).join('')}</ul>` : '<p class="muted">None</p>';
    return `<div class="chg"><h3>Run ${p.id} → Run ${r.id}</h3>
      <div class="cols"><div><h4 class="t-pass">Fixed (${fixed.length})</h4>${li(fixed, 'ok')}</div>
      <div><h4 class="t-fail">New failures (${broke.length})</h4>${li(broke, 'bad')}</div>
      <div><h4>Still failing (${still.length})</h4>${li(still, 'bad')}</div></div></div>`;
  }).join('');

  // ── step-by-step matrix
  const byStep = {};
  keys.forEach((k) => { (byStep[meta[k].step] = byStep[meta[k].step] || []).push(k); });
  const stepOrder = STEP_ORDER.filter((s) => byStep[s]).concat(Object.keys(byStep).filter((s) => !STEP_ORDER.includes(s)));
  const head = `<tr><th class="tcol">Test</th>${runs.map((r) => `<th>Run ${r.id}</th>`).join('')}<th>Trend</th></tr>`;
  const stepBlocks = stepOrder.map((s) => {
    const rows = byStep[s].map((k) => {
      const sts = runs.map((r) => (r.tests[k] ? r.tests[k].status : 'NOTRUN'));
      const tr = trend(sts);
      return `<tr><td class="tcol">${esc(meta[k].title)}</td>${runs.map((r) => `<td>${badge(r.tests[k], r.id)}</td>`).join('')}<td><span class="tr ${tr.cls}">${esc(tr.text)}</span></td></tr>`;
    }).join('');
    const sc = runs.map((r) => {
      const ks = byStep[s].filter((k) => r.tests[k]);
      const p = ks.filter((k) => r.tests[k].status === 'PASS').length;
      return `${p}/${ks.length}`;
    });
    return `<section><h2>${esc(STEP_LABEL[s] || s)} <span class="muted">· passing per run: ${sc.map((x, i) => `run ${runs[i].id}: ${x}`).join(' · ')}</span></h2>
      <table>${head}${rows}</table></section>`;
  }).join('');

  // ── failure reasons per run
  const reasons = runs.map((r) => {
    const fails = keys.filter((k) => r.tests[k] && r.tests[k].status === 'FAIL');
    const body = fails.length
      ? fails.map((k) => `<tr><td class="tcol">${esc(meta[k].title)}</td><td>${esc(r.tests[k].error || '(no message)')}</td></tr>`).join('')
      : '<tr><td colspan="2" class="muted">No failures in this run.</td></tr>';
    return `<h3>Run ${r.id} — ${esc(r.label)}</h3><table><tr><th class="tcol">Failed test</th><th>Reason (from the test output)</th></tr>${body}</table>`;
  }).join('');

  const notes = runs.filter((r) => r.reconstructed).map((r) => `Run ${r.id} was reconstructed from the console output of that run (it was stopped before the last tests executed, which show as NOT RUN).`);

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pkg)} — Test Run History</title>
<style>
  :root{--pass:#2e7d32;--fail:#c62828;--skip:#e65100;--ink:#1f2937;--line:#e5e7eb;--bg:#f8fafc}
  *{box-sizing:border-box} body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:var(--bg);color:var(--ink)}
  header{background:#0f172a;color:#fff;padding:28px 40px} header h1{margin:0 0 6px;font-size:26px} header p{margin:0;color:#cbd5e1}
  main{max-width:1250px;margin:0 auto;padding:24px 28px 60px}
  h2{margin:34px 0 10px;font-size:19px;border-bottom:2px solid var(--line);padding-bottom:6px} h3{margin:22px 0 8px} h4{margin:6px 0}
  .cards{display:flex;flex-wrap:wrap;gap:16px} .card{flex:1 1 260px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
  .card-h{font-size:18px;font-weight:700} .card-sub{color:#6b7280;font-size:12.5px;margin:2px 0}
  .bar{display:flex;height:12px;border-radius:6px;overflow:hidden;background:#e5e7eb;margin:12px 0 8px} .bar i{display:block;height:100%}
  .bar .p{background:var(--pass)} .bar .f{background:var(--fail)} .bar .s{background:#f59e0b} .bar .n{background:#9ca3af}
  .nums{font-size:14px} .rate{font-size:13px;margin:4px 0;color:#374151}
  .t-pass{color:var(--pass)} .t-fail{color:var(--fail)} .t-skip{color:var(--skip)}
  .delta{font-weight:700;margin-left:6px} .delta.up{color:var(--pass)} .delta.down{color:var(--fail)}
  .tag{font-size:11px;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 6px;vertical-align:middle}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--line);margin:8px 0 4px;font-size:13.5px}
  th,td{border:1px solid var(--line);padding:8px 10px;vertical-align:top;text-align:left} th{background:#f1f5f9}
  td.tcol,th.tcol{width:38%} td:not(.tcol),th:not(.tcol){text-align:center}
  .b{display:inline-block;min-width:58px;text-align:center;border-radius:5px;padding:2px 8px;font-weight:700;font-size:12px;color:#fff}
  .b.pass{background:var(--pass)} .b.fail{background:var(--fail)} .b.skip{background:#f59e0b} .b.none{background:#9ca3af}
  .dur{color:#6b7280;font-size:11.5px} .muted{color:#6b7280;font-weight:400;font-size:13px}
  details.fd summary{cursor:pointer;list-style:none} details.fd summary::-webkit-details-marker{display:none}
  .why{margin-top:6px;text-align:left;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px;font-size:12px;color:#7f1d1d;white-space:pre-wrap;word-break:break-word;min-width:220px}
  .tr{font-weight:700;font-size:12.5px} .tr.pass{color:var(--pass)} .tr.fixed{color:#1565c0} .tr.fail{color:var(--fail)} .tr.skip{color:var(--skip)} .tr.muted{color:#6b7280}
  .chg{background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px 16px 12px;margin:12px 0} .cols{display:flex;gap:24px;flex-wrap:wrap} .cols>div{flex:1 1 280px}
  ul{margin:4px 0;padding-left:20px} li.ok::marker{color:var(--pass)} li.bad::marker{color:var(--fail)}
  .note{background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin:14px 0;font-size:13px}
  .legend span{margin-right:14px;font-size:13px}
  @media print{details.fd .why{display:block}}
</style></head><body>
<header><h1>Test Run History</h1><p>${esc(pkg)} · ${runs.length} run${runs.length > 1 ? 's' : ''} recorded · generated ${esc(new Date().toLocaleString())}</p></header>
<main>
  <h2>Progress by run</h2>
  <div class="cards">${cards}</div>
  ${notes.map((n) => `<div class="note">${esc(n)}</div>`).join('')}
  <div class="legend" style="margin-top:14px"><span><span class="b pass">PASS</span> passed</span><span><span class="b fail">FAIL</span> failed (click it to see why)</span><span><span class="b skip">SKIP</span> skipped on purpose</span><span><span class="b none">NOT RUN</span> did not execute</span></div>

  ${runs.length > 1 ? `<h2>What changed between runs</h2>${changes}` : ''}

  <h2>Step by step — every test in every run</h2>
  ${stepBlocks}

  <h2>Why tests failed, run by run</h2>
  ${reasons}
</main></body></html>`;

  fs.mkdirSync(path.dirname(HTML_FILE), { recursive: true });
  fs.writeFileSync(HTML_FILE, html, 'utf8');
  console.log(`Report written: ${HTML_FILE}`);
}

// ── main ─────────────────────────────────────────────────────────────────────
const cmd = process.argv[2];
try {
  if (cmd === 'record') { record(); report(); }
  else if (cmd === 'report') report();
  else { console.log('Usage: node scripts/run-history.js record [--results file] [--label "text"] [--module sales] | report'); process.exit(cmd ? 1 : 0); }
} catch (e) { console.error('run-history:', e.message); process.exit(1); }
