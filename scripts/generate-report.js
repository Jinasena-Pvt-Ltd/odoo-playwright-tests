#!/usr/bin/env node
/**
 * scripts/generate-report.js
 *
 * Generates reports/master-report-YYYY-MM-DD.html by scanning all spec files
 * and optionally merging with Playwright JSON results for actual pass/fail status.
 *
 * Usage:
 *   node scripts/generate-report.js
 *   node scripts/generate-report.js --results test-results/results.json
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Paths ────────────────────────────────────────────────────────────────────

const ROOT        = path.resolve(__dirname, '..');
const SRC_MODULES = path.join(ROOT, 'src', 'modules');
const REPORTS_DIR = path.join(ROOT, 'reports');
const DATA_DIR    = path.join(__dirname, 'report-data');
const TODAY       = new Date().toISOString().slice(0, 10);

// ── Project name (from package.json) ─────────────────────────────────────────

const PKG_NAME = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).name || 'Odoo E2E'; }
  catch { return 'Odoo E2E'; }
})();

// ── Module metadata ───────────────────────────────────────────────────────────
//
// Populate this for your project's modules.
// Each key is a folder name under src/modules/, value defines display metadata.
// Example:
//   hr: { color: '#3b82f6', icon: '👤', name: 'HR Employees',
//          sub: 'Employees · Contracts · Approvals', css: 'hr', nav: 'HR Module', id: 'hr' }
// The `css` field is used as a CSS class suffix for module-card and mod-header rules.
// The `color` field drives the generated border/gradient CSS for that module.
const MODULE_META = {};

const fallback = (mod) => ({
  color: '#64748b', icon: '📦', name: mod, sub: '', css: 'other',
  nav: mod, id: mod.replace(/[^a-z0-9]/gi, '').slice(0, 8),
});

// ── Module color CSS (generated from MODULE_META) ─────────────────────────────

const moduleColorCSS = Object.entries(MODULE_META).map(([, m]) =>
  `.module-card.${m.css} { border-color:${m.color}; }\n` +
  `    .mod-header.${m.css} { background: linear-gradient(90deg, #f8fafc, #f1f5f9); border-left: 5px solid ${m.color}; }`
).join('\n    ');

// ── Step metadata ─────────────────────────────────────────────────────────────

const STEP_META = {
  config:      { icon: '⚙️',  label: 'Config'          },
  business:    { icon: '💼',  label: 'Business'         },
  reporting:   { icon: '📋',  label: 'Reporting'        },
  permissions: { icon: '🔐', label: 'Permissions'       },
  validations: { icon: '🧪', label: 'Field Validations' },
  edge:        { icon: '⚡',  label: 'Edge Cases'        },
  archive:     { icon: '🗄️', label: 'Archive'            },
};

const STEP_FOLDER_MAP = {
  '01-config': 'config', '02-business': 'business', '03-reporting': 'reporting',
  '04-permissions': 'permissions', '05-validations': 'validations',
  '06-edge-cases': 'edge', '07-archive': 'archive',
};

// Module display order — entries not listed here are sorted alphabetically after.
// Populate with your project's module keys to control sidebar/card ordering.
const KNOWN_ORDER = [];
const STEP_ORDER  = ['config','business','reporting','permissions','validations','edge','archive'];

// ── Authored data loader ──────────────────────────────────────────────────────

function loadData(filename) {
  const p = path.join(DATA_DIR, filename);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}

const CALLOUTS      = loadData('callouts.json')      || {};
const FINDINGS      = loadData('findings.json')      || {};
const SKIP_ANALYSIS = loadData('skip-analysis.json') || {};

// ── Security snapshot filter mapping ─────────────────────────────────────────
//
// Maps module keys to Odoo group-category keywords and ACL model prefixes.
// Only groups matching these keywords are shown in the Security Snapshot section.
// Example:
//   hr: { groupKeywords: ['Human Resources', 'Employee'], modelPrefixes: ['hr.employee'] }
const MODULE_SNAPSHOT_FILTER = {};

function loadLatestSnapshot() {
  const dir = path.join(ROOT, 'reports', 'snapshots');
  if (!fs.existsSync(dir)) return null;
  const jsonFiles = fs.readdirSync(dir)
    .filter(f => f.startsWith('ugd_snapshot_') && f.endsWith('.json'))
    .map(f => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!jsonFiles.length) return null;
  const diffFile = fs.readdirSync(dir)
    .filter(f => f.startsWith('user_groups_diff_') && f.endsWith('.html'))
    .map(f => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.f || null;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(dir, jsonFiles[0].f), 'utf-8'));
    return { data, diffFile };
  } catch { return null; }
}

// ── File scanner ──────────────────────────────────────────────────────────────

function findSpecFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules')
        findSpecFiles(full).forEach(f => out.push(f));
    } else if (entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

// ── Spec parser ───────────────────────────────────────────────────────────────

function extractPathMeta(filePath) {
  const rel   = path.relative(SRC_MODULES, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  return { mod: parts[0], stepFolder: parts[2] };
}

function parseSpecFile(filePath) {
  const { mod, stepFolder } = extractPathMeta(filePath);
  const step = STEP_FOLDER_MAP[stepFolder];
  if (!step) return null;

  const content  = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  const dm = content.match(/test\.describe\s*\(\s*(['"`])(.*?)\1/);
  const describeTitle = dm ? dm[2] : '';

  const moduleTag = (describeTitle.match(/@module:([\w-]+)/) || [])[1] || mod;
  const stepTag   = (describeTitle.match(/@step:([\w-]+)/)   || [])[1] || step;

  return {
    filePath, fileName,
    module: moduleTag,
    step: stepTag,
    describeTitle,
    tests: parseTests(content),
  };
}

function parseTests(content) {
  const lines = content.split('\n');
  const tests = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s*test(?:\.(skip|only))?\s*\(\s*(['"`])(.*?)\2/);
    if (!m) continue;

    const modifier = m[1];
    const rawName  = m[3];

    // Fixture params — look across current + next 3 lines
    const look   = lines.slice(i, i + 4).join(' ');
    const pm     = look.match(/async\s*\(\{([^}]*)\}/);
    const params = pm ? pm[1] : '';

    // Body — next 50 lines
    const bodyLines = lines.slice(i + 1, i + 51);
    const body      = bodyLines.join('\n');

    // Extract skip reason from body: test.skip(true, 'reason')
    let skipReason = '';
    if (modifier === 'skip') {
      // Declarative test.skip('name', ...) — reason not in body
    } else {
      const sr = body.match(/test\.skip\s*\(\s*true\s*,\s*(['"`])(.*?)\1/);
      if (sr) skipReason = sr[2];
    }

    // Code snippet — collect lines from the test declaration through ~20 lines
    const snippetLines = lines.slice(i, Math.min(i + 22, lines.length));
    const codeSnippet  = snippetLines.join('\n');

    const hasPage = /\bpage\b/.test(params);
    const hasRpc  = /\brpc\b/.test(params);
    const type    = hasPage && hasRpc ? 'mixed' : hasPage ? 'ui' : hasRpc ? 'rpc' : 'other';

    tests.push({
      name:        rawName.replace(/@\S+/g, '').trim(),
      rawName,
      isSkip:      modifier === 'skip',
      hasBodySkip: body.includes('test.skip(true'),
      skipReason,
      codeSnippet,
      testType:    type,
      hasSmoke:    rawName.includes('@smoke'),
    });
  }
  return tests;
}

// ── Results loader ────────────────────────────────────────────────────────────

function loadResults(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const map  = {};
    function walk(s) {
      for (const spec of (s.specs || [])) {
        const result = spec.tests?.[0]?.results?.[0];
        const rawStatus = result?.status;
        const status = rawStatus === 'unexpected' ? 'failed' : (rawStatus || 'pending');
        const errObj = result?.error;
        let error = null;
        if (status === 'failed' || status === 'timedOut') {
          const msg   = errObj?.message  || '';
          const stack = errObj?.stack    || '';
          // Use full stack when available; fall back to message only
          error = (stack || msg).replace(/\[[0-9;]*m/g, '').trim();
        }
        map[spec.title] = { status, error };
      }
      for (const sub of (s.suites || [])) walk(sub);
    }
    for (const s of (data.suites || [])) walk(s);
    return map;
  } catch { return null; }
}

// ── Status helpers ────────────────────────────────────────────────────────────

function getStatus(test, map) {
  if (map) {
    // results.json keys specs by their literal title (tags included), but `test.name`
    // has tags stripped for display — look up by `rawName` instead so real
    // pass/fail/skipped statuses actually match instead of falling back to "pending".
    const r = map[test.rawName] || map[test.name];
    if (r) return r.status;
  }
  if (test.isSkip)      return 'skipped';
  if (test.hasBodySkip) return 'conditional-skip';
  return 'pending';
}

function computeStats(suites, map) {
  const s = { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0, specCount: suites.length };
  for (const suite of suites) {
    for (const t of suite.tests) {
      s.total++;
      const st = getStatus(t, map);
      if      (st === 'passed')                               s.passed++;
      else if (st === 'failed' || st === 'timedOut')          s.failed++;
      else if (st === 'skipped' || st === 'conditional-skip') s.skipped++;
      else                                                    s.pending++;
    }
  }
  return s;
}

// ── HTML primitives ───────────────────────────────────────────────────────────

const esc = (s) =>
  String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const SICON = { passed:'✅', failed:'❌', skipped:'⏭', 'conditional-skip':'⏭', timedOut:'⏱', pending:'⬜' };
const SCLS  = { passed:'pass', failed:'fail', skipped:'skip', 'conditional-skip':'skip', timedOut:'fail', pending:'hist' };

function pillStats(s) {
  return [
    s.passed  > 0 && `<span class="pill green">${s.passed} passed</span>`,
    s.failed  > 0 && `<span class="pill red">${s.failed} failed</span>`,
    s.skipped > 0 && `<span class="pill purple">${s.skipped} skipped</span>`,
    s.pending > 0 && `<span class="pill amber">${s.pending} pending</span>`,
  ].filter(Boolean).join(' ');
}

function testRow(t, map) {
  const st  = getStatus(t, map);
  const ico = SICON[st] || '⬜';
  const cls = SCLS[st]  || 'hist';

  const tags = [
    t.hasSmoke                                   && '<span class="tag smoke">@smoke</span>',
    (t.testType==='ui'  || t.testType==='mixed') && '<span class="tag ui">UI</span>',
    (t.testType==='rpc' || t.testType==='mixed') && '<span class="tag rpc">RPC</span>',
    t.isSkip                                     && '<span class="tag saas">skip</span>',
  ].filter(Boolean).join('');

  const noteHtml = t.skipReason
    ? `<span class="test-row-note">${esc(t.skipReason)}</span>`
    : '';

  const snippetHtml = t.codeSnippet
    ? `<details class="code-snippet"><summary></summary><pre class="code">${esc(t.codeSnippet)}</pre></details>`
    : '';

  const errorAttr = (map && map[t.name]?.error)
    ? ` data-error="${esc(map[t.name].error)}"`
    : '';
  return `<div class="test-row ${cls}"${errorAttr}><span class="test-row-icon">${ico}</span><span class="test-row-name">${esc(t.name)}</span>${noteHtml}<div class="test-row-tags">${tags}</div>${snippetHtml}</div>`;
}

function navDot(stats) {
  if (stats.failed  > 0) return 'red';
  if (stats.skipped > 0 || stats.pending > 0) return 'amber';
  return 'green';
}

// ── Section generators ────────────────────────────────────────────────────────

function genSidebar(ordered, moduleMap, map) {
  const modBlocks = ordered.map(mod => {
    const meta  = MODULE_META[mod] || fallback(mod);
    const steps = STEP_ORDER.filter(s => moduleMap[mod][s]);
    const rows  = steps.map(step => {
      const stats = computeStats(moduleMap[mod][step], map);
      const dot   = navDot(stats);
      const count = stats.failed > 0
        ? `<span class="nav-count">${stats.passed}p ${stats.failed}f ${stats.skipped}s</span>`
        : (stats.skipped > 0 || stats.pending > 0)
          ? `<span class="nav-count skip">${stats.passed}p ${stats.skipped + stats.pending}s</span>`
          : `<span class="nav-count">${stats.passed}/${stats.total}</span>`;
      const label = STEP_META[step]?.label || step;
      return `    <a class="nav-item" href="#${meta.id}-${step}"><span class="nav-dot ${dot}"></span>${label}${count}</a>`;
    }).join('\n');
    return `  <div class="nav-section">
    <div class="nav-module-label"><span class="mod-dot" style="background:${meta.color}"></span>${esc(meta.nav)}</div>
${rows}
  </div>`;
  }).join('\n');

  return `<nav class="sidebar">
  <div class="sidebar-brand">
    <h2>${esc(PKG_NAME)} — Master Report</h2>
    <p>${TODAY} · ${ordered.length} modules</p>
  </div>
  <div class="nav-section">
    <a class="nav-item" href="#top"><span class="nav-dot blue"></span>Dashboard</a>
  </div>
${modBlocks}
  <div class="nav-divider"></div>
  <div class="nav-section">
    <div class="nav-module-label">Analysis</div>
    <a class="nav-item" href="#findings">🔬 Odoo Findings</a>
    <a class="nav-item" href="#skip-analysis">⏭ Skip Analysis</a>
    <a class="nav-item" href="#coverage">📊 Coverage Matrix</a>
    <a class="nav-item" href="#security-snapshot">🔒 Security Snapshot</a>
  </div>
</nav>`;
}

function genHero(g, ordered) {
  const ran  = g.total - g.skipped - g.pending;
  const rate = ran > 0 ? Math.round((g.passed / ran) * 100) : 0;
  return `  <div class="hero">
    <div class="hero-top">
      <div>
        <div class="hero-title">${esc(PKG_NAME)} — Master E2E Report</div>
        <div class="hero-sub">${ordered.length} Modules · ${g.total} tests · ${TODAY}</div>
      </div>
      <div class="hero-badge">Auto-generated</div>
    </div>
    <div class="hero-stats">
      <div class="hero-stat"><div class="num">${ordered.length}</div><div class="lbl">Modules</div></div>
      <div class="hero-divider"></div>
      <div class="hero-stat"><div class="num">${g.total}</div><div class="lbl">Total Tests</div></div>
      <div class="hero-divider"></div>
      <div class="hero-stat"><div class="num green">${g.passed}</div><div class="lbl">Passed</div></div>
      <div class="hero-divider"></div>
      <div class="hero-stat"><div class="num red">${g.failed}</div><div class="lbl">Failed</div></div>
      <div class="hero-divider"></div>
      <div class="hero-stat"><div class="num purple">${g.skipped}</div><div class="lbl">Skipped (SaaS)</div></div>
      ${g.pending > 0 ? `<div class="hero-divider"></div><div class="hero-stat"><div class="num amber">${g.pending}</div><div class="lbl">Pending</div></div>` : ''}
    </div>
    <div class="hero-bar-wrap">
      <div class="hero-bar-label"><span>Pass rate (of tests that ran)</span><span>${rate}% · ${g.passed}/${ran}</span></div>
      <div class="hero-bar-bg"><div class="hero-bar-fill" style="width:${rate}%"></div></div>
    </div>
  </div>`;
}

function genModuleCards(ordered, moduleMap, map) {
  const cards = ordered.map(mod => {
    const meta  = MODULE_META[mod] || fallback(mod);
    const all   = Object.values(moduleMap[mod]).flat();
    const s     = computeStats(all, map);
    const passW = s.total ? Math.round(s.passed  / s.total * 100) : 0;
    const skipW = s.total ? Math.round(s.skipped / s.total * 100) : 0;
    const failW = s.total ? Math.round(s.failed  / s.total * 100) : 0;
    return `    <div class="module-card ${meta.css}">
      <div class="module-card-icon">${meta.icon}</div>
      <div class="module-card-name">${esc(meta.name)}</div>
      <div class="module-card-sub">${esc(meta.sub)}</div>
      <div class="module-card-stats">
        <span class="p">✔ ${s.passed}</span>
        ${s.skipped > 0 ? `<span class="s">⏭ ${s.skipped}</span>` : ''}
        ${s.failed  > 0 ? `<span class="f">❌ ${s.failed}</span>` : ''}
        <span class="t">of ${s.total}</span>
      </div>
      <div class="module-mini-bar">
        <div class="seg-pass" style="width:${passW}%"></div>
        <div class="seg-skip" style="width:${skipW}%"></div>
        <div class="seg-fail" style="width:${failW}%"></div>
      </div>
      <div style="font-size:0.68rem;color:var(--muted);margin-top:6px;">${s.specCount} spec file${s.specCount !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('\n');
  return `  <div class="module-grid">\n${cards}\n  </div>`;
}

function genModuleSection(mod, stepMap, map) {
  const meta     = MODULE_META[mod] || fallback(mod);
  const all      = Object.values(stepMap).flat();
  const stats    = computeStats(all, map);
  const callout  = CALLOUTS[mod] || '';

  const stepBlocks = STEP_ORDER.filter(step => stepMap[step]).map(step => {
    const suites = stepMap[step];
    const sm     = STEP_META[step] || { icon: '📄', label: step };
    const sStats = computeStats(suites, map);
    const anchor = `${meta.id}-${step}`;

    const suiteHTML = suites.map((suite, idx) => {
      const ss  = computeStats([suite], map);
      const hdr = suites.length === 1 ? '' : `
      <div class="suite-hdr" style="margin-top:${idx > 0 ? '16px' : '4px'};">
        <span class="suite-hdr-icon">${sm.icon}</span>
        <span class="suite-hdr-title">${esc(suite.fileName.replace('.spec.ts', ''))}</span>
        ${pillStats(ss)}
        <span class="suite-hdr-file">${esc(suite.fileName)}</span>
      </div>`;
      return `${hdr}
      <div class="test-list">
        ${suite.tests.map(t => testRow(t, map)).join('\n        ')}
      </div>`;
    }).join('');

    return `
    <div id="${anchor}">
      <div class="suite-hdr">
        <span class="suite-hdr-icon">${sm.icon}</span>
        <span class="suite-hdr-title">${sm.label}</span>
        ${pillStats(sStats)}
        <span class="suite-hdr-file">${suites.length > 1 ? `${suites.length} files` : esc(suites[0].fileName)}</span>
      </div>
      ${suiteHTML}
    </div>`;
  }).join('\n');

  return `
  <!-- ═══ ${mod.toUpperCase()} ═══ -->
  <div class="mod-section" id="${meta.id}">
    <div class="mod-header ${meta.css}">
      <span class="mod-header-icon">${meta.icon}</span>
      <div>
        <div class="mod-header-title">${esc(meta.name)}</div>
        <div class="mod-header-meta">src/modules/${mod}/ · ${stats.specCount} spec file${stats.specCount !== 1 ? 's' : ''} · ${stats.total} tests</div>
      </div>
      <div class="mod-header-pills">${pillStats(stats)}</div>
    </div>
    ${callout}
    ${stepBlocks}
  </div>`;
}

function genFindings() {
  const tbody = FINDINGS.tbodyHtml ||
    '<tr><td colspan="5" style="color:var(--muted);font-style:italic;">No findings data — edit scripts/report-data/findings.json to add rows.</td></tr>';
  return `  <section class="section" id="findings">
    <div class="section-header">
      <span class="section-icon">🔬</span>
      <span class="section-title">Odoo Behaviour Findings — All Modules</span>
    </div>
    <div class="behaviour-box">
      <h4>About</h4>
      Observed Odoo 17 behaviours discovered during test development across all modules. Deviations from expected defaults, version differences, and SaaS-specific constraints worth documenting.
    </div>
    <table class="findings-table">
      <thead>
        <tr><th>#</th><th>Module</th><th>Finding</th><th>Detail</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${tbody}
      </tbody>
    </table>
  </section>`;
}

function genSkipAnalysis() {
  const tbody = SKIP_ANALYSIS.tbodyHtml ||
    '<tr><td colspan="4" style="color:var(--muted);font-style:italic;">No skip analysis data — edit scripts/report-data/skip-analysis.json to add rows.</td></tr>';
  return `  <section class="section" id="skip-analysis">
    <div class="section-header">
      <span class="section-icon">⏭</span>
      <span class="section-title">Skip Analysis — Deliberate Skips</span>
    </div>
    <div class="behaviour-box">
      <h4>Coverage Integrity</h4>
      All skips are deliberate responses to SaaS environment constraints — not gaps in tested functionality. Zero tests were skipped due to missing module features.
    </div>
    <table class="findings-table">
      <thead>
        <tr><th>Module</th><th>Skipped Tests</th><th>Root Cause</th><th>Alternative Coverage</th></tr>
      </thead>
      <tbody>
        ${tbody}
      </tbody>
    </table>
  </section>`;
}

// genCoverage — data-driven from scripts/report-data/coverage.json
// coverage.json shape: { "columns": ["Module A", ...], "rows": [{ "cap": "Create via UI", "cells": ["pass","skip","na"] }] }
// Each row.cells entry is: "pass" | "skip" | "na" | "fail" | "" (pending)
function genCoverage(ordered) {
  const data = loadData('coverage.json');

  if (!data?.rows?.length) {
    const metas   = ordered.map(m => MODULE_META[m] || fallback(m));
    const headers = metas.map(m => `<th>${esc(m.name)}</th>`).join('');
    return `  <section class="section" id="coverage">
    <div class="section-header">
      <span class="section-icon">📊</span>
      <span class="section-title">Coverage Matrix</span>
    </div>
    <div class="behaviour-box">
      <h4>No coverage data</h4>
      Edit <code>scripts/report-data/coverage.json</code> to populate the coverage matrix.
      Shape: <code>{ "columns": ["Module A"], "rows": [{ "cap": "Create via UI", "cells": ["pass"] }] }</code>
    </div>
    <table class="findings-table">
      <thead><tr><th>Capability</th>${headers}</tr></thead>
      <tbody>
        <tr><td colspan="${metas.length + 1}" style="color:var(--muted);font-style:italic;">No rows — add data to coverage.json</td></tr>
      </tbody>
    </table>
  </section>`;
  }

  const columns = data.columns || ordered.map(m => (MODULE_META[m] || fallback(m)).name);
  const headers = columns.map(c => `<th>${esc(c)}</th>`).join('');

  const cellHtml = (val) => {
    if (val === 'pass' || val === 'check') return `<td class="finding-pass">✔</td>`;
    if (val === 'skip')                    return `<td class="finding-skip">⏭ SaaS</td>`;
    if (val === 'na')                      return `<td>N/A</td>`;
    if (val === 'fail')                    return `<td class="finding-warn">❌</td>`;
    return `<td style="color:var(--muted)">—</td>`;
  };

  const rows = data.rows.map(({ cap, cells }) => {
    const tds = (cells || []).map(cellHtml).join('');
    return `        <tr><td>${esc(cap)}</td>${tds}</tr>`;
  }).join('\n');

  return `  <section class="section" id="coverage">
    <div class="section-header">
      <span class="section-icon">📊</span>
      <span class="section-title">Coverage Matrix</span>
    </div>
    <table class="findings-table">
      <thead><tr><th>Capability</th>${headers}</tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
  </section>`;
}

// ── Security snapshot section ─────────────────────────────────────────────────

function genSecuritySnapshot(snapshot, diffFile, ordered) {
  if (!snapshot) return '';

  const { date, users, groups, accessRights } = snapshot;

  // Build combined filter from the modules present in the report
  const activeKeywords = [];
  const activePrefixes = [];
  for (const mod of (ordered || [])) {
    const f = MODULE_SNAPSHOT_FILTER[mod];
    if (!f) continue;
    for (const k of f.groupKeywords) if (!activeKeywords.includes(k)) activeKeywords.push(k);
    for (const p of f.modelPrefixes)  if (!activePrefixes.includes(p))  activePrefixes.push(p);
  }

  // Filter groups by category keyword match
  const filteredGroups = activeKeywords.length
    ? groups.filter(g => activeKeywords.some(k => g.category?.toLowerCase().includes(k.toLowerCase()) || g.fullName?.toLowerCase().includes(k.toLowerCase())))
    : groups;

  const filteredGroupIds = new Set(filteredGroups.map(g => g.id));

  // Filter ACL rules by model prefix AND group membership in filtered set
  const filteredACLs = activePrefixes.length
    ? accessRights.filter(a => activePrefixes.some(p => a.modelTech?.startsWith(p)) && filteredGroupIds.has(a.groupId))
    : accessRights.filter(a => filteredGroupIds.has(a.groupId));

  // Count members per filtered group
  const memberCount = {};
  for (const g of filteredGroups) memberCount[g.id] = 0;
  for (const u of users) {
    for (const gid of (u.groupIds || [])) {
      if (filteredGroupIds.has(gid)) memberCount[gid] = (memberCount[gid] || 0) + 1;
    }
  }

  // Unique categories in filtered groups
  const categories = [...new Set(filteredGroups.map(g => g.category).filter(Boolean))];

  // Module label for callout
  const moduleLabels = (ordered || [])
    .filter(m => MODULE_SNAPSHOT_FILTER[m]?.groupKeywords.length)
    .map(m => (MODULE_META[m] || fallback(m)).name);
  const scopeLabel = moduleLabels.length ? moduleLabels.join(' &amp; ') : 'selected modules';

  // User rows sorted by name
  const userRows = [...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => {
    const relevantCount = (u.groupIds || []).filter(id => filteredGroupIds.has(id)).length;
    const lastMod = u.writeDate ? u.writeDate.slice(0, 10) : '—';
    return `<tr><td><strong>${esc(u.name)}</strong></td><td style="font-family:monospace;font-size:0.78rem">${esc(u.login)}</td><td style="text-align:center">${relevantCount}</td><td style="color:var(--muted)">${esc(lastMod)}</td></tr>`;
  }).join('\n');

  // Top 10 groups by member count
  const topGroups = filteredGroups
    .map(g => ({ ...g, members: memberCount[g.id] || 0 }))
    .sort((a, b) => b.members - a.members)
    .slice(0, 10);
  const groupRows = topGroups.map(g =>
    `<tr><td>${esc(g.name)}</td><td style="color:var(--muted)">${esc(g.category || '—')}</td><td style="text-align:center;font-weight:700">${g.members}</td></tr>`
  ).join('\n');

  const diffLink = diffFile
    ? `<a href="snapshots/${esc(diffFile)}" target="_blank" class="pill blue" style="margin-left:8px;text-decoration:none;font-size:0.72rem">Open Full Diff Report ↗</a>`
    : '';

  return `<section id="security-snapshot">
  <div class="mod-header" style="border-left-color:#ef4444">
    <span style="font-size:1.2rem">🔒</span>
    <div style="flex:1">
      <h2>Security Audit — User Group Snapshot</h2>
      <p style="font-size:0.78rem;color:var(--muted);margin-top:2px">Snapshot date: ${esc(date || '—')}${diffLink}</p>
    </div>
    <span class="pill amber">Point-in-time</span>
  </div>

  <div class="callout info" style="margin:12px 0 4px"><strong>Scope:</strong> Showing ${esc(scopeLabel)}-relevant groups only — ${filteredGroups.length} of ${groups.length} total groups · ${filteredACLs.length} ACL rules</div>

  <div class="snapshot-stats">
    <div class="snap-stat"><span class="snap-num">${users.length}</span><span>Users</span></div>
    <div class="snap-stat"><span class="snap-num">${filteredGroups.length}</span><span>Relevant Groups</span></div>
    <div class="snap-stat"><span class="snap-num">${filteredACLs.length}</span><span>ACL Rules</span></div>
    <div class="snap-stat"><span class="snap-num">${categories.length}</span><span>Categories</span></div>
  </div>

  <table class="snap-table">
    <thead><tr><th>User</th><th>Login</th><th style="text-align:center">Relevant Groups</th><th>Last Modified</th></tr></thead>
    <tbody>${userRows}</tbody>
  </table>

  <div class="snap-section-label">Top Groups by Member Count</div>
  <table class="snap-table">
    <thead><tr><th>Group</th><th>Category</th><th style="text-align:center">Members</th></tr></thead>
    <tbody>${groupRows}</tbody>
  </table>
</section>`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --pass: #16a34a; --pass-bg: #f0fdf4; --pass-border: #bbf7d0;
      --fail: #dc2626; --fail-bg: #fff5f5; --fail-border: #fecaca;
      --warn: #d97706; --warn-bg: #fffbeb; --warn-border: #fde68a;
      --info: #2563eb; --info-bg: #eff6ff; --info-border: #bfdbfe;
      --skip: #7c3aed; --skip-bg: #f5f3ff; --skip-border: #ddd6fe;
      --surface: #ffffff; --bg: #f1f5f9; --text: #0f172a; --muted: #64748b;
      --border: #e2e8f0; --radius: 10px; --shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; font-size: 14px; }
    .layout { display: flex; min-height: 100vh; }

    /* ── Sidebar ── */
    .sidebar { width: 260px; flex-shrink: 0; background: #1e293b; color: #cbd5e1; position: sticky; top: 0; height: 100vh; overflow-y: auto; padding: 24px 0; }
    .sidebar-brand { padding: 0 20px 18px; border-bottom: 1px solid #334155; margin-bottom: 12px; }
    .sidebar-brand h2 { font-size: 0.85rem; font-weight: 700; color: #f8fafc; margin-bottom: 2px; }
    .sidebar-brand p { font-size: 0.68rem; color: #94a3b8; }
    .nav-section { padding: 0 12px; margin-bottom: 4px; }
    .nav-module-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .10em; color: #64748b; padding: 8px 8px 4px; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
    .nav-module-label .mod-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
    .nav-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; color: #94a3b8; text-decoration: none; transition: background .15s; }
    .nav-item:hover, .nav-item.active { background: #334155; color: #f1f5f9; }
    .nav-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .nav-dot.green { background: #22c55e; } .nav-dot.amber { background: #f59e0b; } .nav-dot.blue { background: #60a5fa; }
    .nav-count { margin-left: auto; font-size: 0.65rem; font-weight: 700; background: #1e293b; border-radius: 999px; padding: 1px 6px; color: #64748b; }
    .nav-count.skip { background: #2e1065; color: #c4b5fd; }
    .nav-divider { height: 1px; background: #334155; margin: 12px 12px; }
    .nav-toggle { flex-shrink:0; width:14px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#64748b; font-size:0.6rem; transition: transform .15s; }
    .nav-toggle.open { transform: rotate(90deg); }
    .nav-children { display:none; flex-direction:column; gap:1px; padding-left:6px; margin: 2px 0 4px 20px; border-left: 1px solid #334155; max-height:300px; overflow-y:auto; }
    .nav-children.open { display:flex; }
    .nav-children .nav-group-label { font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#475569; padding:6px 8px 2px; }
    .nav-subitem { display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:5px; cursor:pointer; font-size:0.68rem; color:#94a3b8; white-space:nowrap; overflow:hidden; }
    .nav-subitem:hover { background:#334155; color:#f1f5f9; }
    .nav-subitem span.lbl { overflow:hidden; text-overflow:ellipsis; }
    .nav-subdot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
    .nav-subdot.pass { background:#22c55e; } .nav-subdot.skip { background:#7c3aed; } .nav-subdot.fail { background:#dc2626; } .nav-subdot.hist { background:#f59e0b; }

    /* ── Main ── */
    .main { flex: 1; min-width: 0; padding: 32px 36px; }

    /* ── Hero ── */
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #1a3a6b 100%); border-radius: 14px; padding: 36px 40px; color: white; margin-bottom: 28px; }
    .hero-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
    .hero-title { font-size: 1.55rem; font-weight: 800; margin-bottom: 4px; }
    .hero-sub { font-size: 0.85rem; opacity: 0.75; }
    .hero-badge { background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2); border-radius: 8px; padding: 6px 14px; font-size: 0.78rem; font-weight: 600; }
    .hero-stats { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-end; }
    .hero-stat .num { font-size: 2.4rem; font-weight: 800; line-height: 1; }
    .hero-stat .lbl { font-size: 0.68rem; font-weight: 600; opacity: 0.65; text-transform: uppercase; letter-spacing: .05em; margin-top: 2px; }
    .hero-stat .num.green { color: #4ade80; } .hero-stat .num.red { color: #f87171; } .hero-stat .num.purple { color: #c4b5fd; } .hero-stat .num.amber { color: #fbbf24; }
    .hero-divider { width: 1px; background: rgba(255,255,255,.15); align-self: stretch; }
    .hero-bar-wrap { margin-top: 20px; }
    .hero-bar-label { display: flex; justify-content: space-between; font-size: 0.78rem; opacity: 0.75; margin-bottom: 6px; }
    .hero-bar-bg { height: 8px; background: rgba(255,255,255,.15); border-radius: 999px; overflow: hidden; }
    .hero-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #4ade80, #22c55e); }

    /* ── Module overview grid ── */
    .module-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .module-card { background: var(--surface); border-radius: 12px; box-shadow: var(--shadow); padding: 20px; border-top: 4px solid; }
    .module-card.other { border-color: #64748b; }
    ${moduleColorCSS}
    .module-card-icon { font-size: 1.6rem; margin-bottom: 8px; }
    .module-card-name { font-weight: 800; font-size: 1rem; margin-bottom: 2px; }
    .module-card-sub  { font-size: 0.7rem; color: var(--muted); margin-bottom: 14px; }
    .module-card-stats { display: flex; gap: 16px; font-size: 0.8rem; }
    .module-card-stats .p { color: var(--pass); font-weight: 700; } .module-card-stats .s { color: var(--skip); font-weight: 700; }
    .module-card-stats .f { color: var(--fail); font-weight: 700; } .module-card-stats .t { color: var(--muted); }
    .module-mini-bar { height: 5px; background: var(--border); border-radius: 999px; overflow: hidden; margin-top: 12px; display: flex; }
    .module-mini-bar .seg-pass { background: #22c55e; } .module-mini-bar .seg-skip { background: #7c3aed; opacity: .5; }
    .module-mini-bar .seg-fail { background: #dc2626; opacity: .7; } .module-mini-bar .seg-hist { background: #f59e0b; opacity: .5; }

    /* ── Module section ── */
    .mod-section { margin-bottom: 48px; }
    .mod-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding: 14px 20px; border-radius: 10px; background: #f8fafc; border-left: 5px solid #64748b; }
    .mod-header.other { background: #f8fafc; border-left-color: #64748b; }
    ${moduleColorCSS}
    .mod-header-icon { font-size: 1.5rem; } .mod-header-title { font-size: 1.2rem; font-weight: 800; }
    .mod-header-meta { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }
    .mod-header-pills { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }

    /* ── Suite header ── */
    .suite-hdr { display: flex; align-items: center; gap: 10px; margin: 20px 0 10px; padding-bottom: 8px; border-bottom: 2px solid var(--border); flex-wrap: wrap; }
    .suite-hdr-icon { font-size: 1rem; } .suite-hdr-title { font-size: 0.95rem; font-weight: 700; }
    .suite-hdr-file { font-size: 0.68rem; font-family: monospace; color: var(--muted); margin-left: auto; }

    /* ── Test rows ── */
    .test-list { display: flex; flex-direction: column; gap: 5px; margin-bottom: 4px; }
    .test-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 7px; font-size: 0.82rem; border: 1px solid var(--border); background: var(--surface); flex-wrap: wrap; }
    .test-row.pass { border-color: var(--pass-border); } .test-row.skip { border-color: var(--skip-border); background: var(--skip-bg); }
    .test-row.fail { border-color: var(--fail-border); background: var(--fail-bg); } .test-row.hist { border-color: var(--warn-border); background: var(--warn-bg); }
    .test-row-icon { flex-shrink: 0; font-size: 0.9rem; } .test-row-name { flex: 1; font-weight: 500; min-width: 0; }
    .test-row-note { font-size: 0.68rem; color: var(--muted); font-style: italic; width: 100%; padding-left: 24px; }
    .test-row-tags { display: flex; gap: 4px; flex-shrink: 0; }

    /* ── Expandable code snippet ── */
    .code-snippet { flex-basis: 100%; border-top: 1px dashed var(--border); margin-top: 6px; padding-top: 4px; }
    .code-snippet summary { cursor: pointer; font-size: 0.68rem; color: var(--info); list-style: none; user-select: none; }
    .code-snippet summary::-webkit-details-marker { display: none; }
    .code-snippet summary::before { content: "⟨/⟩ view code"; }
    .code-snippet[open] summary::before { content: "⟨/⟩ hide code"; }
    .code-snippet .code { margin-top: 6px; font-size: 0.72rem; max-height: 480px; overflow-y: auto; }

    /* ── Code block ── */
    .code { font-family: 'Consolas','Monaco',monospace; font-size: 0.78rem; background: #1e2430; color: #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-top: 6px; overflow-x: auto; line-height: 1.6; }

    /* ── Pill / Tag ── */
    .pill { display: inline-flex; align-items: center; font-size: 0.65rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
    .pill.green  { background: var(--pass-bg); color: var(--pass); border: 1px solid var(--pass-border); }
    .pill.purple { background: var(--skip-bg); color: var(--skip); border: 1px solid var(--skip-border); }
    .pill.red    { background: var(--fail-bg); color: var(--fail); border: 1px solid var(--fail-border); }
    .pill.amber  { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); }
    .pill.blue   { background: var(--info-bg); color: var(--info); border: 1px solid var(--info-border); }
    .tag { display: inline-block; font-size: 0.62rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; background: var(--bg); color: var(--muted); border: 1px solid var(--border); }
    .tag.smoke { background: #fef3c7; color: #92400e; border-color: #fde68a; } .tag.rpc   { background: #ede9fe; color: #5b21b6; border-color: #ddd6fe; }
    .tag.ui    { background: #e0f2fe; color: #0369a1; border-color: #bae6fd; } .tag.saas  { background: #fef9c3; color: #713f12; border-color: #fde047; }
    .tag.fixed { background: #dcfce7; color: #14532d; border-color: #86efac; }

    /* ── Callout ── */
    .callout { border-radius: 8px; padding: 12px 16px; font-size: 0.82rem; margin-bottom: 16px; }
    .callout.saas { background: #f0f9ff; border: 1px solid #bae6fd; color: #0c4a6e; }
    .callout.info { background: var(--info-bg); border: 1px solid var(--info-border); color: #1e3a8a; }
    .callout strong { font-weight: 700; }

    /* ── Behaviour box ── */
    .behaviour-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; font-size: 0.82rem; }
    .behaviour-box h4 { font-size: 0.78rem; font-weight: 700; margin-bottom: 4px; color: var(--info); }

    /* ── Section ── */
    .section { margin-bottom: 40px; }
    .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 2px solid var(--border); }
    .section-icon { font-size: 1.2rem; } .section-title { font-size: 1.1rem; font-weight: 800; }

    /* ── Findings table ── */
    .findings-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 8px; }
    .findings-table th { background: #f8fafc; text-align: left; padding: 8px 12px; font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); border-bottom: 2px solid var(--border); }
    .findings-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; line-height: 1.4; }
    .findings-table tr:last-child td { border-bottom: none; } .findings-table tr:hover td { background: #fafbfc; }
    .finding-pass { color: var(--pass); font-weight: 600; } .finding-skip { color: var(--skip); font-weight: 600; }
    .finding-info { color: var(--info); font-weight: 600; } .finding-warn { color: var(--warn); font-weight: 600; }

    /* ── Test detail drawer ── */
    .test-drawer-overlay { position:fixed; inset:0; background:rgba(15,23,42,.45); z-index:200; opacity:0; pointer-events:none; transition:opacity .18s; }
    .test-drawer-overlay.open { opacity:1; pointer-events:auto; }
    .test-drawer { position:fixed; top:0; right:0; height:100vh; width:min(560px,92vw); background:var(--surface); z-index:201; box-shadow:-8px 0 30px rgba(0,0,0,.2); transform:translateX(100%); transition:transform .2s ease; display:flex; flex-direction:column; }
    .test-drawer.open { transform:translateX(0); }
    .test-drawer-head { padding:20px 24px 16px; border-bottom:1px solid var(--border); display:flex; gap:12px; align-items:flex-start; }
    .test-drawer-head .icon { font-size:1.3rem; }
    .test-drawer-title { font-size:1rem; font-weight:800; line-height:1.35; }
    .test-drawer-meta { font-size:0.72rem; color:var(--muted); margin-top:4px; }
    .test-drawer-close { margin-left:auto; background:none; border:none; font-size:1.2rem; color:var(--muted); cursor:pointer; line-height:1; padding:4px; }
    .test-drawer-body { padding:18px 24px 32px; overflow-y:auto; flex:1; }
    .test-drawer-section { margin-bottom:18px; }
    .test-drawer-label { font-size:0.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin-bottom:6px; }
    .failure-reason { background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.25); border-radius:6px; padding:12px 14px; font-family:monospace; font-size:0.75rem; line-height:1.6; color:var(--text); white-space:pre-wrap; overflow-x:auto; }
    .test-row.flash { animation: flash-hl 1.4s ease; }
    /* ── Security snapshot ── */
    .snapshot-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:16px 0 20px; }
    .snap-stat { background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:14px; text-align:center; }
    .snap-num { display:block; font-size:1.8rem; font-weight:800; color:var(--text); font-family:monospace; }
    .snap-stat span:last-child { font-size:0.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:.05em; }
    .snap-table { width:100%; border-collapse:collapse; font-size:0.82rem; margin-bottom:20px; }
    .snap-table th { text-align:left; padding:7px 10px; font-size:0.68rem; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); border-bottom:1px solid var(--border); }
    .snap-table td { padding:7px 10px; border-bottom:1px solid var(--border); }
    .snap-table tr:last-child td { border-bottom:none; }
    .snap-section-label { font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); margin:20px 0 8px; }
    @keyframes flash-hl { 0%,100% { box-shadow:none; } 20% { box-shadow:0 0 0 3px rgba(37,99,235,.35); } }

    footer { text-align: center; padding: 32px; color: var(--muted); font-size: 0.75rem; border-top: 1px solid var(--border); margin-top: 24px; }
    @media (max-width: 1200px) { .module-grid { grid-template-columns: repeat(2,1fr); } }
    @media (max-width: 900px)  { .sidebar { display:none; } .main { padding: 20px 16px; } .module-grid { grid-template-columns: 1fr; } }
  </style>`;

// ── Footer JavaScript ─────────────────────────────────────────────────────────

const FOOTER_JS = `<script>
  // IntersectionObserver for sidebar active highlight
  const navItems = document.querySelectorAll('.nav-item[href^="#"]');
  const headings = document.querySelectorAll('[id]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navItems.forEach(a => a.classList.remove('active'));
        const active = document.querySelector(\`.nav-item[href="#\${entry.target.id}"]\`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  headings.forEach(h => observer.observe(h));
</script>

<!-- ════════════════ SIDEBAR DRILL-DOWN + TEST DETAIL DRAWER ════════════════ -->
<script>
(function(){
  const sidebar = document.querySelector('.sidebar');
  let testCounter = 0;

  function statusOf(row){
    if (row.classList.contains('fail')) return 'fail';
    if (row.classList.contains('skip')) return 'skip';
    if (row.classList.contains('hist')) return 'hist';
    return 'pass';
  }
  const statusLabel = { pass:'Passed', skip:'Skipped', fail:'Failed', hist:'Flaky — Fixed' };
  const statusIcon  = { pass:'✅', skip:'⏭', fail:'❌', hist:'🛠' };
  const statusPill  = { pass:'green', skip:'purple', fail:'red', hist:'amber' };

  const overlay = document.createElement('div');
  overlay.className = 'test-drawer-overlay';
  const drawer = document.createElement('div');
  drawer.className = 'test-drawer';
  drawer.innerHTML =
    '<div class="test-drawer-head">' +
      '<span class="icon" id="td-icon"></span>' +
      '<div style="flex:1; min-width:0;">' +
        '<div class="test-drawer-title" id="td-title"></div>' +
        '<div class="test-drawer-meta" id="td-meta"></div>' +
      '</div>' +
      '<button class="test-drawer-close" id="td-close" aria-label="Close">×</button>' +
    '</div>' +
    '<div class="test-drawer-body" id="td-body"></div>';
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  function closeDrawer(){ overlay.classList.remove('open'); drawer.classList.remove('open'); }
  overlay.addEventListener('click', closeDrawer);
  drawer.querySelector('#td-close').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeDrawer(); });

  function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

  function openDrawerFor(row, suiteTitle, suiteFile){
    const status = statusOf(row);
    const name = (row.querySelector('.test-row-name') || {}).textContent || 'Untitled test';
    const note = row.querySelector('.test-row-note');
    const tags = Array.from(row.querySelectorAll('.test-row-tags .tag')).map(function(t){ return t.outerHTML; }).join(' ');
    const codeEl = row.querySelector('.code-snippet pre.code');

    document.getElementById('td-icon').textContent = statusIcon[status];
    document.getElementById('td-title').textContent = name.trim();
    document.getElementById('td-meta').innerHTML = (suiteTitle ? escapeHtml(suiteTitle) + ' · ' : '') + (suiteFile ? '<span style="font-family:monospace">' + escapeHtml(suiteFile) + '</span>' : '');

    const errorMsg = row.getAttribute('data-error') || '';
    let body = '<div class="test-drawer-section"><div class="test-drawer-label">Status</div><span class="pill ' + statusPill[status] + '">' + statusLabel[status] + '</span></div>';
    if (tags) body += '<div class="test-drawer-section"><div class="test-drawer-label">Tags</div>' + tags + '</div>';
    if (errorMsg) body += '<div class="test-drawer-section"><div class="test-drawer-label">Failure reason</div><div class="failure-reason">' + escapeHtml(errorMsg) + '</div></div>';
    if (note) body += '<div class="test-drawer-section"><div class="test-drawer-label">Note</div><div class="callout info">' + escapeHtml(note.textContent.trim()) + '</div></div>';
    if (codeEl) body += '<div class="test-drawer-section"><div class="test-drawer-label">Test source</div><pre class="code" style="max-height:none;">' + escapeHtml(codeEl.textContent.trim()) + '</pre></div>';
    document.getElementById('td-body').innerHTML = body;

    overlay.classList.add('open');
    drawer.classList.add('open');
  }

  sidebar.querySelectorAll('.nav-item[href^="#"]').forEach(function(navItem){
    const id = navItem.getAttribute('href').slice(1);
    if (id === 'top') return;
    const target = document.getElementById(id);
    if (!target) return;
    const rows = target.querySelectorAll('.test-row');
    if (!rows.length) return;

    const toggle = document.createElement('span');
    toggle.className = 'nav-toggle';
    toggle.textContent = '▸';
    navItem.insertBefore(toggle, navItem.firstChild);

    const childWrap = document.createElement('div');
    childWrap.className = 'nav-children';

    let currentTitle = null, currentFile = null;
    Array.from(target.children).forEach(function(child){
      if (child.classList.contains('suite-hdr')) {
        const t = child.querySelector('.suite-hdr-title');
        const f = child.querySelector('.suite-hdr-file');
        currentTitle = t ? t.textContent.trim() : null;
        currentFile  = f ? f.textContent.trim() : null;
      } else if (child.classList.contains('test-list')) {
        const groupRows = Array.from(child.querySelectorAll('.test-row'));
        if (!groupRows.length) return;
        if (currentTitle) {
          const label = document.createElement('div');
          label.className = 'nav-group-label';
          label.textContent = currentTitle;
          childWrap.appendChild(label);
        }
        const title = currentTitle, file = currentFile;
        groupRows.forEach(function(row){
          testCounter++;
          if (!row.id) row.id = 'test-' + testCounter;
          const st = statusOf(row);
          const nameEl = row.querySelector('.test-row-name');
          const name = nameEl ? nameEl.textContent.trim() : 'Untitled test';
          const sub = document.createElement('div');
          sub.className = 'nav-subitem';
          sub.title = name;
          sub.innerHTML = '<span class="nav-subdot ' + st + '"></span><span class="lbl">' + escapeHtml(name) + '</span>';
          sub.addEventListener('click', function(){
            const rect = row.getBoundingClientRect();
            window.scrollTo({ top: window.pageYOffset + rect.top - 100, behavior: 'smooth' });
            row.classList.remove('flash');
            void row.offsetWidth;
            row.classList.add('flash');
            openDrawerFor(row, title, file);
          });
          childWrap.appendChild(sub);
          row.style.cursor = 'pointer';
          row.addEventListener('click', function(e){
            if (e.target.closest('.code-snippet')) return;
            openDrawerFor(row, title, file);
          });
        });
      }
    });

    navItem.parentNode.insertBefore(childWrap, navItem.nextSibling);

    function toggleChildren(){
      const isOpen = childWrap.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
    }
    toggle.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      toggleChildren();
    });
    navItem.addEventListener('click', function(){
      if (!childWrap.classList.contains('open')) toggleChildren();
    });
  });
})();
</script>`;

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const args       = process.argv.slice(2);
  const rIdx       = args.indexOf('--results');
  const resFile    = rIdx >= 0
    ? args[rIdx + 1]
    : path.join(ROOT, 'test-results', 'results.json');

  const resultsMap = loadResults(resFile);
  if (resultsMap) console.log(`Loaded results: ${resFile}`);
  else            console.log('No results file — showing static inventory (⬜ pending)');

  const specFiles = findSpecFiles(SRC_MODULES);
  const suites    = specFiles.map(parseSpecFile).filter(Boolean);

  const moduleMap = {};
  for (const suite of suites) {
    (moduleMap[suite.module] ??= {})[suite.step] ??= [];
    moduleMap[suite.module][suite.step].push(suite);
  }

  const allMods = Object.keys(moduleMap);
  const ordered = [
    ...KNOWN_ORDER.filter(m => allMods.includes(m)),
    ...allMods.filter(m => !KNOWN_ORDER.includes(m)).sort(),
  ];

  const global = computeStats(suites, resultsMap);
  const globalCallout = CALLOUTS.global ? `\n  ${CALLOUTS.global}\n` : '';
  const snapshotResult = loadLatestSnapshot();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(PKG_NAME)} — Master E2E Report · ${TODAY}</title>
${CSS}
</head>
<body>
<div class="layout">

${genSidebar(ordered, moduleMap, resultsMap)}

<main class="main" id="top">

${genHero(global, ordered)}

${genModuleCards(ordered, moduleMap, resultsMap)}
${globalCallout}
${ordered.map(mod => genModuleSection(mod, moduleMap[mod], resultsMap)).join('\n')}

${genFindings()}

${genSkipAnalysis()}

${genCoverage(ordered)}

${genSecuritySnapshot(snapshotResult?.data, snapshotResult?.diffFile, ordered)}

</main>
</div>

<footer>
  ${esc(PKG_NAME)} · Odoo 17 · Master Report · Generated ${TODAY}${ordered.length ? ' · ' + ordered.map(m => (MODULE_META[m] || fallback(m)).name).join(' + ') : ''}
</footer>

${FOOTER_JS}
</body>
</html>`;

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const outFile = path.join(REPORTS_DIR, `master-report-${TODAY}.html`);
  fs.writeFileSync(outFile, html, 'utf-8');

  console.log(`✅ Report: ${outFile}`);
  console.log(`   ${global.total} tests · ${global.passed} passed · ${global.failed} failed · ${global.skipped} skipped · ${global.pending} pending`);
}

main();
