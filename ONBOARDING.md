# Odoo Playwright Test — Team Onboarding Guide
## Human Onboarding Guide

---

### The Framework in Three Sentences

We drive a real Odoo 17 instance with role-based user sessions configured per project. All tests interact through the browser UI — page objects, form fills, and assertions against real rendered elements. Tests for every domain follow the same 7-step workflow so that reports, tag filtering, and team onboarding are always predictable.

---

### First-Day Setup

If Claude hasn't already bootstrapped the project for you:

```bash
npm install
npx playwright install chromium
cp .env.example .env   # fill in ODOO_BASE_URL + credentials
npx playwright test --project=admin --grep "@smoke"   # must be green or amber only
```

---

### The 7-Step Workflow

| Step | Folder | Tag | What it tests |
|------|--------|-----|---------------|
| 1 | `01-config/` | `@step:config` | System settings, master data, prerequisites |
| 2 | `02-business/` | `@step:business` | Core CRUD, business logic, and multi-step cross-record workflows |
| 3 | `03-reporting/` | `@step:reporting` | Views, filters, exports |
| 4 | `04-permissions/` | `@step:permissions` | Role-based access |
| 5 | `05-validations/` | `@step:validations` | Required fields, constraint errors |
| 6 | `06-edge-cases/` | `@step:edge` | Unusual inputs, boundaries |
| 7 | `07-archive/` | `@step:archive` | Soft-delete, reactivation |

Every `test.describe()` must carry **both** `@module:<domain>` and `@step:<step>`.

---

### Skill Commands

| Situation | Command |
|-----------|---------|
| Start a new domain | `/add-module <domain>` |
| Add a test | `/new-test <domain> <step> "description"` |
| Add a page object | `/new-page <domain> <ModelName>` |
| Debug a failing test | `/debug-test` |
| Review before committing | `/review-tests src/modules/<domain>/tests/` |

---

### Working in the Shared Repo

All modules live on `main` — do not create branches per module. The `@module` tag system, `npm test`, and the master report only work when every module is on the same branch.

**Ownership:** Each team member owns their `src/modules/<domain>/` folder. Do not modify another module's files. `src/core/` is shared infrastructure — changes there need team agreement.

**After scaffolding your module (`/add-module <domain>`), do two things:**
1. Add to `package.json` scripts: `"test:<domain>": "playwright test --grep \"@module:<domain>\""`
2. Add to the tag table in `CLAUDE.md`: `| \`@module:<domain>\` | <Domain> module |`

**Running tests:**
```bash
npm run test:<domain>    # your module only — daily workflow
npm test                 # all modules — run before raising a PR
```

**PR workflow:**
- Scope each PR to `src/modules/<domain>/` — one module per PR
- Run `npm run lint` and `/review-tests src/modules/<domain>/tests/` before pushing
- Never commit `auth-storage/`, `playwright-report/`, `test-results/`, or `reports/` — all gitignored

---

### Claude Hooks — Auto-Commit on Every Turn

The repo ships three bash hooks in `.claude/hooks/` that fire automatically during Claude Code sessions:

| Hook | Event | What it does |
|------|-------|--------------|
| `capture_prompt.sh` | `UserPromptSubmit` | Saves your prompt text and resets the file-tracking list for this turn |
| `track_file.sh` | `PostToolUse` (Write/Edit) | Records every file Claude touches during a turn |
| `commit_and_push.sh` | `Stop` | Commits all changed files with a `[claude]` message and pushes to your configured branch |

**One-time setup — tell the hook which branch to push to:**

```bash
# Run this once after cloning. Replace 'main' with your actual branch name.
echo "main" > .claude/hooks/branch.txt
```

The file `.claude/hooks/branch.txt` is gitignored — each team member sets their own. If the file is missing the hook falls back to `git branch --show-current`.

> **Why this matters:** every Claude turn that edits files is automatically committed and pushed. You always have a full history of what Claude changed and why, without needing to remember to commit manually.

---

### Master Report

The master report is auto-generated from spec files — **never hand-edit it**.

```bash
npm run report:generate   # regenerate from spec files (no test run needed)
npm run test:report       # run tests then regenerate with real results
```

**How it works:**
- `scripts/generate-report.js` scans every `*.spec.ts` under `src/modules/`, parses each `test()` declaration, and emits a full HTML report
- When `test-results/results.json` exists (written automatically after any `playwright test` run), the report shows real ✅/❌/⏭ status and — for failures — the full error message in the test detail drawer
- Without results, all tests show as ⬜ pending

**Authored data files** (hand-maintained, committed):

