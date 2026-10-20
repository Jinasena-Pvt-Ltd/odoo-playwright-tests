// Builds a self-contained HTML bug report from reports/sales-flow-bugs-<date>.json
// (written by src/modules/sales/flows/BugLog.ts). Screenshots are embedded, so the file can be shared as-is.
// Usage: node scripts/generate-flow-report.js [path-to-json]   (default: newest reports/sales-flow-bugs-*.json)

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportsDir = path.join(root, 'reports');

let jsonPath = process.argv[2];
if (!jsonPath) {
  const files = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir).filter((f) => /^sales-flow-bugs-.*\.json$/.test(f)).sort()
    : [];
  if (!files.length) { console.error('No reports/sales-flow-bugs-*.json found. Run npm run test:sales-flows first.'); process.exit(1); }
  jsonPath = path.join(reportsDir, files[files.length - 1]);
}
const { bugs, passed, notes = [] } = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
const outPath = jsonPath.replace(/\.json$/, '.html');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Strip Playwright's ANSI colour codes from error text.
const clean = (s) => String(s).replace(/\u001b\[[0-9;]*m/g, '');
const count = (sev) => bugs.filter((b) => b.severity === sev).length;

const groups = [...new Set(bugs.map((b) => b.group))];
const flows = [...new Set(passed.map((p) => p.split(' / ').slice(0, 2).join(' / ')))];

const card = (b) => {
  let img = '';
  if (b.screenshot && fs.existsSync(b.screenshot)) {
    img = `<img alt="screenshot for ${esc(b.id)}" src="data:image/png;base64,${fs.readFileSync(b.screenshot).toString('base64')}">`;
  }
  return `
  <section id="${esc(b.id)}" class="bug sev-${esc(b.severity)}" data-sev="${esc(b.severity)}" data-group="${esc(b.group)}">
    <h3><span class="id">${esc(b.id)}</span>${esc(b.title)}<span class="badge ${esc(b.severity)}">${esc(b.severity)}</span></h3>
    <table class="meta">
      <tr><th>Customer Group</th><td>${esc(b.group)}</td><th>Flow</th><td>${esc(b.flow)}</td></tr>
      <tr><th>Step</th><td colspan="3">${esc(b.step)}</td></tr>
    </table>
    <p class="label">What Odoo / the test reported</p>
    <pre>${esc(clean(b.detail))}</pre>
    ${img}
  </section>`;
};


// ── Every test case, one row each: PASS (from `passed`), FAIL (bugs) and STOPPED (notes) ──
const cases = [];
for (const p of passed) {
  const parts = p.split(' / ');
  if (parts.length < 3) continue;
  const group = parts[0], flow = parts[1], rest = parts.slice(2).join(' / ');
  const m = rest.match(/^(.*?)(?::\s(.*))?$/);
  cases.push({ group, flow, step: m[1], status: 'PASS', detail: m[2] || '', bug: '' });
}
for (const b of bugs) {
  for (const g of String(b.group).split(', ')) {
    cases.push({ group: g, flow: b.flow, step: b.step, status: b.severity === 'Info' ? 'INFO' : 'FAIL',
      detail: b.title, bug: b.id });
  }
}
for (const n of notes) {
  cases.push({ group: n.group, flow: n.flow, step: n.step, status: 'STOPPED', detail: clean(n.text), bug: '' });
}
const groupOrder = [...new Set(cases.map((c) => c.group))];
const stepNo = (t) => { const m = String(t).match(/^(\d+)/); return m ? Number(m[1]) : 99; };
cases.sort((a, b) =>
  groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) ||
  a.flow.localeCompare(b.flow) || stepNo(a.step) - stepNo(b.step) || a.step.localeCompare(b.step));
const caseCount = (st) => cases.filter((c) => c.status === st).length;
const casesHtml = cases.map((c) => `
    <tr class="case ${c.status}" data-status="${c.status}" data-group="${esc(c.group)}">
      <td>${esc(c.group)}</td><td>${esc(c.flow)}</td><td>${esc(c.step)}</td>
      <td><span class="st ${c.status}">${c.status === 'STOPPED' ? 'STOPPED (not a bug)' : c.status}</span></td>
      <td>${esc(c.detail)}${c.bug ? ` <a href="#${esc(c.bug)}">${esc(c.bug)}</a>` : ''}</td>
    </tr>`).join('');
const groupOptions = groupOrder.map((g) => `<option>${esc(g)}</option>`).join('');

