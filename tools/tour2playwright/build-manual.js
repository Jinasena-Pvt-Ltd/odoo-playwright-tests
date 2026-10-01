// Builds a Markdown + self-contained HTML manual for a converted tour from:
//   - the original tour JSON (step titles/content)
//   - the screenshots captured by the generated spec while replaying it
//
// Usage: node build-manual.js <tour-name> <path-to-tour.json>
// Example: node build-manual.js sales ../../tour/sales.json

const fs = require('fs');
const path = require('path');

const [, , tourName, tourJsonPath] = process.argv;
if (!tourName || !tourJsonPath) {
  console.error('Usage: node build-manual.js <tour-name> <path-to-tour.json>');
  process.exit(1);
}

const tourData = JSON.parse(fs.readFileSync(path.resolve(tourJsonPath), 'utf-8'));
const tour = tourData.tours[0];
const screenshotDir = path.join(__dirname, 'generated/screenshots', tourName);
const manualDir = path.join(__dirname, 'generated/manuals');
fs.mkdirSync(manualDir, { recursive: true });

// Adaptations made by the translator (hand-authored here, since this run didn't go through
// a fully automated pipeline) — surfaced in REVIEW.md and noted inline in the manual.
// One entry per tour (keyed by the `tourName` arg); sequences not run at all (e.g. excluded
// trailing/accidental steps, or fields that no longer exist on the form) are listed under
// `excluded` so the manual can say so instead of just "no screenshot captured".
const TOUR_NOTES = {
  sales: {
    adapted: new Set([10, 50, 60, 70, 80, 83, 84, 97]),
    excluded: new Set(),
  },
  'create-a-cash-customer': {
    adapted: new Set([30, 90, 110, 180, 190, 200]),
    excluded: new Set([140, 150, 160, 224]),
  },
};
const { adapted: ADAPTED_SEQUENCES, excluded: EXCLUDED_SEQUENCES } =
  TOUR_NOTES[tourName] || { adapted: new Set(), excluded: new Set() };

function screenshotFor(sequence) {
  const file = path.join(screenshotDir, `step-${String(sequence).padStart(3, '0')}.png`);
  return fs.existsSync(file) ? file : null;
}

function buildLocale(locale, localeLabel) {
  const steps = tour.steps
    .filter((s) => !EXCLUDED_SEQUENCES.has(s.sequence))
    .map((s) => ({
      sequence: s.sequence,
      title: s.title_i18n?.[locale] || s.title || '',
      content: s.content_i18n?.[locale] || s.content || '',
      description: s.description_i18n?.[locale] || s.description || '',
      screenshot: screenshotFor(s.sequence),
      adapted: ADAPTED_SEQUENCES.has(s.sequence),
    }));

  // ---- Markdown ----
  let md = `# ${tour.name} — User Manual (${localeLabel})\n\n`;
  md += `${tour.description_i18n?.[locale] || tour.description}\n\n`;
  md += `Generated from an Odoo Tour Recorder export, replayed with Playwright, and screenshotted at every step.\n\n`;
  if (EXCLUDED_SEQUENCES.size > 0) {
    md += `> ${EXCLUDED_SEQUENCES.size} recorded step(s) were excluded from the replay (fields/menus that no longer exist, or accidental trailing steps) — see REVIEW.md.\n\n`;
  }
  md += `---\n\n`;
  steps.forEach((s, i) => {
    const heading = s.title || s.content || `Step ${i + 1}`;
    md += `## ${i + 1}. ${heading}\n\n`;
    if (s.content) md += `${s.content}\n\n`;
    if (s.description && s.description !== s.content) md += `_${s.description}_\n\n`;
    if (s.adapted) md += `> **Note:** this step was adapted from the recorded tour — see REVIEW.md.\n\n`;
    if (s.screenshot) {
      const relPath = path.relative(manualDir, s.screenshot).replace(/\\/g, '/');
      md += `![Step ${i + 1}](${relPath})\n\n`;
    }
    md += `---\n\n`;
  });
  fs.writeFileSync(path.join(manualDir, `${tourName}.${locale}.md`), md, 'utf-8');

  // ---- Self-contained HTML (screenshots embedded as base64) ----
  const stepsHtml = steps
    .map((s, i) => {
      const heading = esc(s.title || s.content || `Step ${i + 1}`);
      const img = s.screenshot
        ? `<img src="data:image/png;base64,${fs.readFileSync(s.screenshot).toString('base64')}" alt="Step ${i + 1} screenshot">`
        : '<p class="missing">(no screenshot captured for this step)</p>';
      return `
      <section class="step">
        <h2><span class="step-num">${i + 1}</span>${heading}</h2>
        ${s.content ? `<p class="content">${esc(s.content)}</p>` : ''}
        ${s.description && s.description !== s.content ? `<p class="desc">${esc(s.description)}</p>` : ''}
        ${s.adapted ? '<p class="adapted">⚠ Adapted from the recorded tour — see REVIEW.md for details.</p>' : ''}
        ${img}
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="${locale.split('_')[0]}">
<head>
<meta charset="utf-8">
<title>${esc(tour.name)} — User Manual</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f6f7f9; color: #1a1a1a; margin: 0; padding: 0 0 4rem; }
  header { background: #714B67; color: #fff; padding: 2.5rem 2rem; }
  header h1 { margin: 0 0 .5rem; font-size: 1.8rem; }
  header p { margin: 0; opacity: .9; }
  main { max-width: 900px; margin: 0 auto; padding: 2rem; }
  .step { background: #fff; border: 1px solid #e3e3e3; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
  .step h2 { margin: 0 0 .75rem; font-size: 1.15rem; display: flex; align-items: center; gap: .6rem; }
  .step-num { background: #714B67; color: #fff; border-radius: 50%; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; font-size: .85rem; flex-shrink: 0; }
  .content { color: #444; margin: 0 0 .5rem; }
  .desc { color: #666; font-style: italic; margin: 0 0 .5rem; }
  .adapted { color: #8a5a00; background: #fff6e5; border: 1px solid #ffe2a8; border-radius: 6px; padding: .5rem .75rem; font-size: .9rem; margin: 0 0 .75rem; }
  .missing { color: #999; font-style: italic; }
  img { max-width: 100%; border: 1px solid #ddd; border-radius: 6px; display: block; }
  footer { max-width: 900px; margin: 0 auto; padding: 0 2rem; color: #888; font-size: .85rem; }
</style>
</head>
<body>
<header>
  <h1>${esc(tour.name)}</h1>
  <p>${esc(tour.description_i18n?.[locale] || tour.description)}</p>
  ${EXCLUDED_SEQUENCES.size > 0 ? `<p style="opacity:.8;font-size:.9rem;margin-top:.5rem;">${EXCLUDED_SEQUENCES.size} recorded step(s) excluded from the replay — see REVIEW.md.</p>` : ''}
</header>
<main>
${stepsHtml}
</main>
<footer>Generated from an Odoo Tour Recorder export (${esc(path.basename(tourJsonPath))}), replayed and screenshotted with Playwright.</footer>
</body>
</html>`;
  fs.writeFileSync(path.join(manualDir, `${tourName}.${locale}.html`), html, 'utf-8');

  return steps.length;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const stepCount = buildLocale('en_US', 'English');
console.log(`Built manual for "${tour.name}" — ${stepCount} steps — en_US only (si_LK/ta_IN were untranslated copies of English, see REVIEW.md)`);