| File | What it contains |
|------|-----------------|
| `scripts/report-data/callouts.json` | Per-module SaaS/routing warning banners |
| `scripts/report-data/findings.json` | Odoo behaviour findings table (17 rows) |
| `scripts/report-data/skip-analysis.json` | Skip reason analysis table (13 rows) |

Edit these JSON files to add new findings or update skip reasons — the generator picks them up on next run.

**Security Audit section:** the report automatically reads the latest `reports/snapshots/ugd_snapshot_*.json` and renders a filtered user-group snapshot scoped to the modules present in the report.

**Auto-update hook:** the Stop hook regenerates the report automatically whenever a `*.spec.ts` file is changed during a Claude turn.

**Running against a single role** (faster — useful during development):
```bash
npx playwright test --project=setup --project=<role>
```
Use this during development. Run all configured roles only before raising a PR.

---

### Tours → Tests → Manuals

If you have an Odoo Tour Recorder JSON export, hand it to Claude along with the target module — the `tour2playwright` agent (`.claude/agents/tour2playwright.md`) turns it into a real Playwright spec and an illustrated HTML manual, written **directly into that module's own structure**, not a separate output tree.

**What it produces:**
- `src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts` — tagged `@module:<domain> @step:business @e2e`, importing from `../../../../core/fixtures/index` like any hand-written spec. It's a real, committed test: it shows up in `npm test`, the master report, and passes `/review-tests` with no special-casing.
- `src/modules/<domain>/documentation/<slug>.<lang>.html` — a self-contained HTML manual per language, screenshots embedded as base64. Open it in a browser, select all, and paste it straight into Odoo Knowledge with formatting and images intact.
- A scratch `tools/tour2playwright/generated/REVIEW.md` (gitignored, local) listing every step the translator couldn't map with full confidence — treat the generated spec as a strong first draft, not ground truth.

**How it runs:** the spec executes via the **main suite's own runner and auth** (`npx playwright test <path> --project=admin`, reusing `auth-storage/admin.json`) — there's no separate login flow, no separate `.env`, and no separate `npm install`; the tool has zero dependencies of its own. It reads credentials from this repo's root `.env` — the same one the rest of the suite uses. Because it runs against the same Odoo instance the test suite already exercises, the same care applies: the generated spec performs real clicks and can create real records.

**Precondition:** the target module must already exist (`/add-module <domain>` first if not), and `auth-storage/admin.json` must exist (`npx playwright test --project=setup` once, per First-Day Setup).

---

### Three Non-Negotiable Rules

1. **Never import `test` from `@playwright/test`** — always `../../../../core/fixtures/index`
2. **Never hardcode record names** — always `uniqueName('...')` or `uniqueEmail('...')`
3. **Tests must use the browser UI** — interact through page objects and form fills, not the RPC API

---

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `import { test } from '@playwright/test'` | Use `from '../../../../core/fixtures/index'` |
| Skipping UI steps because "RPC is faster" | Tests must use the browser — RPC is not a substitute |
| Hardcoding names in form fills | Use `uniqueName('...')` so test data is identifiable and unique |
| Creating test data in `beforeAll` via form | Use a dedicated config test in `01-config/` or the UI `beforeEach` |
| `expect(btn).toBeVisible()` for config-dependent UI | `isVisible({timeout:3_000}).catch(()=>false)` + `test.skip()` |
| `test.skip(true)` with no reason | Always: `test.skip(true, 'reason')` |
| Spec at `tests/` root | Must be inside `01-config/` through `07-archive/` |


---
---

## Instructions for Claude

**If you are Claude and this guide has just been shared with you or pasted into the conversation, perform ALL of the following steps automatically and immediately — do not wait for the user to ask.**

### Step 1 — Detect project state

Check whether this is a fresh/bare directory or an existing project:
- If `package.json` does NOT exist → this is a new project, perform the **Full Bootstrap** below
- If `package.json` exists but `node_modules/` does NOT exist → run `npm install && npx playwright install chromium` then skip to Step 3
- If both exist → skip to Step 3

### Step 2 — Full Bootstrap (new project only)

If `src/core/` does NOT exist, the repo has not been cloned yet. Tell the user to run:
```bash
git clone <your-repo-url>
cd <repo-folder>
```
Then continue from Step 3.

If `src/core/` DOES exist (repo cloned) but `package.json` is missing or `node_modules/` is absent, create the config files from the **Project Config Files** section below, then run:
```bash
npm install
npx playwright install chromium
```

### Step 3 — Always create these files

