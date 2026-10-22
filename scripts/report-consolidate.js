#!/usr/bin/env node
/**
 * scripts/report-consolidate.js
 *
 * Rolls up every module branch's reports/summary.json into one dashboard,
 * without checking any of those branches out. Reads branch state directly
 * from git history via `git show <branch>:<path>`.
 *
 * Usage:
 *   node scripts/report-consolidate.js
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT         = path.resolve(__dirname, '..');
const REPORTS_DIR   = path.join(ROOT, 'reports');
const BRANCHES_DIR  = path.join(REPORTS_DIR, 'branches');
const DATA_DIR       = path.join(__dirname, 'report-data');
const TODAY          = new Date().toISOString().slice(0, 10);

function loadBranchList() {
  const p = path.join(DATA_DIR, 'branches.json');
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')).branches || []; }
  catch { return []; }
}

function git(args) {
  try { return execSync(`git ${args}`, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (err) { return null; }
}

function branchExists(branch) {
  return git(`rev-parse --verify --quiet "refs/heads/${branch}" || git rev-parse --verify --quiet "refs/remotes/origin/${branch}"`) !== null
    || git(`show-ref --verify --quiet refs/heads/${branch}`) !== null
    || git(`show-ref --verify --quiet refs/remotes/origin/${branch}`) !== null;
}

function resolveRef(branch) {
  if (git(`show-ref --verify --quiet refs/heads/${branch}`) !== null) return branch;
  if (git(`show-ref --verify --quiet refs/remotes/origin/${branch}`) !== null) return `origin/${branch}`;
  return null;
}

function findMasterReportPath(ref) {
  const listing = git(`ls-tree -r --name-only ${ref} -- reports`);
  if (!listing) return null;
  const files = listing.split('\n').filter(Boolean).filter(f => /reports\/master-report-.*\.html$/.test(f));
  if (!files.length) return null;
  files.sort();
  return files[files.length - 1]; // latest by date-sorted filename
}

function readFileFromBranch(ref, relPath) {
  if (!relPath) return null;
  return git(`show ${ref}:${relPath.replace(/\\/g, '/')}`);
}

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function main() {
  const branchNames = loadBranchList();
  if (!branchNames.length) {
    console.log('No branches configured in scripts/report-data/branches.json — nothing to consolidate.');
    return;
  }

  if (!fs.existsSync(BRANCHES_DIR)) fs.mkdirSync(BRANCHES_DIR, { recursive: true });

  const results = [];
  const gaps = [];

  for (const branch of branchNames) {
    const ref = resolveRef(branch);
    if (!ref) {
      gaps.push({ branch, reason: 'branch does not exist locally or on origin' });
      continue;
    }

    const summaryRaw = readFileFromBranch(ref, 'reports/summary.json');
    if (!summaryRaw) {
      gaps.push({ branch, reason: 'no reports/summary.json committed on this branch yet' });
      continue;
    }

    let summary;
    try { summary = JSON.parse(summaryRaw); }
    catch { gaps.push({ branch, reason: 'reports/summary.json could not be parsed' }); continue; }

    const masterReportPath = findMasterReportPath(ref);
    const masterReportHtml = readFileFromBranch(ref, masterReportPath);
    let localReportFile = null;
    if (masterReportHtml) {
      localReportFile = path.join(BRANCHES_DIR, `${branch}.html`);
      fs.writeFileSync(localReportFile, masterReportHtml, 'utf-8');
    }

    results.push({ branch, ref, summary, localReportFile: localReportFile ? path.basename(localReportFile) : null });
  }

  const grand = results.reduce((acc, r) => {
    const g = r.summary.global || {};
    acc.total   += g.total   || 0;
    acc.passed  += g.passed  || 0;
    acc.failed  += g.failed  || 0;
    acc.skipped += g.skipped || 0;
    acc.pending += g.pending || 0;
    return acc;
  }, { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 });

  const tiles = results.map(r => {
    const g = r.summary.global || {};
    const link = r.localReportFile ? `branches/${esc(r.localReportFile)}` : null;
    return `
    <div class="tile">
      <div class="tile-branch">${esc(r.branch)}</div>
      <div class="tile-date">${esc(r.summary.date || '—')} · ${esc(r.summary.project || '')}</div>
      <div class="tile-stats">
        <span class="p">✔ ${g.passed || 0}</span>
        <span class="f">❌ ${g.failed || 0}</span>
        <span class="s">⏭ ${g.skipped || 0}</span>
        <span class="t">of ${g.total || 0}</span>
      </div>
      ${link ? `<a class="tile-link" href="${link}" target="_blank">View full report →</a>` : '<span class="tile-link disabled">No master report found</span>'}
    </div>`;
  }).join('\n');

  const gapRows = gaps.map(gp => `<tr><td>${esc(gp.branch)}</td><td>${esc(gp.reason)}</td></tr>`).join('\n')
    || '<tr><td colspan="2" style="color:#64748b;font-style:italic;">No gaps — every configured branch reported in.</td></tr>';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Consolidated Cross-Branch Report · ${TODAY}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f1f5f9; color:#0f172a; margin:0; padding:32px; }
  h1 { font-size:1.4rem; margin-bottom:4px; }
  .sub { color:#64748b; font-size:0.85rem; margin-bottom:24px; }
  .grand { display:flex; gap:24px; background:#0f172a; color:#fff; border-radius:12px; padding:24px 32px; margin-bottom:28px; }
  .grand .num { font-size:2rem; font-weight:800; } .grand .lbl { font-size:0.68rem; opacity:.7; text-transform:uppercase; letter-spacing:.05em; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; margin-bottom:32px; }
  .tile { background:#fff; border-radius:10px; padding:16px; box-shadow:0 1px 4px rgba(0,0,0,.08); }
  .tile-branch { font-weight:800; font-size:1rem; } .tile-date { font-size:0.68rem; color:#64748b; margin-bottom:10px; }
  .tile-stats { display:flex; gap:12px; font-size:0.8rem; margin-bottom:10px; }
  .tile-stats .p { color:#16a34a; font-weight:700; } .tile-stats .f { color:#dc2626; font-weight:700; }
  .tile-stats .s { color:#7c3aed; font-weight:700; } .tile-stats .t { color:#64748b; }
  .tile-link { font-size:0.78rem; color:#2563eb; text-decoration:none; font-weight:600; }
  .tile-link.disabled { color:#94a3b8; }
  table { width:100%; border-collapse:collapse; background:#fff; border-radius:8px; overflow:hidden; }
  th, td { text-align:left; padding:8px 12px; font-size:0.82rem; border-bottom:1px solid #e2e8f0; }
  th { background:#f8fafc; font-size:0.66rem; text-transform:uppercase; color:#64748b; }
  h2 { font-size:1rem; margin:24px 0 10px; }
</style>
</head>
<body>
  <h1>Consolidated Cross-Branch Report</h1>
  <div class="sub">Generated ${TODAY} · ${results.length} branch${results.length !== 1 ? 'es' : ''} reporting · ${gaps.length} gap${gaps.length !== 1 ? 's' : ''}</div>

  <div class="grand">
    <div><div class="num">${results.length}</div><div class="lbl">Branches</div></div>
    <div><div class="num">${grand.total}</div><div class="lbl">Total Tests</div></div>
    <div><div class="num">${grand.passed}</div><div class="lbl">Passed</div></div>
    <div><div class="num">${grand.failed}</div><div class="lbl">Failed</div></div>
    <div><div class="num">${grand.skipped}</div><div class="lbl">Skipped</div></div>
  </div>

  <div class="tiles">
    ${tiles || '<span style="color:#64748b;">No branches reported in yet.</span>'}
  </div>

  <h2>Gaps</h2>
  <table>
    <thead><tr><th>Branch</th><th>Reason</th></tr></thead>
    <tbody>${gapRows}</tbody>
  </table>
</body>
</html>`;

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outFile = path.join(REPORTS_DIR, `consolidated-report-${TODAY}.html`);
  fs.writeFileSync(outFile, html, 'utf-8');

  console.log(`✅ Consolidated report: ${outFile}`);
  console.log(`   ${results.length} branch(es) reporting, ${gaps.length} gap(s)`);
  if (gaps.length) gaps.forEach(g => console.log(`   ⚠ ${g.branch}: ${g.reason}`));
}

main();
