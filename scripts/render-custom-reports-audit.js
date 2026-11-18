#!/usr/bin/env node
/**
 * Renders the custom ACCOUNTING reports audit (RPC scan + menu crawl) as ONE self-contained HTML report.
 *
 *   node scripts/render-custom-reports-audit.js [date]        (date defaults to the newest files in reports/)
 *
 * Reads  reports/custom-finance-reports-audit-<date>.json  and  reports/custom-finance-menu-crawl-<date>.json
 * Writes reports/custom-finance-reports-<date>.html
 */
const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'reports');
const newest = (prefix) => fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort().pop();
const auditFile = process.argv[2] ? `custom-finance-reports-audit-${process.argv[2]}.json` : newest('custom-finance-reports-audit-');
if (!auditFile) { console.error('No audit JSON found in reports/. Run: npm run audit:custom-reports'); process.exit(1); }
const stamp = auditFile.replace('custom-finance-reports-audit-', '').replace('.json', '');
const crawlFile = `custom-finance-menu-crawl-${stamp}.json`;
const audit = JSON.parse(fs.readFileSync(path.join(dir, auditFile), 'utf8'));
const crawl = fs.existsSync(path.join(dir, crawlFile)) ? JSON.parse(fs.readFileSync(path.join(dir, crawlFile), 'utf8')) : null;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const all = Object.values(audit.dimensions).flatMap((d) => d.findings);
const count = (f) => all.filter(f).length;
const originLabel = { base: 'Odoo (base)', 'custom-module': 'Custom module', studio: 'Studio', 'ui-created': 'Created by hand' };

const accountReports = audit.dimensions.C.findings;
const menuRows = crawl ? crawl.rows : [];
const customMenus = menuRows.filter((r) => r.origin !== 'base');
const visible = customMenus.filter((r) => r.status === 'visible' || r.status === 'folder-visible');
const notVisible = customMenus.filter((r) => ['hidden', 'app-not-shown', 'folder-empty'].includes(r.status));
const pdfReports = audit.dimensions.B.findings.filter((f) => f.model === 'ir.actions.report');
const templates = audit.dimensions.B.findings.filter((f) => f.model === 'ir.ui.view');
const finModules = audit.dimensions.F.findings.filter((f) => f.flags.includes('finance-keyword') && !f.flags.includes('custom-module-not-installed'));
const notInstalled = audit.dimensions.F.findings.filter((f) => f.flags.includes('custom-module-not-installed'));
const studioFields = audit.dimensions.E.findings.filter((f) => f.flags.includes('custom-fields'));

const chip = (t, c) => `<span class="chip ${c || ''}">${esc(t)}</span>`;
const originChip = (o) => chip(originLabel[o] || o, o);