const notesHtml = notes.length
  ? '<ul>' + notes.map((n) => `<li><b>${esc(n.group)} / ${esc(n.flow)} / ${esc(n.step)}:</b> ${esc(clean(n.text))}</li>`).join('') + '</ul>'
  : '<p>None.</p>';
const passedRows = passed.map((p) => `<li>${esc(p)}</li>`).join('\n');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sales Flow Bug Report</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f6f7f9; color: #1a1a1a; margin: 0; padding: 0 0 4rem; font-size: 18px; line-height: 1.55; }
  header { background: #714B67; color: #fff; padding: 2.5rem 2rem; }
  header h1 { margin: 0 0 .5rem; font-size: 2.3rem; font-weight: 800; }
  header p { margin: 0; opacity: .95; }
  main { max-width: 1100px; margin: 0 auto; padding: 2rem; }
  .summary { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; }
  .tile { background: #fff; border: 1px solid #e3e3e3; border-radius: 10px; padding: 1rem 1.4rem; min-width: 130px; }
  .tile b { display: block; font-size: 2.2rem; line-height: 1.1; }
  .tile.High b { color: #c62828; } .tile.Medium b { color: #e65100; } .tile.Info b { color: #1565c0; } .tile.pass b { color: #2e7d32; }
  .filters { margin: 1rem 0 1.5rem; display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  .filters button { font-size: 1rem; padding: .4rem .9rem; border: 1px solid #bbb; background: #fff; border-radius: 999px; cursor: pointer; }
  .filters button.on { background: #714B67; color: #fff; border-color: #714B67; }
  .bug { background: #fff; border: 1px solid #e3e3e3; border-left: 8px solid #999; border-radius: 10px; padding: 1.4rem 1.6rem; margin-bottom: 1.6rem; box-shadow: 0 2px 6px rgba(0,0,0,.06); }
  .bug.sev-High { border-left-color: #c62828; } .bug.sev-Medium { border-left-color: #ef6c00; } .bug.sev-Low { border-left-color: #f9a825; } .bug.sev-Info { border-left-color: #1565c0; }
  .bug h3 { margin: 0 0 .8rem; font-size: 1.35rem; display: flex; flex-wrap: wrap; gap: .7rem; align-items: center; }
  .id { background: #eee; border-radius: 6px; padding: .1rem .55rem; font-size: 1rem; font-family: monospace; }
  .badge { font-size: .85rem; color: #fff; border-radius: 999px; padding: .1rem .8rem; margin-left: auto; }
  .badge.High { background: #c62828; } .badge.Medium { background: #ef6c00; } .badge.Low { background: #f9a825; } .badge.Info { background: #1565c0; }
  table.meta { border-collapse: collapse; width: 100%; margin-bottom: .6rem; }
  table.meta th { text-align: left; background: #f5f5f5; width: 150px; padding: .4rem .7rem; border: 1px solid #e3e3e3; font-size: .95rem; }
  table.meta td { padding: .4rem .7rem; border: 1px solid #e3e3e3; }
  .label { font-weight: 700; margin: .8rem 0 .3rem; }
  pre { background: #fff8e1; border: 1px solid #ffe0a3; border-radius: 6px; padding: .8rem 1rem; white-space: pre-wrap; word-break: break-word; font-size: .95rem; margin: 0 0 1rem; }
  img { max-width: 100%; border: 2px solid #ccc; border-radius: 8px; display: block; }
  details { background: #fff; border: 1px solid #e3e3e3; border-radius: 10px; padding: 1rem 1.4rem; margin-top: 2rem; }
  details summary { font-weight: 700; cursor: pointer; font-size: 1.15rem; }
  table.cases { border-collapse: collapse; width: 100%; background: #fff; font-size: .95rem; }
  table.cases th { background: #714B67; color: #fff; text-align: left; padding: .5rem .7rem; position: sticky; top: 0; }
  table.cases td { border-bottom: 1px solid #e3e3e3; padding: .45rem .7rem; vertical-align: top; }
  .st { border-radius: 999px; padding: .1rem .7rem; color: #fff; font-size: .8rem; white-space: nowrap; font-weight: 700; }
  .st.PASS { background: #2e7d32; } .st.FAIL { background: #c62828; } .st.INFO { background: #1565c0; } .st.STOPPED { background: #6d6d6d; }
  tr.case.FAIL td { background: #fff3f3; }
  .toolbar { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; margin: 1rem 0; }
  .toolbar select, .toolbar input { font-size: 1rem; padding: .35rem .6rem; border: 1px solid #bbb; border-radius: 6px; }
  footer { max-width: 1100px; margin: 0 auto; padding: 0 2rem; color: #888; font-size: .9rem; }
</style></head>
<body>
<header>
  <h1>Sales Flow Bug Report</h1>
  <p>Cash and Credit flows, walked step by step for every Customer Group &middot; generated ${esc(new Date().toLocaleString())}</p>
</header>
<main>
  <div class="summary">
    <div class="tile pass"><b>${passed.length}</b>steps / checks passed</div>
    <div class="tile"><b>${bugs.length}</b>issues found</div>
    <div class="tile High"><b>${count('High')}</b>High (Odoo error)</div>
    <div class="tile Medium"><b>${count('Medium')}</b>Medium (blocked / review)</div>
    <div class="tile"><b>${count('Low')}</b>Low</div>
    <div class="tile Info"><b>${count('Info')}</b>Info (data / config)</div>
  </div>
  <p><b>High</b> = Odoo showed an error or blocked the flow. <b>Medium</b> = a step could not be completed and a person must confirm the cause. <b>Info</b> = data or configuration observation.</p>


  <h2>All test cases (${cases.length})</h2>
  <div class="summary">
    <div class="tile pass"><b>${caseCount('PASS')}</b>PASS</div>
    <div class="tile High"><b>${caseCount('FAIL')}</b>FAIL</div>
    <div class="tile"><b>${caseCount('STOPPED')}</b>Stopped (not a bug)</div>
    <div class="tile Info"><b>${caseCount('INFO')}</b>Info</div>
  </div>
  <div class="toolbar">
    <label>Customer Group <select id="fGroup"><option value="">All</option>${groupOptions}</select></label>
    <label>Result <select id="fStatus"><option value="">All</option><option>PASS</option><option>FAIL</option><option>STOPPED</option><option>INFO</option></select></label>
    <label>Search <input id="fText" placeholder="step or text"></label>
    <span id="fCount"></span>
  </div>
  <table class="cases"><thead><tr><th>Customer Group</th><th>Flow</th><th>Test case / step</th><th>Result</th><th>Details</th></tr></thead>
  <tbody id="caseRows">${casesHtml}</tbody></table>

  <h2 style="margin-top:2.5rem">Issues found (${bugs.length})</h2>
  <div class="filters" id="filters">
    <span>Show:</span>
    <button data-sev="all" class="on">All</button>
    ${['High', 'Medium', 'Low', 'Info'].map((s) => `<button data-sev="${s}">${s}</button>`).join('')}
  </div>

  ${bugs.length ? bugs.map(card).join('\n') : '<p><b>No bugs found.</b></p>'}

  <details open>
    <summary>Flow stopped here &mdash; not a bug (${notes.length})</summary>
    ${notesHtml}
  </details>

  <details>
    <summary>Steps that passed (${passed.length})</summary>
    <ul>${passedRows}</ul>
  </details>
</main>
<footer>Source: ${esc(path.basename(jsonPath))} &middot; ${groups.length} group(s) with findings &middot; ${flows.length} flow(s) executed</footer>
<script>
  document.getElementById('filters').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    document.querySelectorAll('#filters button').forEach(function (x) { x.classList.toggle('on', x === b); });
    var sev = b.getAttribute('data-sev');
    document.querySelectorAll('.bug').forEach(function (s) { s.style.display = (sev === 'all' || s.dataset.sev === sev) ? '' : 'none'; });
  });

  (function () {
    var g = document.getElementById('fGroup'), st = document.getElementById('fStatus'), t = document.getElementById('fText'), n = document.getElementById('fCount');
    function apply() {
      var shown = 0, q = t.value.toLowerCase();
      document.querySelectorAll('#caseRows tr').forEach(function (r) {
        var ok = (!g.value || r.dataset.group === g.value) && (!st.value || r.dataset.status === st.value) && (!q || r.textContent.toLowerCase().indexOf(q) > -1);
        r.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      n.textContent = shown + ' shown';
    }
    [g, st].forEach(function (e) { e.addEventListener('change', apply); }); t.addEventListener('input', apply); apply();
  })();
</script>
</body></html>`;

fs.writeFileSync(outPath, html, 'utf-8');
console.log('HTML report: ' + outPath);