Regardless of project state, create (or overwrite if outdated):
1. `CLAUDE.md` — from the **CLAUDE.md Content** section below
2. `.claude/commands/add-module.md` — from the **Skill Files** section
3. `.claude/commands/new-test.md`
4. `.claude/commands/new-page.md`
5. `.claude/commands/debug-test.md`
6. `.claude/commands/review-tests.md`
7. `.claude/agents/tour2playwright.md` — from the **Agent Files** section
8. `ONBOARDING.md` — this file itself (skip if already present)

### Step 4 — Final checks

After all files are written:
- Run `npm run lint` — fix any TypeScript errors before reporting
- Report to the user: which files were created, confirm `npm run lint` is clean, and list the available skill commands

### How Skills Work

The 5 skill files in `.claude/commands/` register as slash commands (`/add-module`, `/new-test`, etc.) **only in the Claude Code terminal app**. In Claude.ai or any other interface those commands are not available as registered skills.

**Regardless of environment, execute the skill logic directly from this guide whenever the user asks:**

| User asks to… | Follow the instructions in… |
|---------------|------------------------------|
| Scaffold a new module / `/add-module` | **Skill Files → add-module.md** section below |
| Add a new test / `/new-test` | **Skill Files → new-test.md** section below |
| Create a page object / `/new-page` | **Skill Files → new-page.md** section below |
| Debug a failing test / `/debug-test` | **Skill Files → debug-test.md** section below |
| Review tests for violations / `/review-tests` | **Skill Files → review-tests.md** section below |

When a user types `/add-module recruitment` and you are **not** in the Claude Code terminal, treat it as "scaffold a new module called recruitment" and execute the add-module instructions directly — do not tell the user the command isn't recognized.

---

## Project Config Files

Create each file at the project root exactly as shown.

### `package.json`

