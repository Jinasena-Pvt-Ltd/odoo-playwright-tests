// Generate a self-contained illustrated HTML manual from a tour + the
// screenshots captured by the Playwright run. One manual per language
// present in the export's i18n maps; screenshots are shared across
// languages.
//
// The manual embeds every screenshot as a base64 data: URI so the file is
// fully self-contained — open it in a browser, select all, and paste
// directly into Odoo Knowledge (or any rich-text editor); the images travel
// with the paste instead of depending on relative file paths surviving it.
//
// Layout: cover (goal / before you start / result) → contents grouped into
// parts → one card per step with a prominent ACTION callout, a "type this"
// table, an explanation, what you should see, and tip/warning boxes → glossary.
//
// Optional guide: if `<docs dir>/<tour slug>.guide.json` exists it enriches the
// manual (see loadGuide). Without it the manual still renders — each step then
// shows the tour's own title and text, with the action type derived from the
// recorded `run`.
import fs from "node:fs";
import path from "node:path";
import { tr } from "./loadTours.mjs";
import { shotFile, shotDir } from "./names.mjs";

const LANG_NAMES = {
  en_US: "English",
  si_LK: "සිංහල (Sinhala)",
  ta_IN: "தமிழ் (Tamil)",
};

// Human-readable hint per validation type, for the manual.
const VALIDATION_HINT = {
  required: "This field is required.",
  integer: "Enter a whole number.",
  float: "Enter a number (decimals allowed).",
  email: "Enter a valid email address.",
  phone: "Enter a valid phone number.",
  url: "Enter a valid URL.",
  date: "Enter a valid date.",
  alpha: "Letters only.",
  alphanumeric: "Letters and numbers only.",
  regex: "Enter a value in the expected format.",
};

// Action kinds: label shown on the callout + accent colour.
const KINDS = {
  CLICK: { label: "CLICK", color: "#714B67", soft: "#f4eef2" },
  ENTER: { label: "ENTER", color: "#0f766e", soft: "#e6f4f2" },
  REVIEW: { label: "REVIEW", color: "#1d4ed8", soft: "#e8effd" },
};

