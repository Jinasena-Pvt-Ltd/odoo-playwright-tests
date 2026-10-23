# Handover — tour2playwright (tours → module-native tests → manuals)

_Vendored into `Playwright_HR` from `tour_recorder`'s `tools/tour2playwright/` (originally
shipped there in PR #10, merged to `main`). Originally last updated 2026-09-03._

## 0. Adaptations made when vendoring into `Playwright_HR`

Several changes from the upstream `tour_recorder` version, all deliberate:

1. **No separate `.env`.** `src/env.mjs` reads the repo-root `.env`
   (`D:\Playwright_HR\.env`) instead of a local `tools/tour2playwright/.env`, and
   aliases this repo's variable names onto what the tool expects:
   `ODOO_URL ← ODOO_BASE_URL`, `ODOO_LOGIN ← ADMIN_EMAIL`,
   `ODOO_PASSWORD ← ADMIN_PASSWORD`, `ODOO_DB` unchanged.
2. **Output lands inside the target module, not a standalone `generated/` tree.**
   `generate` writes the spec directly to
   `src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts`, and
   `manual` writes the HTML manual to `src/modules/<domain>/documentation/`.
   Both are real, committed source — not gitignored output.
3. **The generated spec is a first-class citizen of the framework.** It's wrapped
   in `test.describe('<Tour Name> @module:<domain> @step:business @e2e', ...)`
   and imports from `../../../../core/fixtures/index` instead of
   `@playwright/test` directly — so it shows up in `npm test`, the master
   report, and passes `/review-tests` like any hand-written spec.
4. **No bundled runner.** `playwright.config.ts` and `src/auth.setup.mjs` were
   **removed** — the generated spec now executes via the **main suite's own**
   `npx playwright test <path> --project=admin` (reusing `auth-storage/admin.json`),
   run from the repo root by `cli.mjs`'s `build` command. `tools/tour2playwright/`
   has zero npm dependencies of its own as a result — it's a pure Node-builtins
   CLI that generates code and shells out to the already-installed main suite.
5. **HTML-only manuals.** The original Markdown output was dropped entirely —
   only the self-contained HTML (embedded base64 screenshots) is generated,
   since that's the one meant to be pasted into Odoo Knowledge and there's no
   reason to maintain two formats nobody reads.

Everything else below describes the tool's core translation logic, which is
unchanged from the original handover.

## 1. What it is & why
A **standalone Node CLI** (NOT part of the Odoo runtime) that reuses a Tour Recorder
**JSON export** as the single source of truth to generate two derived artifacts,
now written directly into the target module:

1. **A Playwright e2e spec** — one `test.describe(...)` per tour, tagged and
   structured like every other spec in the framework, so a guide doubles as a
   regression test (does the documented flow still work after an odoo.sh upgrade?).
2. **An illustrated HTML user manual** — one per language (EN/SI/TA), each
   step with a **real screenshot captured while Playwright runs the flow**,
   embedded as base64 so the file is paste-ready for Odoo Knowledge.

The pipeline deliberately goes **JSON → spec → run → manual** (not JSON → manual directly):
running the flow both **verifies** it and **produces the screenshots** the manual embeds.

```
Tour Recorder export (.json)
   ├─ generate ─► src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts
   │                 └─ npx playwright test ... --project=admin (main suite)
   │                       └─► tools/tour2playwright/generated/screenshots/<slug>/step-NN.png (scratch)
   └─ manual ──────────────────────────────► src/modules/<domain>/documentation/<slug>.<lang>.html
```

## 2. Files & responsibilities (`tools/tour2playwright/`)
- `package.json` — zero dependencies; scripts `gen`, `manual`, `build`.
- `src/env.mjs` — zero-dep loader for the **repo-root** `.env`, imported by `cli.mjs`.
  Aliases `ODOO_BASE_URL`/`ADMIN_EMAIL`/`ADMIN_PASSWORD` onto `ODOO_URL`/`ODOO_LOGIN`/
  `ODOO_PASSWORD`.
- `src/loadTours.mjs` — read/validate `{version:2, tours:[…]}`, **slugify** tour name (file/dir
  names), collect languages, `tr(flat, i18n, lang)` fallback helper.
- `src/translate.mjs` — **the interesting part**: Odoo/jQuery selector + `run`-DSL → Playwright,
  flagging anything it can't map faithfully (see §4). Unchanged since vendoring.
- `src/genSpec.mjs` — tour + domain → `.spec.ts` source, module-tagged and using the
  shared fixtures import; screenshot-before-action with the target outlined,
  then the mapped action. `SHOT_DIR` is repo-root-relative since the spec
  always executes with cwd = repo root.
- `src/genManual.mjs` — tour + captured screenshots → per-language HTML (base64-embedded).
- `src/cli.mjs` — commands `generate | manual | build`, all `<domain>`-first; writes
  `generated/REVIEW.md` (scratch); `build` shells out to the main suite's own runner.
