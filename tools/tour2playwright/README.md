# tour2playwright

Turn **Tour Recorder** guides into a **Playwright regression test** and an
**illustrated HTML user manual** — written directly into the target module's
own structure, from the same JSON export.

```
Tour Recorder export (.json)
        │
        ├─►  generate  ─►  src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts
        │                        │
        │              npx playwright test (main suite, admin role)
        │                        │
        │                     screenshots (scratch, gitignored)
        │                        │
        └─►  manual  ─────────────►  src/modules/<domain>/documentation/<slug>.<lang>.html
```

The pipeline goes **JSON → spec → run → manual** on purpose: running the flow both
**verifies the guide still works** and **captures a screenshot of every step**, which
the manual embeds. One manual is produced per language found in the export
(EN / SI / TA); screenshots are shared across languages.

**This is fully integrated into the framework**, not a standalone side tool:
- The generated spec is tagged `@module:<domain> @step:business @e2e`, imports
  from `../../../../core/fixtures/index` (not `@playwright/test` directly), and
  lands in the module's own `tests/02-business/` folder — it shows up in
  `npm test`, the master report, and passes `/review-tests` like any other spec.
- It runs via the **main suite's own runner and auth** (`npx playwright test
  <path> --project=admin`, reusing `auth-storage/admin.json`) — there is no
  separate login flow, no separate `.env`, no separate Playwright install for
  this tool. `tools/tour2playwright/` has zero npm dependencies of its own.

## Prerequisites

- The target module must already exist — scaffold it first with `/add-module <domain>` if it doesn't.
- The main suite's `admin` auth session must exist (`auth-storage/admin.json`) — run `npx playwright test --project=setup` once if you haven't already (see the repo's First-Day Setup).
- Credentials come from the repo-root `.env` (the same one the test suite uses) — nothing separate to configure here.

## Get a tour export

In Odoo: **Tour Recorder → Manage Tours →** select tours **→ Action → Export Tours**,
and download the `.json`.

## Usage

Run from `tools/tour2playwright/`:

```bash
# 1) Generate a spec into the target module
npm run gen -- hr ../../path/to/tour_export.json

# 2) Run it via the main suite — verifies the flow AND captures per-step screenshots
npx playwright test src/modules/hr/tests/02-business/hr.<slug>-tour.spec.ts --project=admin

# 3) Build the illustrated manual (uses the screenshots from step 2)
npm run manual -- hr ../../path/to/tour_export.json

# …or do all three at once:
npm run build -- hr ../../path/to/tour_export.json
```

Replace `hr` with whatever module the tour belongs to.

## Outputs

- `src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts` — a real, committed Playwright spec
- `src/modules/<domain>/documentation/<slug>.<lang>.html` — a real, committed, self-contained HTML manual per language (embedded screenshots) — **open this in a browser and paste it directly into Odoo Knowledge**
- `generated/screenshots/`, `generated/REVIEW.md` under `tools/tour2playwright/` — scratch/intermediate, gitignored, not committed

⚠️ **The generated spec performs real clicks** on whatever Odoo instance the root `.env` points at
and can create real records — the same instance this repo's test suite already
exercises, so the same caution applies as running any other test here.

## Known limitations — read `generated/REVIEW.md`

Odoo tour steps don't all map 1:1 onto Playwright, so the generator is best-effort and
flags what it can't translate faithfully with `// TODO:` comments (collected in
`generated/REVIEW.md` after `generate`/`build`):

- **jQuery-extended selectors.** `:contains('x')` → `.filter({ hasText })`,
  `:eq(n)`/`:first`/`:last` → `.nth(n)`/`.first()`/`.last()`, `:visible` is dropped
  (Playwright auto-waits on visibility). `:iframe`, `:has`, and other jQuery pseudos
  are left literal and flagged — fix them by hand.
- **Run DSL.** `click`, `edit/text VALUE` (→ `fill`), `check`/`uncheck`, `select VALUE`,
  `hover`, `press KEY`, and "Check only" (→ `expect(...).toBeVisible()`) are mapped.
  Editor/drag/custom-function runs become a `// TODO` stub asserting visibility.
- **Start point.** Specs open `ODOO_START_PATH` (default `/web`). If a guide begins on
  a specific screen, set that env var or edit the spec's opening `goto`.
- **Localized screenshots.** Screenshots are captured once (in the run's UI language)
  and reused for every language's manual. Per-language screenshots would require
  re-running with each user language — a future enhancement.

Treat generated specs as a **strong first draft**: review `REVIEW.md`, fix flagged
steps directly in the committed spec, then keep them as regression tests.