function langName(code) {
  return LANG_NAMES[code] || code;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escape, then turn **bold** into <strong>. */
function fmt(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/** Read a screenshot PNG and return it as a base64 data: URI, or null. */
function embedImage(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const buf = fs.readFileSync(absPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/**
 * Optional enrichment for a tour, stored next to the generated manuals as
 * `<slug>.guide.json`:
 * {
 *   "audience": "...", "goal": "...",
 *   "before": ["..."], "outcome": ["..."], "notes": ["..."],
 *   "phases": [{ "title": "...", "summary": "...", "from": 1, "to": 3 }],
 *   "glossary": [{ "term": "...", "meaning": "..." }],
 *   "steps": { "5": { "kind": "ENTER", "do": "…**bold**…",
 *                     "enter": [{ "field": "Date", "value": "…" }],
 *                     "points": ["…"], "see": "…", "tip": "…", "warning": "…" } }
 * }
 * Everything is optional. Returns null when no guide file exists.
 */
export function loadGuide(docsDir, slug) {
  const file = path.join(docsDir, `${slug}.guide.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`Guide file is not valid JSON (${file}): ${e.message}`);
  }
}

function deriveKind(step) {
  if (step.is_check) return "REVIEW";
  const run = String(step.run || "").trim().toLowerCase();
  if (run.startsWith("edit") || run.startsWith("text") || run.startsWith("fill")) return "ENTER";
  return "CLICK";
}

function renderStep(step, ctx) {
  const { tour, lang, total, dir, guide, useGuide } = ctx;
  const g = (useGuide && guide && guide.steps && guide.steps[String(step.number)]) || {};
  // A guide can replace a terse recorded title (e.g. "Credit") with one that says what to do.
  const stepTitle = g.title || tr(step.title, step.title_i18n, lang) || `Step ${step.number}`;
  const stepContent = tr(step.content, step.content_i18n, lang);

  const kindKey = KINDS[g.kind] ? g.kind : deriveKind(step);
  const kind = KINDS[kindKey];
  const doText = g.do || stepTitle;

  const dataUri = embedImage(path.join(dir, shotFile(step.number, total)));
  // Optional "<step>-result.png": a screenshot taken AFTER the step's action (a step's own screenshot is
  // taken before it, so it never shows the outcome). Written by a hand-edited spec, shown if present.
  const resultUri = embedImage(path.join(dir, shotFile(step.number, total).replace(/\.png$/, "-result.png")));
  const imgHtml = '<div class="figs">' +
    (dataUri
      ? `<figure class="fig"><div class="closeup" style="display:none"></div><div class="fig-lbl">Before — the item you work with is outlined in <span class="red">red</span></div><img class="shot shot-before" style="max-width:100%;height:auto;border:1px solid #cbd5e1" src="${dataUri}" alt="${escapeHtml(stepTitle)}" /></figure>`
      : `<p class="missing"><em>Screenshot pending — run the pipeline again to capture it.</em></p>`) +
    (resultUri
      ? `<figure class="fig"><div class="fig-lbl ok">After — the result of this step</div><img class="shot" style="max-width:100%;height:auto;border:1px solid #cbd5e1" src="${resultUri}" alt="Result after: ${escapeHtml(stepTitle)}" /></figure>`
      : "") + '</div>';

  const enterRows = Array.isArray(g.enter) && g.enter.length
    ? `<table class="enter"><thead><tr><th>Field</th><th>Enter this</th></tr></thead><tbody>${g.enter
        .map((r) => `<tr><td class="f">${fmt(r.field)}</td><td class="v">${fmt(r.value)}</td></tr>`)
        .join("")}</tbody></table>`
    : "";

  const points = Array.isArray(g.points) && g.points.length
    ? `<ul class="points">${g.points.map((p) => `<li>${fmt(p)}</li>`).join("")}</ul>`
    : "";

  let validation = "";
  if (!g.enter && step.validation_type && step.validation_type !== "none") {
    const vmsg =
      tr(step.validation_message, step.validation_message_i18n, lang) ||
      VALIDATION_HINT[step.validation_type] ||
      "";
    if (vmsg) validation = `<div class="box tip"><span class="ic">ℹ</span><div>${escapeHtml(vmsg)}</div></div>`;
  }

  const see = g.see
    ? `<div class="box see" style="border:2px solid #86d19f;background:#ecfdf3;border-radius:8px;padding:10px 14px;margin:0 0 12px;font-size:18px"><span class="ic">✔</span><div><span class="bl" style="font-weight:800;text-transform:uppercase;color:#166534;font-size:13px">You should see</span>${fmt(g.see)}</div></div>`
    : "";
  const tip = g.tip
    ? `<div class="box tip" style="border:2px solid #bcd3f7;background:#eff6ff;border-radius:8px;padding:10px 14px;margin:0 0 12px;font-size:17px"><span class="ic">💡</span><div><span class="bl" style="font-weight:800;text-transform:uppercase;color:#1d4ed8;font-size:13px">Tip</span>${fmt(g.tip)}</div></div>`
    : "";
  const warning = g.warning
    ? `<div class="box warn" style="border:2px solid #f4c97a;background:#fff7e6;border-radius:8px;padding:10px 14px;margin:0 0 12px;font-size:17px"><span class="ic">⚠</span><div><span class="bl" style="font-weight:800;text-transform:uppercase;color:#b45309;font-size:13px">Watch out</span>${fmt(g.warning)}</div></div>`
    : "";

  // "Where": a menu path such as "Accounting app > Configuration > Settings", shown as breadcrumb chips.
  const where = g.where
    ? `<div class="where"><span class="where-lbl">Where to find it</span>${String(g.where)
        .split(" > ")
        .map((c) => `<span class="crumb">${escapeHtml(c.trim())}</span>`)
        .join('<span class="sep">›</span>')}</div>`
    : "";

  // "How to do it": numbered mini-steps for this single step.
  const actions = Array.isArray(g.actions) && g.actions.length
    ? `<h4 style="margin:18px 0 6px;font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:${kind.color}">How to do it</h4>
      <ol style="margin:0 0 16px;padding-left:34px;font-size:21px;line-height:1.5;font-weight:600">${g.actions
        .map((a) => `<li style="margin:0 0 10px;padding:8px 12px;background:#f3f4f6;border-left:6px solid ${kind.color};border-radius:6px;list-style-position:outside">${fmt(a)}</li>`)
        .join("")}</ol>`
    : "";

  const phases = useGuide && guide && Array.isArray(guide.phases) ? guide.phases : null;
  const pi = phases ? phases.findIndex((p) => step.number >= p.from && step.number <= p.to) : -1;
  const partLabel = pi >= 0 ? ` · Part ${pi + 1}: ${escapeHtml(phases[pi].title)}` : "";
  const pct = Math.round((step.number / total) * 100);
  const aboutText = g.why || stepContent;

  // "In detail": a flowing explanation composed from the guide fields (purpose, how, expected result, cautions).
  const sentence = (t) => { const x = String(t || "").trim(); return x ? (/[.!?]$/.test(x) ? x : x + ".") : ""; };
  const lowerFirst = (t) => { const x = String(t || "").trim(); return x ? x.charAt(0).toLowerCase() + x.slice(1) : ""; };
  const prevT = step.number > 1 ? (guide && guide.steps && guide.steps[String(step.number - 1)] && guide.steps[String(step.number - 1)].title) : "";
  const nextT = step.number < total ? (guide && guide.steps && guide.steps[String(step.number + 1)] && guide.steps[String(step.number + 1)].title) : "";
  const detailParts = [];
  if (g.why) detailParts.push(`<p><b>Why this step matters.</b> ${fmt(sentence(g.why))}</p>`);
  if (Array.isArray(g.actions) && g.actions.length)
    detailParts.push(`<p><b>How to do it.</b> ${g.actions.map((a, i) => (i === 0 ? "First, " : i === g.actions.length - 1 ? "Finally, " : "Then, ") + lowerFirst(fmt(sentence(a)))).join(" ")}</p>`);
  if (g.see) detailParts.push(`<p><b>How you know it worked.</b> ${fmt(sentence(g.see))}</p>`);
  if (g.warning) detailParts.push(`<p><b>Be careful.</b> ${fmt(sentence(g.warning))}</p>`);
  if (g.tip) detailParts.push(`<p><b>Good to know.</b> ${fmt(sentence(g.tip))}</p>`);
  if (prevT || nextT)
    detailParts.push(`<p><b>Where this fits.</b> This is step ${step.number} of ${total}${partLabel ? partLabel.replace(" · ", ", in ") : ""}.${prevT ? ` It follows &ldquo;${escapeHtml(prevT)}&rdquo;.` : ""}${nextT ? ` Next comes &ldquo;${escapeHtml(nextT)}&rdquo;.` : ""}</p>`);
  const detail = useGuide && detailParts.length
    ? `<div style="margin:18px 0 6px;padding:16px 22px;background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;font-size:18px;line-height:1.65;color:#1f2328"><div style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:${kind.color};margin-bottom:6px">In detail</div>${detailParts.join("")}</div>`
    : "";

  return `
  <section class="step" id="step-${step.number}">
    <h2 class="step-h" style="background:${kind.color};color:#ffffff;margin:0;padding:10px 20px;font-size:22px;line-height:1.25"><span style="display:block;font-size:14px;letter-spacing:.09em;text-transform:uppercase;font-weight:700">Step ${step.number} of ${total}${partLabel}</span>${step.number}. ${escapeHtml(stepTitle)}</h2>
    <div class="prog"><span style="width:${pct}%;background:${kind.color}"></span></div>
    <div class="step-body">
      <h3 class="hero" style="background:${kind.color};color:#ffffff;border-radius:12px;padding:26px 30px 30px;margin:0 0 22px;font-size:46px;line-height:1.25;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.25)"><span style="display:block;font-size:17px;letter-spacing:.14em;text-transform:uppercase;font-weight:900;color:#ffffff;opacity:.92;margin-bottom:8px">&#9654; Step ${step.number} &mdash; ${kind.label}</span>${fmt(doText).replace(/<strong>/g, '<strong style="background:#ffffff;color:#14171a;padding:0 9px;border-radius:6px">')}</h3>
      ${where}
      ${actions}
      ${enterRows}
      ${see}
      <div class="shot-wrap">${imgHtml}</div>
      ${aboutText && !(useGuide && g.why) ? `<div class="why"><span class="bl">About this step</span><p>${escapeHtml(aboutText)}</p></div>` : ""}
      ${points}
      ${tip}${warning}${validation}
      ${detail}
      <div style="display:table;width:100%;margin-top:14px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:15px">
        <span style="display:table-cell;text-align:left">${step.number > 1 ? `<a href="#step-${step.number - 1}" style="color:${kind.color};font-weight:700;text-decoration:none">&larr; Step ${step.number - 1}</a>` : ""}</span>
        <span style="display:table-cell;text-align:right">${step.number < total ? `<a href="#step-${step.number + 1}" style="color:${kind.color};font-weight:700;text-decoration:none">Next: step ${step.number + 1} &rarr;</a>` : `<b style="color:#166534">&#10004; Last step</b>`}</span>
      </div>
    </div>
  </section>`;
}

function renderPhases(tour, ctx) {
  const { guide, useGuide, lang } = ctx;
  const phases = useGuide && guide && Array.isArray(guide.phases) ? guide.phases : null;
  const stepHtml = (s) => renderStep(s, ctx);

  if (!phases) return tour.steps.map(stepHtml).join("\n");

  const out = [];
  phases.forEach((p, i) => {
    const inPhase = tour.steps.filter((s) => s.number >= p.from && s.number <= p.to);
    if (!inPhase.length) return;
    out.push(`
  <div class="phase" id="part-${i + 1}">
    <div class="phase-no">Part ${i + 1}</div>
    <div class="phase-body">
      <h2>${escapeHtml(p.title)}</h2>
      ${p.summary ? `<p>${escapeHtml(p.summary)}</p>` : ""}
      <div class="phase-range">Steps ${p.from}–${p.to}</div>
    </div>
  </div>`);
    out.push(inPhase.map(stepHtml).join("\n"));
    if (p.checkpoint) {
      out.push(`
  <div class="checkpoint"><span class="cp-ic">✔</span><div><span class="bl">Checkpoint — end of Part ${i + 1}</span>${fmt(p.checkpoint)}</div></div>`);
    }
  });
  // Steps not covered by any phase (shouldn't happen, but never drop content).
  const covered = new Set(phases.flatMap((p) => tour.steps.filter((s) => s.number >= p.from && s.number <= p.to).map((s) => s.number)));
  const rest = tour.steps.filter((s) => !covered.has(s.number));
  if (rest.length) out.push(rest.map(stepHtml).join("\n"));
  return out.join("\n");
}

function renderCover(tour, ctx, title, desc) {
  const { guide, useGuide, lang, total } = ctx;
  const g = useGuide && guide ? guide : {};
  const list = (items) => `<ul>${items.map((x) => `<li>${fmt(x)}</li>`).join("")}</ul>`;

  const goalBanner = (g.goal || desc)
    ? `<div class="goal"><span class="g-lbl">What you will do</span>${fmt(g.goal || desc)}${g.audience ? `<div class="aud">For: ${fmt(g.audience)}</div>` : ""}</div>`
    : "";
  const cols = [];
  if (Array.isArray(g.before) && g.before.length)
    cols.push(`<div class="g-col"><span class="g-lbl">Before you start</span>${list(g.before)}</div>`);
  if (Array.isArray(g.outcome) && g.outcome.length)
    cols.push(`<div class="g-col"><span class="g-lbl">When you are done</span>${list(g.outcome)}</div>`);
  const glance = cols.length ? `<div class="cols">${cols.join("")}</div>` : "";

  const phases = useGuide && Array.isArray(g.phases) ? g.phases : null;
  const toc = phases
    ? `<nav class="parts"><span class="parts-t">Jump to</span>${phases
        .map((p, i) => `<a href="#part-${i + 1}"><b>${i + 1}</b> ${escapeHtml(p.title)} <i>steps ${p.from}–${p.to}</i></a>`)
        .join("")}</nav>`
    : "";

  const legend = `<div class="legend"><span class="legend-t">How to read each step</span>
      <span class="kind" style="background:${KINDS.CLICK.color}">CLICK</span> press or open something
      <span class="kind" style="background:${KINDS.ENTER.color}">ENTER</span> type a value
      <span class="kind" style="background:${KINDS.REVIEW.color}">REVIEW</span> read the screen, no action needed</div>`;

  const notes = Array.isArray(g.notes) && g.notes.length
    ? `<details class="notes"><summary>Notes about the screenshots and the test data</summary>${g.notes.map((n) => `<p>${fmt(n)}</p>`).join("")}</details>`
    : "";

  return `
  <header class="cover">
    <div class="eyebrow">Step-by-step user guide · ${escapeHtml(langName(lang))} · ${total} step${total === 1 ? "" : "s"}</div>
    <h1>${escapeHtml(title)}</h1>
    ${goalBanner}
    ${glance}
    ${legend}
    ${toc}
    ${notes}
    <a class="start" href="#step-1">Start with Step 1 &darr;</a>
  </header>`;
}

function renderStepNav(tour, ctx) {
  const { guide, useGuide } = ctx;
  const dots = tour.steps
    .map((st) => {
      const g = (useGuide && guide && guide.steps && guide.steps[String(st.number)]) || {};
      const k = KINDS[g.kind] ? g.kind : deriveKind(st);
      return `<a href="#step-${st.number}" title="Step ${st.number}: ${escapeHtml(g.title || st.title || "")}" style="background:${KINDS[k].color}">${st.number}</a>`;
    })
    .join("");
  return `<nav class="stepnav" aria-label="Steps">${dots}</nav>`;
}

function renderQuickRef(tour, ctx) {
  const { guide, useGuide, lang } = ctx;
  if (!(useGuide && guide && guide.steps)) return "";
  const rows = tour.steps
    .map((s) => {
      const g = guide.steps[String(s.number)] || {};
      const k = KINDS[g.kind] ? g.kind : deriveKind(s);
      const text = g.do || tr(s.title, s.title_i18n, lang);
      return `<tr><td class="qn"><a href="#step-${s.number}">${s.number}</a></td><td class="qk"><span class="kind" style="background:${KINDS[k].color}">${KINDS[k].label}</span></td><td>${fmt(text)}</td></tr>`;
    })
    .join("");
  return `
  <details class="quickref">
    <summary>All steps at a glance — one-page checklist</summary>
    <p class="qsub">Click a number to jump to that step.</p>
    <table><tbody>${rows}</tbody></table>
  </details>`;
}

function renderGlossary(ctx) {
  const { guide, useGuide } = ctx;
  if (!(useGuide && guide && Array.isArray(guide.glossary) && guide.glossary.length)) return "";
  return `
  <section class="glossary">
    <h2>Glossary</h2>
    <table><tbody>${guide.glossary
      .map((t) => `<tr><td class="t">${escapeHtml(t.term)}</td><td>${fmt(t.meaning)}</td></tr>`)
      .join("")}</tbody></table>
  </section>`;
}

const CSS = `
  .stepnav { position: fixed; right: 8px; top: 70px; bottom: 20px; width: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; z-index: 5; }
  .stepnav a { display: block; text-align: center; color: #fff; font-size: 12px; font-weight: 800; border-radius: 50%; width: 26px; height: 26px; line-height: 26px; text-decoration: none; opacity: .85; }
  .stepnav a:hover { opacity: 1; transform: scale(1.15); }
  @media (max-width: 1100px) { .stepnav { display: none; } }
  @media print { .stepnav { display: none; } }

  .goal { border-left: 8px solid #714B67; background: #f6f1f5; border-radius: 8px; padding: 12px 18px; margin: 0 0 14px; font-size: 1.12rem; }
  .goal .aud { margin-top: 6px; font-size: .92rem; color: #4b5563; }
  .cols { display: flex; flex-wrap: wrap; gap: 14px; margin: 0 0 14px; }
  .g-col { flex: 1 1 320px; border: 1px solid #e2d7de; border-radius: 10px; background: #fbf8fa; padding: 10px 16px; }
  .g-col ul { margin: 4px 0 0; padding-left: 20px; font-size: .95rem; }
  .parts { margin: 8px 0 12px; }
  .parts-t { font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #6b7280; margin-right: 8px; }
  .parts a { display: inline-block; margin: 3px 6px 3px 0; padding: 4px 12px; border-radius: 16px; background: #eee6ec; color: #4a2e42; text-decoration: none; font-size: .9rem; }
  .parts a b { background: #714B67; color: #fff; border-radius: 50%; display: inline-block; width: 20px; height: 20px; line-height: 20px; text-align: center; font-size: .75rem; margin-right: 4px; }
  .parts a i { color: #6b7280; font-size: .78rem; font-style: normal; }
  details.notes { margin: 10px 0 0; border: 1px solid #e2d7de; border-radius: 8px; padding: 8px 14px; background: #fcfafb; font-size: .92rem; }
  details.notes summary, details.quickref summary { cursor: pointer; font-weight: 700; color: #714B67; }
  details.quickref { margin: 0 0 30px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 18px; background: #fcfcfd; }
  .start { display: inline-block; margin-top: 14px; background: #714B67; color: #fff !important; text-decoration: none; font-weight: 800; font-size: 1.15rem; padding: 12px 26px; border-radius: 10px; }

  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1f2328; max-width: 960px; margin: 0 auto; padding: 28px 22px 60px; line-height: 1.6; background: #fff; }
  h1 { font-size: 2rem; line-height: 1.2; margin: 6px 0 18px; color: #2b2233; }
  h2 { font-size: 1.35rem; margin: 0 0 6px; }
  h3 { font-size: 1.3rem; margin: 0; line-height: 1.25; }
  .eyebrow { color: #714B67; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: .78rem; }
  .lead { font-size: 1.05rem; color: #374151; }
  .cover { border-bottom: 3px solid #714B67; padding-bottom: 22px; margin-bottom: 26px; }
  .glance { border: 1px solid #e2d7de; border-radius: 10px; background: #fbf8fa; padding: 6px 18px; margin-bottom: 16px; }
  .g-item { padding: 12px 0; border-bottom: 1px solid #eadfe6; }
  .g-item:last-child { border-bottom: 0; }
  .g-lbl { display: block; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #714B67; margin-bottom: 3px; }
  .g-item ul { margin: 4px 0 0; padding-left: 20px; }
  .legend { font-size: .88rem; color: #4b5563; line-height: 2.2; }
  .legend-t { font-weight: 700; color: #1f2328; margin-right: 8px; }
  .kind { display: inline-block; color: #fff; font-weight: 800; font-size: .72rem; letter-spacing: .09em; padding: 3px 10px; border-radius: 4px; margin: 0 4px 0 10px; }
  .toc { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 22px; margin-bottom: 30px; background: #fafafa; }
  .toc h2 { margin-bottom: 8px; }
  .toc ol { margin: 0; padding-left: 22px; }
  .toc li { margin-bottom: 8px; }
  .toc a { color: #714B67; text-decoration: none; }
  .toc .rng { color: #6b7280; font-size: .82rem; margin-left: 6px; }
  .toc .sub { color: #4b5563; font-size: .9rem; }
  .phase { display: table; width: 100%; margin: 44px 0 18px; background: #714B67; color: #fff; border-radius: 10px; }
  .phase-no { display: table-cell; vertical-align: middle; width: 96px; text-align: center; font-weight: 800; font-size: .8rem; letter-spacing: .1em; text-transform: uppercase; background: rgba(0,0,0,.18); border-radius: 10px 0 0 10px; padding: 14px 10px; }
  .phase-body { display: table-cell; vertical-align: middle; padding: 14px 20px; }
  .phase-body h2 { color: #fff; margin: 0 0 2px; }
  .phase-body p { margin: 2px 0 4px; color: #f1e6ee; }
  .phase-range { font-size: .78rem; color: #e7d3df; }
  .step { margin: 0 0 40px; border: 1px solid #d9dde3; border-radius: 14px; background: #fff; overflow: hidden; box-shadow: 0 2px 10px rgba(20,20,40,.07); }
  .step-band { display: table; width: 100%; color: #fff; padding: 14px 20px; }
  .step-band .num { display: table-cell; vertical-align: middle; width: 64px; min-width: 64px; height: 64px; text-align: center; background: rgba(255,255,255,.95); color: #1f2328; font-weight: 900; font-size: 2.2rem; border-radius: 50%; line-height: 64px; }
  .band-txt { display: table-cell; vertical-align: middle; padding-left: 18px; }
  .step-of { display: block; font-size: .78rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; opacity: .9; }
  .step-band h3 { color: #fff; font-size: 1.8rem; margin: 2px 0 0; }
  .prog { height: 6px; background: #e5e7eb; }
  .prog span { display: block; height: 6px; }
  .step-body { padding: 20px 22px 22px; }
  .hero { border: 3px solid; border-left-width: 12px; border-radius: 12px; padding: 16px 20px 18px; margin: 0 0 16px; box-shadow: 0 3px 12px rgba(0,0,0,.08); }
  .hero-lbl { font-size: .82rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
  .hero-do { font-size: 2.25rem; line-height: 1.35; font-weight: 800; color: #14171a; }
  .hero-do strong { background: #fff; padding: 1px 7px; border-radius: 5px; border: 1px solid rgba(0,0,0,.18); }
  .where { margin: 0 0 14px; }
  .where-lbl { display: block; font-size: .72rem; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .crumb { display: inline-block; background: #eef0f3; border: 1px solid #d4d8de; border-radius: 6px; padding: 3px 11px; font-weight: 700; font-size: .95rem; }
  .sep { display: inline-block; margin: 0 7px; color: #9ca3af; font-weight: 800; }
  .acts { margin: 0 0 16px; }
  .acts-title { font-size: 1.05rem; color: #14171a; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: #374151; margin-bottom: 6px; }
  .act { display: table; width: 100%; margin-bottom: 10px; border-left: 6px solid #cbd5e1; background: #f8f9fb; border: 1px solid #e2e5ea; border-radius: 10px; padding: 8px 12px; box-sizing: border-box; }
  .act .an { display: table-cell; width: 44px; min-width: 44px; height: 44px; font-size: 1.25rem; text-align: center; vertical-align: middle; color: #fff; font-weight: 800; border-radius: 50%; line-height: 44px; }
  .act .at { display: table-cell; vertical-align: middle; padding: 0 0 0 14px; font-size: 1.3rem; line-height: 1.4; font-weight: 600; }
  .checkpoint { display: table; width: 100%; border: 2px solid #86d19f; background: #ecfdf3; border-radius: 12px; padding: 14px 18px; margin: -10px 0 30px; }
  .checkpoint .cp-ic { display: table-cell; width: 44px; font-size: 1.7rem; color: #15803d; vertical-align: middle; }
  .checkpoint > div { display: table-cell; vertical-align: middle; }
  .checkpoint .bl { color: #166534; }
  table.enter { border-collapse: collapse; width: 100%; margin: 0 0 12px; font-size: .98rem; }
  table.enter th { text-align: left; background: #0f766e; color: #fff; padding: 7px 12px; font-size: .78rem; letter-spacing: .06em; text-transform: uppercase; }
  table.enter td { padding: 9px 12px; border: 1px solid #cfe7e3; }
  table.enter td.f { width: 28%; font-weight: 700; background: #f2faf9; }
  table.enter td.v { font-weight: 700; font-size: 1.02rem; background: #fffbe6; }
  .bl { display: block; font-size: .72rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 2px; color: #6b7280; }
  .why { margin: 0 0 12px; background: #f6f3f8; border-left: 6px solid #714B67; border-radius: 8px; padding: 10px 16px; }
  .why p { margin: 0; color: #374151; }
  ul.points { margin: 0 0 10px; padding-left: 22px; color: #374151; }
  ul.points li { margin-bottom: 3px; }
  .box { display: table; width: 100%; border-radius: 8px; padding: 10px 14px; margin: 0 0 10px; border: 1px solid; font-size: .95rem; }
  .box .ic { display: table-cell; width: 34px; vertical-align: top; font-size: 1.1rem; }
  .box > div { display: table-cell; vertical-align: top; }
  .box.see { background: #ecfdf3; border-color: #a6e3bf; }
  .box.see .bl { color: #166534; }
  .box.tip { background: #eff6ff; border-color: #bcd3f7; }
  .box.tip .bl { color: #1d4ed8; }
  .box.warn { background: #fff7e6; border-color: #f4c97a; }
  .box.warn .bl { color: #b45309; }
  .box.note { background: #f8f5f7; border-color: #e2d7de; }
  .box.note p { margin: 2px 0; }
  .shot-wrap { margin: 18px 0; }
  .fig { margin: 0 0 14px; }
  .fig-lbl { font-size: .85rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #374151; margin-bottom: 4px; }
  .fig-lbl.ok { color: #166534; }
  .fig-lbl .red { color: #e01e5a; }
  .shot { max-width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; margin-top: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .shot-cap { font-size: .78rem; color: #6b7280; margin-top: 4px; }
  .shot-cap .red { color: #e01e5a; font-weight: 700; }
  .result-lbl { margin: 14px 0 2px; font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #166534; }
  .missing { color: #9ca3af; font-style: italic; }
  .quickref { margin: 0 0 40px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px 6px; background: #fcfcfd; }
  .qsub { color: #6b7280; margin: 2px 0 10px; }
  .quickref table { border-collapse: collapse; width: 100%; }
  .quickref td { border-bottom: 1px solid #e5e7eb; padding: 7px 10px; vertical-align: middle; }
  .quickref td.qn { width: 44px; text-align: center; font-weight: 800; }
  .quickref td.qn a { color: #714B67; text-decoration: none; }
  .quickref td.qk { width: 96px; }
  .quickref .kind { margin: 0; }
  .glossary { margin-top: 44px; }
  .glossary table { border-collapse: collapse; width: 100%; }
  .glossary td { border: 1px solid #e5e7eb; padding: 9px 12px; vertical-align: top; }
  .glossary td.t { width: 26%; font-weight: 700; background: #faf7f9; }
  .footer { color: #9ca3af; font-size: .8rem; margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  @media print { body { padding: 0; } .phase { page-break-after: avoid; } }
`;

function genHtml(tour, lang, total, guide) {
  const dir = shotDir(tour.slug);
  const title = tr(tour.name, tour.name_i18n, lang);
  const desc = tr(tour.description, tour.description_i18n, lang);

  // The guide is written in English: only apply it to a language whose recorded
  // step text is still the untranslated English (otherwise we would mix languages).
  const enFirst = tour.steps[0] ? tr(tour.steps[0].content, tour.steps[0].content_i18n, "en_US") : "";
  const thisFirst = tour.steps[0] ? tr(tour.steps[0].content, tour.steps[0].content_i18n, lang) : "";
  const useGuide = !!guide && (lang === "en_US" || enFirst === thisFirst);

  const ctx = { tour, lang, total, dir, guide, useGuide };

  return `<!DOCTYPE html>
<html lang="${lang.replace("_", "-")}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
${renderStepNav(tour, ctx)}
${renderCover(tour, ctx, title, desc)}
${renderQuickRef(tour, ctx)}
${renderPhases(tour, ctx)}
${renderGlossary(ctx)}
<script>
(function () {
  // Close-up: find the red outline drawn around the target in each "Before" screenshot and show a zoomed crop of it.
  function crop(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var x = c.getContext("2d"); x.drawImage(img, 0, 0);
    var d; try { d = x.getImageData(0, 0, w, h).data; } catch (e) { return; }
    var minX = w, minY = h, maxX = -1, maxY = -1, n = 0;
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      var i = (yy * w + xx) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (r > 205 && g < 70 && b > 60 && b < 130) { n++; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (yy < minY) minY = yy; if (yy > maxY) maxY = yy; }
    }
    if (n < 40 || maxX <= minX || maxY <= minY) return;
    var pad = 70, sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    var sw = Math.min(w - sx, (maxX - minX) + 2 * pad), sh = Math.min(h - sy, (maxY - minY) + 2 * pad);
    var scale = Math.min(2.2, 880 / sw); if (sw * scale < 360) scale = 360 / sw;
    var o = document.createElement("canvas"); o.width = Math.round(sw * scale); o.height = Math.round(sh * scale);
    o.style.cssText = "max-width:100%;height:auto;border:3px solid #e01e5a;border-radius:8px;box-shadow:0 3px 10px rgba(0,0,0,.2)";
    o.getContext("2d").drawImage(c, sx, sy, sw, sh, 0, 0, o.width, o.height);
    var box = img.parentNode.querySelector(".closeup");
    if (!box) return;
    box.innerHTML = '<div style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;color:#e01e5a;margin:0 0 4px">&#128269; Look for this on your screen (close-up)</div>';
    box.appendChild(o); box.style.cssText = "display:block;margin:0 0 14px";
  }
  document.querySelectorAll("img.shot-before").forEach(function (img) {
    if (img.complete) crop(img); else img.addEventListener("load", function () { crop(img); });
  });
})();
</script>
  <div class="footer">Generated by tour2playwright from a Tour Recorder export · screenshots captured by an automated run of the same steps.</div>
</body>
</html>
`;
}

/**
 * @param {object} tour normalized tour
 * @param {object|null} guide optional enrichment (see loadGuide)
 * @returns {Array<{filename:string, content:string, lang:string}>}
 */
export function genManuals(tour, guide = null) {
  const total = tour.steps.length;
  return tour.langs.map((lang) => ({
    lang,
    filename: `${tour.slug}.${lang}.html`,
    content: genHtml(tour, lang, total, guide),
  }));
}
