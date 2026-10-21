#!/usr/bin/env node
/**
 * scripts/combine-report.js
 *
 * Builds one combined master report from several module branches, without
 * touching main or the current working tree.
 *
 * For every branch listed in scripts/combine-config.json it reads, straight from git:
 *   - src/modules/<domain>/**           (specs, to build the test inventory)
 *   - results/*.json                    (optional Playwright JSON results, merged)
 *   - scripts/report-data/*.json        (optional findings / skip analysis / coverage / callouts)
 * then runs scripts/generate-report.js against the combined tree.
 *
 * Usage:
 *   node scripts/combine-report.js              # fetch, then combine
 *   node scripts/combine-report.js --no-fetch   # use already-fetched remote branches
 *
 * Output: reports/combined-report-YYYY-MM-DD.html
 */
'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT   = path.resolve(__dirname, '..');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'combine-config.json'), 'utf-8'));
const REMOTE = CONFIG.remote || 'origin';
const DATA_FILES = ['callouts', 'findings', 'skip-analysis', 'coverage'];

const git = (args, opts = {}) =>
  execFileSync('git', args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, ...opts });
const gitText = (args) => git(args, { encoding: 'utf-8' });

function gitShowJson(ref, file) {
  try { return JSON.parse(gitText(['show', `${ref}:${file}`])); } catch { return null; }
}

function listTree(ref, dir) {
  try {
    return gitText(['ls-tree', '-r', '--name-only', ref, '--', dir]).split('\n').filter(Boolean);
  } catch { return []; }
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

function mergeCoverage(parts) {
  const columns = [];
  const rows    = new Map(); // cap -> { column -> cell }
  for (const p of parts) {
    for (const col of p.columns || []) if (!columns.includes(col)) columns.push(col);
    for (const { cap, cells } of p.rows || []) {
      const r = rows.get(cap) || {};
      (p.columns || []).forEach((col, i) => { r[col] = (cells || [])[i] ?? ''; });
      rows.set(cap, r);
    }
  }
  return {
    columns,
    rows: [...rows].map(([cap, r]) => ({ cap, cells: columns.map(c => r[c] ?? '') })),
  };
}

function mergeData(name, parts) {
  if (name === 'callouts')  return Object.assign({}, ...parts);
  if (name === 'coverage')  return mergeCoverage(parts);
  return { tbodyHtml: parts.map(p => p.tbodyHtml || '').join('\n') }; // findings, skip-analysis
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  if (!process.argv.includes('--no-fetch')) {
    console.log(`Fetching ${REMOTE}...`);
    git(['fetch', REMOTE, '--prune'], { stdio: 'inherit' });
  }

  const work    = fs.mkdtempSync(path.join(os.tmpdir(), 'combined-report-'));
  const srcDir  = path.join(work, 'src', 'modules');
  const dataDir = path.join(work, 'report-data');
  const resDir  = path.join(work, 'results');
  [srcDir, dataDir, resDir].forEach(d => fs.mkdirSync(d, { recursive: true }));

  const owner     = {};                                   // module -> branch
  const dataParts = Object.fromEntries(DATA_FILES.map(n => [n, []]));
  const suites    = [];                                   // merged Playwright result suites
  let   resultSources = 0;

  for (const { branch } of CONFIG.branches) {
    const ref = `${REMOTE}/${branch}`;
    try { gitText(['rev-parse', '--verify', '--quiet', ref]); }
    catch { console.warn(`⚠  ${ref} not found — skipped`); continue; }

    // Module folders present on this branch
    const mods = [...new Set(listTree(ref, 'src/modules').map(f => f.split('/')[2]))];
    if (!mods.length) { console.log(`•  ${branch}: no modules yet`); continue; }

    for (const mod of mods) {
      if (owner[mod]) console.warn(`⚠  module "${mod}" is on both ${owner[mod]} and ${branch} — using ${branch}`);
      owner[mod] = branch;
      fs.rmSync(path.join(srcDir, mod), { recursive: true, force: true });
    }

    // Extract the module folders (specs) from the branch
    const tarball = git(['archive', '--format=tar', ref, ...mods.map(m => `src/modules/${m}`)]);
    execFileSync('tar', ['-x', '-C', work], { input: tarball, maxBuffer: 256 * 1024 * 1024 });

    for (const name of DATA_FILES) {
      const d = gitShowJson(ref, `scripts/report-data/${name}.json`);
      if (d && Object.keys(d).length) dataParts[name].push(d);
    }

    for (const f of listTree(ref, 'results').filter(f => f.endsWith('.json'))) {
      const r = gitShowJson(ref, f);
      if (r?.suites) { suites.push(...r.suites); resultSources++; }
    }

    console.log(`✔  ${branch}: ${mods.join(', ')}`);
  }

  if (!Object.keys(owner).length) {
    console.error('No modules found on any configured branch.');
    process.exit(1);
  }

  for (const name of DATA_FILES) {
    if (dataParts[name].length)
      fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(mergeData(name, dataParts[name])));
  }

  const metaFile = path.join(work, 'module-meta.json');
  fs.writeFileSync(metaFile, JSON.stringify(CONFIG.moduleMeta || {}));

  const args = [path.join(__dirname, 'generate-report.js')];
  if (suites.length) {
    const resFile = path.join(resDir, 'results.json');
    fs.writeFileSync(resFile, JSON.stringify({ suites }));
    args.push('--results', resFile);
    console.log(`Merged ${resultSources} results file(s)`);
  } else {
    // Point at a missing file so a stale local test-results/results.json is never used
    args.push('--results', path.join(resDir, 'none.json'));
    console.log('No results files on any branch — inventory only (⬜ pending)');
  }

  execFileSync(process.execPath, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      REPORT_SRC_MODULES: srcDir,
      REPORT_DATA_DIR:    dataDir,
      REPORT_OUT_PREFIX:  'combined-report',
      REPORT_TITLE:       CONFIG.title || 'Combined E2E',
      REPORT_MODULE_META: metaFile,
    },
  });

  fs.rmSync(work, { recursive: true, force: true });
}

main();
