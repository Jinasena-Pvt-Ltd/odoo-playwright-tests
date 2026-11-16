#!/usr/bin/env node
/**
 * Build .trial-src/: a copy of src/ with Clear-DB's Studio technical names translated to the names of the
 * Odoo "Rename-HelpdeskRepair" trial (scripts/trial-names.json), so the same tests run against a database
 * installed from that trial. src/ itself is not changed and keeps testing Clear-DB.
 *
 * Tests find Odoo fields by technical name (`.o_field_widget[name="x_studio_repair_reason"]`), so a renamed
 * field is not found and the step is skipped. Same token rule as the Odoo rename: a name is replaced only as a
 * whole token (not preceded by a letter/digit, not followed by a letter/digit or a single "_"), longest first,
 * so `x_studio_repair_reason_ids` is never mistaken for `x_studio_repair_reason`.
 *
 * usage: node scripts/make-trial-src.js [out-dir]   (then: npx playwright test -c playwright.trial.config.ts ...)
 * out-dir defaults to .trial-src; a second copy (e.g. .trial-src-2, run with TRIAL_SRC=.trial-src-2) lets a
 * second run start while another still reads .trial-src.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const out = path.join(root, process.argv[2] || '.trial-src');
const names = JSON.parse(fs.readFileSync(path.join(__dirname, 'trial-names.json'), 'utf8'));
const map = Object.assign({}, names.fields, names.models);
const keys = Object.keys(map).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rule = new RegExp('(?<![A-Za-z0-9])(' + keys.map(esc).join('|') + ')(?![A-Za-z0-9]|_(?!_))', 'g');

fs.rmSync(out, { recursive: true, force: true });
let files = 0;
let replaced = 0;
(function copy(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, entry.name);
    const to = path.join(out, path.relative(src, from));
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copy(from);
    } else if (/\.(ts|js|json)$/.test(entry.name)) {
      const text = fs.readFileSync(from, 'utf8');
      const next = text.replace(rule, (m) => { replaced++; return map[m]; });
      if (next !== text) files++;
      fs.writeFileSync(to, next);
    } else {
      fs.copyFileSync(from, to);
    }
  }
})(src);
console.log(`${path.basename(out)}: ${replaced} names translated in ${files} files`);