```json
{
  "name": "odoo-playwright-tests",
  "version": "1.0.0",
  "description": "Playwright E2E test framework for Odoo 17",
  "scripts": {
    "test": "playwright test",
    "test:all": "playwright test --grep \"@e2e\"",
    "test:smoke": "playwright test --grep \"@smoke\"",
    "test:config": "playwright test --grep \"@step:config\"",
    "test:business": "playwright test --grep \"@step:business\"",
    "test:reporting": "playwright test --grep \"@step:reporting\"",
    "test:permissions": "playwright test --grep \"@step:permissions\"",
    "test:validations": "playwright test --grep \"@step:validations\"",
    "test:edge": "playwright test --grep \"@step:edge\"",
    "test:archive": "playwright test --grep \"@step:archive\"",
    "report": "playwright show-report",
    "report:generate": "node scripts/generate-report.js",
    "test:report": "playwright test && node scripts/generate-report.js",
    "report:allure": "allure serve allure-results",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@types/node": "^20.0.0",
    "allure-playwright": "^3.0.0",
    "typescript": "^5.7.0"
  },
  "dependencies": {
    "dotenv": "^16.4.0"
  }
}
```

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],  // feeds master report with real pass/fail
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['./src/core/reporters/ValidationTableReporter.ts', { outputDir: 'reports/validation-table' }],
  ],

  use: {
    baseURL,
    headless: process.env.HEADLESS !== 'false',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo: Number(process.env.SLOW_MO ?? 0) },
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    locale: 'en-US',
    timezoneId: 'UTC',
  },

  projects: [
    { name: 'setup', testMatch: '**/fixtures/auth.setup.ts' },
    {
      name: 'admin',
      use: { ...devices['Desktop Chrome'], storageState: 'auth-storage/admin.json' },
      dependencies: ['setup'],
    },
    {
      name: 'manager',
      use: { ...devices['Desktop Chrome'], storageState: 'auth-storage/manager.json' },
      dependencies: ['setup'],
    },
    {
      name: 'employee',
      use: { ...devices['Desktop Chrome'], storageState: 'auth-storage/employee.json' },
      dependencies: ['setup'],
    },
  ],
});
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@modules/*": ["src/modules/*"],
      "@data/*": ["test-data/*"]
    },
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*", "playwright.config.ts"],
  "exclude": ["node_modules", "dist", "test-results", "allure-results", "allure-report"]
}
```

### `.env.example`

```
ODOO_BASE_URL=http://localhost:8069
ODOO_DB=odoo17

ADMIN_EMAIL=admin
ADMIN_PASSWORD=admin

MANAGER_EMAIL=manager@example.com
MANAGER_PASSWORD=manager_pass

EMPLOYEE_EMAIL=employee@example.com
EMPLOYEE_PASSWORD=employee_pass

HEADLESS=true
SLOW_MO=0
SKIP_ARCHIVE=false
```

Also create `.env` as a copy of `.env.example` if it does not already exist.

### `.gitignore`

```
node_modules/
dist/
auth-storage/
playwright-report/
allure-results/
allure-report/
reports/
test-results/
.env
```

---

## CLAUDE.md Content

Write this exactly to `CLAUDE.md` in the project root:

````markdown
# CLAUDE.md — Odoo Playwright Test Framework

## Project Overview

E2E test framework for **Odoo 17** built with Playwright and TypeScript.
Tests cover any Odoo module following a consistent 7-step structure across all domains.
Multiple user roles are tested independently — configure roles in `.env` and `playwright.config.ts`.

**Tech stack:** Playwright 1.50, TypeScript 5.7, Allure reporting

---

## Quick Start

```bash
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env with your Odoo instance URL and credentials
```

---

## Commands

```bash
npm test                   # Run all tests (setup + all roles)
npm run test:<domain>      # Tests for a specific domain
npm run test:smoke         # Smoke tests only
npm run test:config        # Step 1: configuration tests
npm run test:business      # Step 2: business logic tests
npm run test:reporting     # Step 3: reporting tests
npm run test:permissions   # Step 4: permission tests
npm run test:validations   # Step 5: validation tests
npm run test:edge          # Step 6: edge case tests
npm run test:archive       # Step 7: archive tests
npm run report             # Open Playwright HTML report
npm run report:generate    # Regenerate master report from spec files (no test run)
npm run test:report        # Run tests then regenerate master report
npm run lint               # TypeScript type-check
HEADLESS=false npm test    # Run with browser visible
SLOW_MO=500 npm test       # Slow down actions by 500ms
npx playwright test --project=setup --project=<role>  # Single role — faster during development
```

---

## Architecture

```
src/
├── core/                          # Shared infrastructure (do not modify)
│   ├── api/        OdooRPC.ts, OdooModels.ts
│   ├── base/       BasePage, BaseFormPage, BaseListPage, BaseKanbanPage, BaseSettingsPage
│   ├── components/ CharField, Many2OneField, Many2ManyField, DateField, SelectionField, BooleanToggle, MonetaryField, StatusBar
│   ├── fixtures/   index.ts, base.fixtures.ts, auth.setup.ts, masterData.fixtures.ts
│   ├── reporters/  ValidationTableReporter.ts
│   └── utils/      RandomDataGenerator, DateHelper, NumberHelper, TestLogger, ReportAttachment
└── modules/
    └── <domain>/                  # One directory per Odoo module
        ├── pages/                 FormPage, ListPage, KanbanPage
        ├── data/                  <domain>.master-data.ts, <domain>.validation-cases.ts
        ├── calculations/          Business calculation helpers
        └── tests/
            ├── 01-config/         <domain>.config.spec.ts
            ├── 02-business/       <domain>.business.spec.ts
            ├── 03-reporting/      <domain>.reports.spec.ts
            ├── 04-permissions/    <domain>.permissions.spec.ts
            ├── 05-validations/    <domain>.validations.spec.ts
            ├── 06-edge-cases/     <domain>.edge-cases.spec.ts
            └── 07-archive/        <domain>.archive.spec.ts
```

**Inheritance:** `BasePage → BaseFormPage → <Domain>FormPage`

---

## Test Organization

### Tag System

| Tag | Purpose |
|-----|---------|
| `@module:<domain>` | The Odoo module being tested |
| `@step:config` | Step 1 — configuration/setup |
| `@step:business` | Step 2 — business logic |
| `@step:reporting` | Step 3 — views and exports |
| `@step:permissions` | Step 4 — role-based access |
| `@step:validations` | Step 5 — field/form validations |
| `@step:edge` | Step 6 — edge cases |
| `@step:archive` | Step 7 — soft-delete and reactivation |
| `@e2e` | Full end-to-end flows (02-business only) |
| `@smoke` | Critical path smoke tests |

When adding a new domain, register `@module:<domain>` in this table and add `"test:<domain>"` to `package.json`.

### Role-Based Projects

Each project name maps to a saved auth state in `auth-storage/<role>.json`. Roles are defined in `playwright.config.ts` and credentials in `.env`. Add or remove roles to match your Odoo instance's user setup.

---

## Coding Conventions

### Imports — always from the merged fixture index

```typescript
import { test, expect } from '../../../../core/fixtures/index';
import { uniqueName, uniqueEmail } from '../../../../core/utils/RandomDataGenerator';
import { today } from '../../../../core/utils/DateHelper';
```

### Page Objects

```typescript
export class <Domain>FormPage extends BaseFormPage {
  readonly name = new CharField(this.page, 'name');
  readonly related = new Many2OneField(this.page, 'related_id');
  async navigate() { await this.navigateTo('/odoo/<domain>/new'); }
  async openById(id: number) { await this.navigateTo(`/odoo/<domain>/${id}`); }
}
```

### UI-First Tests — always interact through the browser

```typescript
test('example', async ({ page }) => {
  const formPage = new <Domain>FormPage(page);
  await formPage.navigate();
  await formPage.name.setValue(uniqueName('Record'));
  await formPage.save();
  // assert against rendered UI
  await expect(page.locator('.o_form_status_indicator')).toBeVisible();
});
```

### Unique Test Data

```typescript
const name = uniqueName('My Record'); // → "[TEST] My Record AB1C2D3E"
```

### Graceful Skipping

```typescript
const visible = await page.locator('button', { hasText: 'Confirm' })
  .isVisible({ timeout: 3_000 }).catch(() => false);
if (!visible) test.skip(true, 'Confirm not available in this configuration');
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ODOO_BASE_URL` | Odoo instance URL |
| `ODOO_DB` | Database name |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin credentials |
| `MANAGER_EMAIL` / `MANAGER_PASSWORD` | Manager credentials |
| `EMPLOYEE_EMAIL` / `EMPLOYEE_PASSWORD` | Employee credentials |
| `HEADLESS` | `true` (default) or `false` |
| `SLOW_MO` | Milliseconds to slow actions |
| `SKIP_ARCHIVE` | `true` to keep test records after run |

---

## Generalized Test Flow

Every domain follows the **same 7-step structure**:

| Step | Folder | `@step` Tag | Purpose |
|------|--------|-------------|---------|
| 1 | `01-config/` | `@step:config` | System settings, master data, module prerequisites |
| 2 | `02-business/` | `@step:business` | Core CRUD, business logic, and multi-step workflows |
| 3 | `03-reporting/` | `@step:reporting` | Views, filters, exports |
| 4 | `04-permissions/` | `@step:permissions` | Role-based access |
| 5 | `05-validations/` | `@step:validations` | Required fields, constraints |
| 6 | `06-edge-cases/` | `@step:edge` | Unusual inputs, boundaries |
| 7 | `07-archive/` | `@step:archive` | Soft-delete, reactivation |

**To add a new domain:** `/add-module <domain>`

---

## Report Convention

The master report is **auto-generated** from spec files — never hand-edited.

```bash
npm run report:generate          # regenerate from spec files (no test run needed)
npm run test:report              # run tests then regenerate with real pass/fail results
```

- **Master report:** `reports/master-report-YYYY-MM-DD.html` — all domains, section anchors `#<domain>-<step>`
- **Generator:** `scripts/generate-report.js` — scans `src/modules/**/*.spec.ts`, parses every `test()` declaration, infers RPC/UI type from fixture params
- **Results:** when `test-results/results.json` exists (written automatically by `playwright test`), the report shows real ✅/❌/⏭ status; otherwise tests show as ⬜ pending
- **Auto-update hook:** the Stop hook regenerates the report automatically whenever a `*.spec.ts` file is changed during a Claude turn — the updated report is committed alongside the spec change
- **Commit:** `git add -f reports/master-report-*.html` (reports/ is gitignored)

---

## Generated Artifacts (not committed)

`auth-storage/` · `playwright-report/` · `allure-results/` · `reports/` · `test-results/`
````

---

## Skill Files

Write each file below to `.claude/commands/<filename>` exactly as shown.

---

### `.claude/commands/add-module.md`

````markdown
# Scaffold a Complete New Test Module

You are scaffolding a complete new test module for the Odoo 17 Playwright test framework.

## Arguments
$ARGUMENTS

The argument is the module name in lowercase (e.g. `recruitment`, `appraisal`, `expenses`).

## Target Directory Tree

Create all of the following under `src/modules/<module>/`:

```
src/modules/<module>/
├── pages/
│   └── <Module>Page.ts
├── data/
│   ├── <module>.master-data.ts
│   └── <module>.validation-cases.ts
├── calculations/
│   └── <Module>Calculations.ts
└── tests/
    ├── 01-config/    <module>.config.spec.ts
    ├── 02-business/  <module>.business.spec.ts
    ├── 03-reporting/ <module>.reports.spec.ts
    ├── 04-permissions/<module>.permissions.spec.ts
    ├── 05-validations/<module>.validations.spec.ts
    ├── 06-edge-cases/<module>.edge-cases.spec.ts
    └── 07-archive/   <module>.archive.spec.ts
