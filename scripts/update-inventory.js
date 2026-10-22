#!/usr/bin/env node
/**
 * scripts/update-inventory.js
 *
 * Lists EVERY test case Playwright knows (without running any) and merges it into
 * reports/run-history/inventory.json, so the master report shows test cases that have not been run yet.
 *
 * Usage:  node scripts/update-inventory.js
 * Env:    INVENTORY_PROJECTS  comma list of Playwright projects to list (default "setup,admin")
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'reports', 'run-history');
const FILE = path.join(DIR, 'inventory.json');
const PROJECTS = (process.env.INVENTORY_PROJECTS || 'setup,admin').split(',').map(s => s.trim()).filter(Boolean);
const STEP_FOLDER = {
  '01-config': 'config', '02-business': 'business', '03-reporting': 'reporting', '04-permissions': 'permissions',
  '05-validations': 'validations', '06-edge-cases': 'edge', '07-archive': 'archive',
};

const out = execSync(`npx playwright test --list --reporter=json ${PROJECTS.map(p => `--project=${p}`).join(' ')}`,
  { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
const data = JSON.parse(out.slice(out.indexOf('{')));

const found = [];
function walk(suite, describes, file) {
  const here = suite.file ? file : file;
  for (const spec of suite.specs || []) {
    const f = (spec.file || '').replace(/\\/g, '/');
    const mod = (f.match(/(?:^|\/)modules\/([^/]+)\//) || [])[1] || (f.includes('fixtures/') ? 'setup' : 'other');
    const folder = (f.match(/\/tests\/([^/]+)\//) || [])[1] || '';
    const stepKey = mod === 'setup' ? 'setup' : STEP_FOLDER[folder] || 'other';
    const title = spec.title.replace(/@\S+/g, '').trim();
    for (const t of spec.tests || []) {
      const describe = describes.join(' › ');
      found.push({
        key: [t.projectName, mod, stepKey, describe, title].join('|'),
        project: t.projectName, mod, stepKey, describe, title,
        file: path.basename(f), placeholder: /^placeholder/i.test(title),
      });
    }
  }
  for (const s of suite.suites || []) {
    const isFile = /\.(spec|test)\.[tj]s$/.test(s.title);
    walk(s, isFile ? describes : [...describes, s.title.replace(/@\S+/g, '').trim()], here);
  }
}
for (const s of data.suites || []) walk(s, [], '');

let existing = [];
try { existing = JSON.parse(fs.readFileSync(FILE, 'utf-8')); } catch { /* first time */ }
const byKey = new Map(existing.map(e => [e.key, e]));
// file order from the listing first, then tests only seen in earlier runs
const merged = [...found.map(f => ({ ...(byKey.get(f.key) || {}), ...f })), ...existing.filter(e => !found.some(f => f.key === e.key))];
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(FILE, JSON.stringify(merged, null, 1), 'utf-8');
console.log(`Inventory: ${merged.length} test cases (${found.length} listed now, ${merged.length - found.length} only seen in earlier runs).`);