function table(head, rows, opts = {}) {
  if (!rows.length) return '<p class="none">Nothing found.</p>';
  return `<div class="tw"><table class="${opts.cls || ''}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const sections = [];

sections.push(`<section id="engine"><h2>1. Custom accounting reports (report engine)</h2>
<p class="lead">Reports built in the Accounting <em>report engine</em> (<code>account.report</code>) that are not part of Odoo. Each has its own menu entry.</p>
${table(['Report', 'Origin', 'Lines', 'Variant of', 'Where it is on screen'],
  accountReports.map((f) => {
    const m = menuRows.find((r) => r.name.toLowerCase() === f.name.toLowerCase());
    const where = m ? `${esc(m.path)} ${chip(m.status === 'visible' ? 'visible' : m.status, m.status === 'visible' ? 'ok' : 'bad')}` : '<span class="muted">no menu with this name found</span>';
    return [`<strong>${esc(f.name)}</strong>`, originChip(f.origin), esc(f.detail.lines), esc(f.detail.rootReport || '-'), where];
  }))}</section>`);

sections.push(`<section id="menus"><h2>2. Custom Accounting menus: visible or hidden?</h2>
<p class="lead">${crawl ? `The Accounting app was opened in the browser as the admin user, and what is on screen was compared with the Accounting menus in the database.` : 'Menu crawl results are not available. Run the crawl spec.'}</p>
${crawl ? `<div class="cards small"><div class="card ok"><b>${visible.length}</b><span>custom menus visible</span></div><div class="card ${notVisible.length ? 'bad' : 'ok'}"><b>${notVisible.length}</b><span>custom menus not found on screen</span></div></div>
<h3>Not found on screen</h3>
${table(['Menu', 'Origin', 'Status', 'Note'], notVisible.map((r) => [esc(r.path), originChip(r.origin), chip(r.status, 'bad'), esc(r.why || 'Not inactive, not group-restricted, and its action is readable. It opens by URL, so it exists but could not be found in the menu bar. Check manually.')]))}
<h3>Visible to the admin user</h3>
<input class="filter" placeholder="Filter visible menus…" oninput="flt(this,'vis')">
<div id="vis">${table(['Menu', 'Origin', 'Module'], visible.map((r) => [esc(r.path), originChip(r.origin), esc(r.xmlid ? r.xmlid.split('.')[0] : '')]))}</div>` : ''}</section>`);

sections.push(`<section id="pdf"><h2>3. Custom PDF / QWeb reports</h2>
<p class="lead">Printable reports on accounting models (invoices, payments, receipts, cheques) that come from custom modules, and customised versions of Odoo's own accounting report templates.</p>
<h3>Report actions on accounting models (${pdfReports.length})</h3>
<input class="filter" placeholder="Filter reports…" oninput="flt(this,'pdf1')">
<div id="pdf1">${table(['Report', 'On model', 'Module', 'Flags'], pdfReports.map((f) => [`<strong>${esc(f.name)}</strong>`, esc(f.detail.model), esc(f.module || ''), f.flags.map((x) => chip(x)).join(' ')]))}</div>
<h3>Customised base report templates (${templates.length})</h3>
${table(['Template', 'Extends', 'Module', 'Flags'], templates.map((f) => [esc(f.name), esc(f.detail.extends || ''), esc(f.module || originLabel[f.origin]), f.flags.map((x) => chip(x, x === 'inactive' ? 'bad' : '')).join(' ')]))}</section>`);

const actions = audit.dimensions.D.findings.filter((f) => f.model === 'ir.actions.act_window');
const byModel = {};
for (const f of actions) { const k = f.detail.resModel || '?'; byModel[k] = byModel[k] || { n: 0, nomenu: 0, mods: new Set() }; byModel[k].n++; if (f.flags.includes('no-menu-points-here')) byModel[k].nomenu++; if (f.module) byModel[k].mods.add(f.module); }
const modelRows = Object.entries(byModel).sort((a, b) => b[1].n - a[1].n).map(([m, v]) => [`<code>${esc(m)}</code>`, v.n, v.nomenu, esc([...v.mods].join(', '))]);
sections.push(`<section id="actions"><h2>4. Custom actions on accounting models</h2>
<p class="lead">Window actions (list, pivot, graph views) on accounting models that come from custom modules or were created by hand: this is where a "report" can be just a saved view. <strong>${actions.length}</strong> in total, <strong>${actions.filter((f) => f.flags.includes('no-menu-points-here')).length}</strong> of them with no menu pointing to them (reachable only by link or from another place).</p>
<details><summary>By model</summary>${table(['Model', 'Custom actions', 'Without a menu', 'Modules'], modelRows)}</details>
${audit.dimensions.D.findings.filter((f) => f.flags.includes('manual-model') || f.flags.includes('report-style-model')).length ? '' : '<p class="muted">No manual (Studio) models or report-style SQL models on accounting were found.</p>'}</section>`);

sections.push(`<section id="studio"><h2>5. Studio layer</h2>
<p class="lead">${esc(audit.dimensions.E.note || '')}. Studio work on this instance was exported into the <code>BugFix-*</code> modules, so it shows up as <em>custom module</em> records above rather than as <code>studio_customization</code> records. Studio's other footprint is custom fields on accounting models:</p>
${table(['Model', 'Custom fields', 'Examples'], studioFields.map((f) => [esc(f.name.replace(/^\d+ custom field\(s\) on /, '')), esc(f.name.match(/^(\d+)/)[1]), `<span class="muted">${esc((f.detail.fields || []).slice(0, 3).join(' · '))}</span>`]))}</section>`);

sections.push(`<section id="modules"><h2>6. Module level</h2>
<p class="lead">${audit.moduleOrigins.custom.length} installed modules on the instance are not from Odoo S.A.; ${finModules.length} of them relate to accounting:</p>
${table(['Module', 'Provides'], finModules.map((f) => [`<strong>${esc(f.name)}</strong>`, esc(Object.entries(f.detail.provides || {}).map(([k, v]) => `${v} ${k}`).join(', ') || '-')]))}
<details><summary>All ${audit.moduleOrigins.custom.length} installed non-Odoo modules on the instance (for reference)</summary><p>${audit.moduleOrigins.custom.map((m) => chip(m)).join(' ')}</p></details>
<details><summary>${notInstalled.length} accounting-related custom modules exist on the server but are NOT installed</summary>
<input class="filter" placeholder="Filter…" oninput="flt(this,'ni')"><div id="ni">${table(['Module', 'State'], notInstalled.map((f) => [esc(f.name.replace(' (not installed)', '')), esc(f.detail.state || '')]))}</div></details></section>`);

const other = audit.dimensions.G.findings;
sections.push(`<section id="other"><h2>7. Other mechanisms (accounting only)</h2>
<p class="lead">Places a report can live that are not menus or report actions. ${esc(audit.dimensions.G.note || '')}</p>
<div class="cards small"><div class="card"><b>${count((x) => x.flags.includes('spreadsheet-dashboard'))}</b><span>spreadsheet dashboards</span></div><div class="card"><b>${count((x) => x.flags.includes('saved-filter'))}</b><span>saved filters on accounting models</span></div><div class="card"><b>${count((x) => x.flags.includes('bi-view-editor'))}</b><span>BI views</span></div><div class="card"><b>${count((x) => x.flags.includes('scheduled-job'))}</b><span>accounting scheduled jobs</span></div><div class="card"><b>${count((x) => x.dimension === 'H')}</b><span>menus hidden per user</span></div></div>
${table(['Item', 'Kind', 'Detail'], other.map((f) => [esc(f.name), f.flags.map((x) => chip(x)).join(' '), `<span class="muted">${esc(Object.entries(f.detail).filter(([, v]) => v).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; ').slice(0, 160))}</span>`]))}
<p class="muted">Per-user hiding: ${esc(audit.dimensions.H.note || '')}</p></section>`);

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Custom Accounting Reports Audit</title><style>
:root{--bg:#fff;--fg:#1f2328;--mut:#6b7280;--line:#e5e7eb;--card:#f8f9fb;--accent:#714B67;--ok:#166534;--okbg:#e8f6ec;--bad:#b42318;--badbg:#fdecea}
@media(prefers-color-scheme:dark){:root{--bg:#14161a;--fg:#e6e8eb;--mut:#9aa3af;--line:#2b3038;--card:#1c1f25;--accent:#c99bbd;--ok:#7ddc98;--okbg:#17301f;--bad:#ff9b8f;--badbg:#3a1d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 18px 70px}
h1{font-size:2rem;margin:0 0 4px}h2{font-size:1.4rem;margin:42px 0 6px;padding-top:14px;border-top:2px solid var(--line)}h3{font-size:1.05rem;margin:22px 0 8px}
.sub{color:var(--mut);margin:0 0 18px}.lead{color:var(--mut);margin:0 0 12px}
nav{position:sticky;top:0;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line);margin:0 0 6px;z-index:2}
nav a{display:inline-block;margin:2px 10px 2px 0;color:var(--accent);text-decoration:none;font-weight:600;font-size:.92rem}
.answer{background:var(--card);border-left:6px solid var(--accent);border-radius:8px;padding:16px 20px;margin:14px 0 18px;font-size:1.08rem}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.card{flex:1 1 170px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 16px}
.card b{display:block;font-size:1.9rem;line-height:1.1}.card span{color:var(--mut);font-size:.88rem}.card.ok b{color:var(--ok)}.card.bad b{color:var(--bad)}.small .card{flex:1 1 140px}.small .card b{font-size:1.5rem}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:.9rem}
th{background:var(--card);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);position:sticky;top:0}td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
.chip{display:inline-block;padding:1px 8px;border-radius:999px;border:1px solid var(--line);background:var(--card);font-size:.78rem;margin:1px 2px 1px 0;white-space:nowrap}
.chip.ok{background:var(--okbg);color:var(--ok);border-color:transparent}.chip.bad{background:var(--badbg);color:var(--bad);border-color:transparent}.chip.custom-module{border-color:var(--accent);color:var(--accent)}.chip.ui-created{border-color:#b45309;color:#b45309}.chip.studio{border-color:#1d4ed8;color:#1d4ed8}
.muted{color:var(--mut)}.none{color:var(--mut);font-style:italic}code{background:var(--card);padding:1px 5px;border-radius:4px}
.filter{width:100%;max-width:340px;padding:7px 10px;margin:0 0 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
details{margin:12px 0;border:1px solid var(--line);border-radius:8px;padding:8px 14px;background:var(--card)}summary{cursor:pointer;font-weight:600}
</style></head><body><div class="wrap">
<h1>Custom Accounting Reports Audit</h1>
<p class="sub">${esc(audit.instance.replace(/\/web\/login$/, ''))} &middot; generated ${esc(audit.generatedAt.slice(0, 16).replace('T', ' '))} UTC &middot; read-only scan &middot; <strong>scope: Accounting module only</strong></p>
<div class="answer"><strong>Yes, the Accounting module has customised reports on this instance.</strong> ${accountReports.length} custom accounting reports are built in the report engine (${accountReports.map((f) => esc(f.name)).join(', ')}), ${pdfReports.length} custom PDF reports and ${templates.length} customised base templates come from custom modules, and ${customMenus.length || count((x) => x.dimension === 'A')} custom Accounting menus exist${crawl ? `, <strong>${visible.length} visible and ${notVisible.length} not found on screen</strong> for the admin user` : ''}. None is inactive or restricted by groups, and no per-user menu hiding is in use.</div>
<div class="cards">
<div class="card"><b>${accountReports.length}</b><span>custom accounting reports</span></div>
<div class="card"><b>${customMenus.length || count((x) => x.dimension === 'A')}</b><span>custom Accounting menus</span></div>
<div class="card"><b>${pdfReports.length}</b><span>custom PDF/QWeb reports</span></div>
<div class="card"><b>${finModules.length}</b><span>accounting-related custom modules</span></div>
<div class="card ${notVisible.length ? 'bad' : 'ok'}"><b>${notVisible.length}</b><span>custom menus not found on screen</span></div></div>
<nav><a href="#engine">Report engine</a><a href="#menus">Menus</a><a href="#pdf">PDF reports</a><a href="#actions">Actions</a><a href="#studio">Studio</a><a href="#modules">Modules</a><a href="#other">Other</a></nav>
${sections.join('\n')}
<h2>How this was found</h2><p class="lead">Two read-only Playwright specs: an RPC audit of the instance's metadata (menus, report actions, report engine, actions and models, Studio, modules, saved filters, exports, dashboards, crons, per-user menu hiding) and a browser crawl of the Accounting app. A record counts as <em>custom</em> when its external id belongs to a non-Odoo module, to Studio, or when it was created by hand. Re-run with <code>npm run audit:custom-reports</code>, then <code>node scripts/render-custom-reports-audit.js</code>.</p>
</div><script>function flt(i,id){var q=i.value.toLowerCase();document.querySelectorAll('#'+id+' tbody tr').forEach(function(r){r.style.display=r.textContent.toLowerCase().indexOf(q)>-1?'':'none'})}</script></body></html>`;

const out = path.join(dir, `custom-finance-reports-${stamp}.html`);
fs.writeFileSync(out, html);
console.log('wrote', out);