```

## File Contents

### `pages/<Module>Page.ts`

```typescript
import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';

// TODO: Add typed field components matching the Odoo <module> model fields.

export class <Module>FormPage extends BaseFormPage {
  readonly name: CharField;

  constructor(page: Page) {
    super(page);
    this.name = new CharField(page, 'name');
    // TODO: Add field components for this module's primary Odoo model
  }

  async navigate(): Promise<void> { await this.navigateTo('/odoo/<module>/new'); }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/<module>/${id}`); }
}

export class <Module>ListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/<module>'); }
  async open<Module>(name: string): Promise<void> { await this.clickRowByText(name); }
}
```

### `data/<module>.master-data.ts`

```typescript
import { today } from '../../../core/utils/DateHelper';
export const <MODULE>_TEST_CONFIG = {} as const;
export function get<Module>Dates() { return { dateStart: today() }; }
```

### `data/<module>.validation-cases.ts`

```typescript
export const <MODULE>_MANDATORY_FIELDS: Array<{ module: string; field: string; attemptedValue: string; expectedError: string; }> = [];
export const <MODULE>_VALIDATION_CASES: typeof <MODULE>_MANDATORY_FIELDS = [];
```

### `calculations/<Module>Calculations.ts`

```typescript
// TODO: Add business calculation functions specific to this module.
```

### Spec Files (all 7)

```typescript
/**
 * Step <N> — <Step Label> for the <module> module.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { <Module>FormPage } from '../../pages/<Module>Page';

test.describe('<Module> <Step Label> @module:<module> @step:<step>', () => {
  test('placeholder — replace with real test @smoke', async ({ page }) => {
    const formPage = new <Module>FormPage(page);
    await formPage.navigate();
    test.skip(true, 'Not yet implemented');
  });
});
```

Step table:

| Folder | `<step>` | `<Step Label>` | `<N>` |
|--------|----------|----------------|-------|
| 01-config | config | Configuration Setup | 1 |
| 02-business | business | Business Logic | 2 |
| 03-reporting | reporting | Reporting | 3 |
| 04-permissions | permissions | User Permissions | 4 |
| 05-validations | validations | Field Validations | 5 |
| 06-edge-cases | edge | Edge Cases | 6 |
| 07-archive | archive | Archive & Cleanup | 7 |

## After Scaffolding

1. Add to `package.json` scripts: `"test:<module>": "playwright test --grep \"@module:<module>\""`
2. Add to `CLAUDE.md` tag table: `| \`@module:<module>\` | <Module> module |`
3. Run `npm run lint` — must be zero errors
4. Run `npx playwright test --grep "@module:<module>" --project=admin` — all 7 must show as skipped
````

---

### `.claude/commands/new-test.md`

````markdown
# Scaffold a New Test Spec File

## Arguments
$ARGUMENTS
Parse as: `<module> <step> "<test description>"`

## Step → Folder Map

| Argument | Folder |
|----------|--------|
| config | 01-config |
| business | 02-business |
| reporting | 03-reporting |
| permissions | 04-permissions |
| validations | 05-validations |
| edge | 06-edge-cases |
| archive | 07-archive |

Create: `src/modules/<module>/tests/<step-folder>/<module>.<step>.spec.ts`
If file exists, use `<module>.<step>-<slug>.spec.ts`.

## Required Structure

```typescript
import { test, expect } from '../../../../core/fixtures/index';
import { <RelevantFormPage> } from '../../pages/<ModulePage>';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { today } from '../../../../core/utils/DateHelper';

test.describe('<Suite Name> @module:<module> @step:<step>', () => {
  test('<UI behavior> @smoke', async ({ page }) => {
    const formPage = new <RelevantFormPage>(page);
    await formPage.navigate();
    await formPage.name.setValue(uniqueName('<Base Name>'));
    await formPage.save();
    await expect(page.locator('.o_form_view')).toBeVisible();
  });

  test('<validation behavior>', async ({ page }) => {
    const formPage = new <RelevantFormPage>(page);
    await formPage.navigate();
    const visible = await page.locator('button', { hasText: '<Button>' }).isVisible({ timeout: 3_000 }).catch(() => false);
    if (!visible) { test.skip(true, '<Button> not available in this Odoo configuration'); return; }
  });
});
```

## Conventions
1. `test`/`expect` from `../../../../core/fixtures/index` — exactly 4 `../` segments
2. All form inputs use `uniqueName()` or `uniqueEmail()` — never hardcoded strings
3. All tests interact through page objects and the browser UI — no direct RPC calls
4. `test.skip(true, 'reason')` — reason string is mandatory
5. Tags on `describe` block: `@module:<module> @step:<step>`
6. Page imports use relative paths (`../../pages/...`)
````

---

### `.claude/commands/new-page.md`

````markdown
# Scaffold a New Page Object File

## Arguments
$ARGUMENTS
Parse as: `<module> <odoo.model> "<field_name:field_type,...>"`

## Field Type → Component

| Type | Component | Import |
|------|-----------|--------|
| `char`/`text` | `CharField` | `../../../core/components/CharField` |
| `many2one` | `Many2OneField` | `../../../core/components/Many2OneField` |
| `many2many` | `Many2ManyField` | `../../../core/components/Many2ManyField` |
| `date`/`datetime` | `DateField` | `../../../core/components/DateField` |
| `selection` | `SelectionField` | `../../../core/components/SelectionField` |
| `boolean` | `BooleanToggle` | `../../../core/components/BooleanToggle` |
| `monetary`/`integer`/`float` | `MonetaryField` | `../../../core/components/MonetaryField` |

Create: `src/modules/<module>/pages/<ModelNameInPascalCase>Page.ts`

## Structure

```typescript
import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { CharField } from '../../../core/components/CharField';

export class <ModelName>FormPage extends BaseFormPage {
  readonly <camelField>: <Component>;
  constructor(page: Page) { super(page); this.<camelField> = new <Component>(page, '<odoo_field>'); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/<url>/new'); }
  async openById(id: number): Promise<void> { await this.navigateTo(`/odoo/<url>/${id}`); }
  async create<ModelName>(data: { name: string }): Promise<void> { await this.<nameField>.setValue(data.name); await this.save(); }
}

export class <ModelName>ListPage extends BaseListPage {
  constructor(page: Page) { super(page); }
  async navigate(): Promise<void> { await this.navigateTo('/odoo/<url>'); }
  async open<ModelName>(name: string): Promise<void> { await this.clickRowByText(name); }
}
```

## Conventions
1. Relative imports only (`../../../core/...`) — no `@core/` aliases in page files
2. Constructor string = Odoo technical field name (snake_case)
3. No assertions in page objects
4. Run `npm run lint` after creating
````

---

### `.claude/commands/debug-test.md`

````markdown
# Diagnose a Failing Playwright Test

## Arguments
$ARGUMENTS
Parse as: `<test-file-or-name> [error message]`

## Step 1: Locate the failing test
```bash
grep -r "<test name>" src/modules --include="*.spec.ts" -l
```

## Step 2: Classify

**A — Locator Timeout** (`TimeoutError`, `element not found`)
- Wrap config-dependent elements in graceful skip:
  ```typescript
  const visible = await page.locator('button', { hasText: 'X' }).isVisible({ timeout: 3_000 }).catch(() => false);
  if (!visible) test.skip(true, 'X not available in this configuration');
  ```
- Add `{ timeout: 8_000 }` on specific locators

**B — Auth / Role Mismatch** (`403`, read-only fields)
- Re-run setup: `npx playwright test --project=setup`
- Verify Odoo user group membership

**C — Data / State Failure** (orphaned `[TEST]` records, unexpected form state)
- Check `.env` credentials and `ODOO_BASE_URL`
- Search for leftover test records in Odoo directly via the UI using the `[TEST]` name prefix
- Reset test state by archiving or deleting orphaned records before re-running

**D — State / Version Mismatch** (unexpected status values)
- Use array containment: `expect(['Status A', 'Status B']).toContain(status)`

## Step 3: Reproduce
```bash
HEADLESS=false SLOW_MO=500 npx playwright test --grep "<test name>" --project=admin
npx playwright test --grep "<test name>" --project=admin --debug
```

## Step 4: Fix → `npm run lint` → re-run test
````

---

### `.claude/commands/review-tests.md`

````markdown
# Review Test Files Against Project Conventions

## Arguments
$ARGUMENTS
File path/glob or auto-detect from `git status --short`.

## Checklist — report as [PASS] [FAIL] [WARN] [INFO]

### 1. Import Source
- `[FAIL]` `test`/`expect` from `@playwright/test` (only valid for role-override in permissions specs)
- `[FAIL]` `test` not from `../../../../core/fixtures/index`
- `[FAIL]` page objects imported via `@modules/` alias — must use relative paths

### 2. Unique Naming
- `[FAIL]` hardcoded string literal for record names, emails, or references in form fills
- `[FAIL]` `uniqueName()`/`uniqueEmail()` used but not imported from `../../../../core/utils/RandomDataGenerator`

### 3. UI Interaction
- `[FAIL]` test uses `rpc.create()` / `rpc.searchRead()` / `rpc.archive()` instead of browser UI interactions
- `[FAIL]` test bypasses the UI to set up or assert data state via RPC
- `[PASS]` test uses page objects and form fills for all create/edit/assert actions

### 4. Graceful Skip
- `[FAIL]` `expect(visible).toBe(true)` on config-dependent element — use `test.skip(true, 'reason')`
- `[FAIL]` `test.skip(true)` without reason string
- `[WARN]` non-descriptive reason (`'TODO'`, `'skip'`)

### 6. Tag Convention
- `[FAIL]` `test.describe()` missing `@module:<name>` or `@step:<name>`
- `[FAIL]` tags only on `test()` not on `describe`
- `[WARN]` `@e2e` on non-`02-business` spec

### 7. Import Path Depth
- `[FAIL]` wrong number of `../` segments — must be exactly 4 for `src/modules/<module>/tests/<step>/`

### 8. Test Isolation
- `[FAIL]` mutable `let` variables shared between tests in the same describe
- `[WARN]` `test.beforeAll` used to create records

### 9. TypeScript Generics
- `[FAIL]` page object methods called without necessary type annotations on return values

### 10. Timeout/Selector Practices
- `[WARN]` `page.waitForTimeout()` — prefer event-based waits
- `[WARN]` positional CSS selectors (`:nth-child()`) on dynamic content

### 11. 7-Step Folder Convention
- `[FAIL]` spec file outside `01-config` through `07-archive` folders
- `[WARN]` folder number mismatches `@step:` tag
- `[INFO]` folder contains only placeholder/skip-all tests

## Output Format

```
## Review: <file>
### Summary — FAIL: N | WARN: N | INFO: N
| # | Severity | Check | Line | Detail |
### Required Actions (FAIL)
### Suggestions (WARN/INFO)
```
If clean: `All convention checks passed for <file>.`
````

---

## Agent Files

Write this file to `.claude/agents/<filename>` exactly as shown.

---

### `.claude/agents/tour2playwright.md`

````markdown
---
name: tour2playwright
description: Use when the user provides an Odoo Tour Recorder JSON export (a tour.json file) and wants a Playwright regression test and/or an illustrated user manual generated from it, written directly into the target module's own structure. Proactively invoke when the user mentions a tour export, a recorded tour, or asks to convert/generate tests or manuals from one.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You run the `tour2playwright` pipeline (`tools/tour2playwright/`) to turn an Odoo Tour
Recorder JSON export into a real, committed Playwright spec plus an illustrated HTML
manual — both written directly into the target module's own structure, not a separate
output tree. The user should only ever have to hand you a tour export file path and
tell you which module it belongs to (ask if they haven't said).

## Before running anything

1. Confirm the target module already exists at `src/modules/<domain>/`. If it doesn't,
   tell the user to scaffold it first with `/add-module <domain>` — never auto-create it.
2. Confirm `auth-storage/admin.json` exists. If not, run `npx playwright test --project=setup`
   from the repo root first (a normal First-Day-Setup step) — the generated spec runs via
   the main suite's own `admin` project and reuses that session.
3. There is no separate `.env` or `npm install` for this tool — it has zero dependencies
   and reads the repo-root `.env` directly.

## Running the pipeline

From `tools/tour2playwright/`, run:
```bash
npm run build -- <domain> <path-to-export.json>
```
This writes the spec into `src/modules/<domain>/tests/02-business/<domain>.<slug>-tour.spec.ts`,
runs it via `npx playwright test <path> --project=admin` from the repo root (capturing
screenshots into `tools/tour2playwright/generated/screenshots/`, which is scratch/gitignored),
then writes the HTML manual into `src/modules/<domain>/documentation/<slug>.<lang>.html`.

Use `npm run gen -- <domain> <path>` / `npm run manual -- <domain> <path>` separately only
if the user explicitly wants to inspect the spec before running it.

## After it finishes

1. **Run `npm run lint` then `npm run report:generate` from the repo root** — the generated
   spec is now a real part of the module, exactly like a hand-written one, so it must
   type-check and should show up correctly in the master report.
2. Report back:
   - The spec's path and how many steps it has
   - Whether the run passed, and where the Playwright HTML report is
   - The manual's path(s) per language, and remind the user to open the `.html` in a
     browser and paste it directly into Odoo Knowledge — screenshots are embedded, so
     formatting and images should carry over as-is
   - **Always read and summarize `tools/tour2playwright/generated/REVIEW.md`** if it exists
     — this lists every step the translator couldn't map with confidence. Treat the
     generated spec as a strong first draft, not ground truth; tell the user exactly
     what needs manual review, and fix flagged steps directly in the committed spec
     when asked.

Never commit anything under `tools/tour2playwright/generated/` — it's gitignored, local,
regenerate-on-demand scratch space (screenshots + REVIEW.md), not a source artifact. The
spec and the HTML manual, by contrast, ARE meant to be committed — they're real source
under `src/modules/<domain>/`.
````

---