- `src/names.mjs` — path helpers: `specsDirFor(domain)`/`docsDirFor(domain)` resolve
  into `src/modules/<domain>/`; `shotDir()`/`shotDirFromRepoRoot()` keep the tool's
  own scratch screenshot dir consistent between the CLI (cwd = tool dir) and the
  generated spec itself (cwd = repo root).

## 3. Input contract — the export JSON (`version: 2`)
Unchanged from the original handover. Produced by **Manage Tours → Action → Export Tours**.
Shape the tool depends on (do NOT break these keys):
```
{ "version": 2, "tours": [ {
    "name", "name_i18n": {lang:val}, "description", "description_i18n": {lang:val},
    "steps": [ {
        "sequence", "title", "title_i18n", "trigger" (CSS), "content", "content_i18n",
        "position", "run", "is_check",
        "validation_type", "validation_regex", "validation_message", "validation_message_i18n"
    } ]
} ] }
```
No `id`/`tour_key` in the export → file/dir names derive from a **slug of the English
`name`** (`loadTours.slugify`); duplicate names get `-2`, `-3` suffixes.

## 4. Translation layer (`translate.mjs`) — best-effort, flags the rest
Unchanged. Odoo steps don't all map 1:1 onto Playwright:
- **Selectors:** `:contains('x')`→`.filter({hasText})` / `getByText`; `:eq(n)`/`:first`/`:last`
  →`.nth(n)`/`.first()`/`.last()`; `:visible` dropped (Playwright auto-waits); `.first()` guard
  against strict-mode multi-match. `:iframe`, `:has`, other jQuery pseudos → kept literal +
  `// TODO: verify selector`.
- **Actions (`run`):** `click`→`.click()`; `edit/text V`→`.fill("V")`; `check`/`uncheck`;
  `select V`→`.selectOption`; `hover`; `press KEY`; `is_check:true`→`expect(loc).toBeVisible()`.
  Editor/drag/custom `run` → a `// TODO` stub that only asserts visibility.
- Everything flagged is also collected into **`generated/REVIEW.md`** — treat generated specs as
  a **strong first draft**, review that file, fix flagged steps directly in the committed spec.

## 5. Usage
```bash
cd tools/tour2playwright
npm run gen    -- hr ../../path/export.json   # write spec into src/modules/hr/tests/02-business/ (+ REVIEW.md)
npx playwright test src/modules/hr/tests/02-business/hr.<slug>-tour.spec.ts --project=admin   # run it (main suite), capture screenshots
npm run manual -- hr ../../path/export.json   # build the HTML manual into src/modules/hr/documentation/
npm run build  -- hr ../../path/export.json   # all three end-to-end
```
Credentials come from the repo-root `.env` — no separate setup step. No `npm install`
needed inside this tool (zero dependencies) beyond what the main repo already has.

⚠️ **The generated spec performs real clicks** on whatever Odoo instance the root `.env`
points at and can create real records — the same instance this repo's test suite already
exercises, so the same caution applies as running any other test here.

## 6. Outputs
- `src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts` — real, committed
- `src/modules/<domain>/documentation/<slug>.<lang>.html` — real, committed
- `tools/tour2playwright/generated/screenshots/`, `generated/REVIEW.md` — scratch, gitignored

## 7. Known limitations
- **Best-effort translation** (see §4) — always review `REVIEW.md`.
- **Screenshots captured once** (in the run's UI language) and **shared across all language
  manuals** — per-language screenshots would need a run per user language (future enhancement).
- **Start point:** specs `goto(ODOO_START_PATH || "/web")`. If a guide starts on a specific
  screen, set that env var or edit the spec's opening `goto`.
- **Anti-cheat / determinism:** relies on stable selectors; brittle Odoo selectors may need
  manual fixing after generation.
- **HTML manual styling is intentionally minimal** — Odoo Knowledge's paste handler normalizes
  most CSS anyway, so the HTML sticks to semantic headings/paragraphs/images rather than
  elaborate styling that wouldn't survive the paste.
- **Requires `auth-storage/admin.json` to already exist** — run `npx playwright test --project=setup`
  once (a normal First-Day-Setup step) before `build`/running the generated spec.

## 8. gitignore
Only `tools/tour2playwright/generated/` needs to stay gitignored (scratch screenshots + REVIEW.md).
The generated spec and HTML manual are real source under `src/modules/`, committed normally.

## 9. Where to extend
- **New `run` verb / selector pseudo:** add a case in `translate.mjs` (`parseRun` / `selectorToLocator`).
- **Per-language screenshots:** parametrize the spec-run step + `genSpec` to run per lang and
  namespace screenshots by lang; `genManual` already keys by lang.
- **PDF manuals:** add a formatter alongside `genManual.mjs`.
- **CI:** `npm run build -- <domain> export.json` is the single entry point; wire it after a staging deploy.
