# Odoo Playwright Test — Team Onboarding Guide

## Human Onboarding Guide

---

### The Framework in Three Sentences

We drive a real Odoo 17 instance with three logged-in user roles (admin, manager, employee). All test data is created and destroyed via the Odoo JSON-RPC API — never through the browser UI. Tests for every domain follow the same 8-step workflow so that reports, tag filtering, and team onboarding are always predictable.

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

### The 8-Step Workflow

| Step | Folder | Tag | What it tests |
|------|--------|-----|---------------|
| 1 | `01-config/` | `@step:config` | System settings, master data, prerequisites |
| 2 | `02-business/` | `@step:business` | Core CRUD and business logic |
| 3 | `03-reporting/` | `@step:reporting` | Views, filters, exports |
| 4 | `04-permissions/` | `@step:permissions` | Role-based access |
| 5 | `05-validations/` | `@step:validations` | Required fields, constraint errors |
| 6 | `06-chained-flows/` | `@step:chained` | Multi-step cross-record workflows |
| 7 | `07-edge-cases/` | `@step:edge` | Unusual inputs, boundaries |
| 8 | `08-archive/` | `@step:archive` | Soft-delete, reactivation |

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

### Three Non-Negotiable Rules

1. **Never import `test` from `@playwright/test`** — always `../../../../core/fixtures/index`
2. **Never hardcode record names** — always `uniqueName('...')` or `uniqueEmail('...')`
3. **Every `rpc.create()` must have `rpc.archive()`** — same test or `afterEach`

---

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `import { test } from '@playwright/test'` | Use `from '../../../../core/fixtures/index'` |
| `rpc.create(..., { name: 'My Record' })` | Use `uniqueName('My Record')` |
| Filling a form in `beforeAll` to set up data | Use `rpc.create()` |
| No `rpc.archive()` after `rpc.create()` | Always add cleanup |
| `expect(btn).toBeVisible()` for config-dependent UI | `isVisible({timeout:3_000}).catch(()=>false)` + `test.skip()` |
| `test.skip(true)` with no reason | Always: `test.skip(true, 'reason')` |
| Spec at `tests/` root | Must be inside `01-config/` through `08-archive/` |

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
git clone https://github.com/Jinasena-Pvt-Ltd/odoo-playwright-tests.git
cd odoo-playwright-tests
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
7. `ONBOARDING.md` — this file itself (skip if already present)

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
    "test:chained": "playwright test --grep \"@step:chained\"",
    "test:edge": "playwright test --grep \"@step:edge\"",
    "test:archive": "playwright test --grep \"@step:archive\"",
    "report": "playwright show-report",
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
Tests cover any Odoo module following a consistent 8-step structure across all domains.
Three user roles are tested independently: admin, manager, and employee.

**Tech stack:** Playwright 1.50, TypeScript 5.7, Allure reporting, Odoo RPC API

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
npm run test:chained       # Step 6: chained flow tests
npm run test:edge          # Step 7: edge case tests
npm run test:archive       # Step 8: archive tests
npm run report             # Open Playwright HTML report
npm run lint               # TypeScript type-check
HEADLESS=false npm test    # Run with browser visible
SLOW_MO=500 npm test       # Slow down actions by 500ms
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
            ├── 06-chained-flows/  <domain>.chained.spec.ts
            ├── 07-edge-cases/     <domain>.edge-cases.spec.ts
            └── 08-archive/        <domain>.archive.spec.ts
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
| `@step:chained` | Step 6 — multi-step flows |
| `@step:edge` | Step 7 — edge cases |
| `@step:archive` | Step 8 — soft-delete and reactivation |
| `@e2e` | Full end-to-end flows (06-chained-flows only) |
| `@smoke` | Critical path smoke tests |

When adding a new domain, register `@module:<domain>` in this table and add `"test:<domain>"` to `package.json`.

### Role-Based Projects

- **admin** → `auth-storage/admin.json`
- **manager** → `auth-storage/manager.json`
- **employee** → `auth-storage/employee.json`

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

### RPC Usage — never UI for data setup

```typescript
test('example', async ({ rpc }) => {
  const id = await rpc.create<number>('<odoo.model>', { name: uniqueName('Record') });
  // ... test ...
  await rpc.archive('<odoo.model>', [id]);
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

Every domain follows the **same 8-step structure**:

| Step | Folder | `@step` Tag | Purpose |
|------|--------|-------------|---------|
| 1 | `01-config/` | `@step:config` | System settings, master data, module prerequisites |
| 2 | `02-business/` | `@step:business` | Core CRUD and business logic |
| 3 | `03-reporting/` | `@step:reporting` | Views, filters, exports |
| 4 | `04-permissions/` | `@step:permissions` | Role-based access |
| 5 | `05-validations/` | `@step:validations` | Required fields, constraints |
| 6 | `06-chained-flows/` | `@step:chained` | Multi-step workflows |
| 7 | `07-edge-cases/` | `@step:edge` | Unusual inputs, boundaries |
| 8 | `08-archive/` | `@step:archive` | Soft-delete, reactivation |

**To add a new domain:** `/add-module <domain>`

---

## Report Convention

- **Master report:** `reports/master-report-YYYY-MM-DD.html` — all domains, section anchors `#<domain>-<step>`
- **Per-domain report:** `reports/<domain>-report-YYYY-MM-DD.html`
- **Commit:** `git add -f reports/<file>` (reports/ is gitignored)

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
    ├── 06-chained-flows/<module>.chained.spec.ts
    ├── 07-edge-cases/<module>.edge-cases.spec.ts
    └── 08-archive/   <module>.archive.spec.ts
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

### Spec Files (all 8)

```typescript
/**
 * Step <N> — <Step Label> for the <module> module.
 */
import { test } from '../../../../core/fixtures/index';
import { OdooRPC } from '../../../../core/api/OdooRPC';

async function isModuleInstalled(rpc: OdooRPC): Promise<boolean> {
  const r = await rpc.searchRead<{ id: number }>(
    'ir.model', [['model', '=', 'module.primary.model']], ['id'], { limit: 1 },
  );
  return r.length > 0;
}

test.describe('<Module> <Step Label> @module:<module> @step:<step>', () => {
  test('placeholder — replace with real test @smoke', async ({ rpc }) => {
    if (!await isModuleInstalled(rpc)) {
      test.skip(true, '<Module> not installed — update isModuleInstalled() model name');
      return;
    }
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
| 06-chained-flows | chained | Chained Flows | 6 |
| 07-edge-cases | edge | Edge Cases | 7 |
| 08-archive | archive | Archive & Cleanup | 8 |

## After Scaffolding

1. Add to `package.json` scripts: `"test:<module>": "playwright test --grep \"@module:<module>\""`
2. Add to `CLAUDE.md` tag table: `| \`@module:<module>\` | <Module> module |`
3. Run `npm run lint` — must be zero errors
4. Run `npx playwright test --grep "@module:<module>" --project=admin` — all 8 must show as skipped
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
| chained | 06-chained-flows |
| edge | 07-edge-cases |
| archive | 08-archive |

Create: `src/modules/<module>/tests/<step-folder>/<module>.<step>.spec.ts`
If file exists, use `<module>.<step>-<slug>.spec.ts`.

## Required Structure

```typescript
import { test, expect } from '../../../../core/fixtures/index';
import { <RelevantFormPage> } from '../../pages/<ModulePage>';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';
import { today } from '../../../../core/utils/DateHelper';

test.describe('<Suite Name> @module:<module> @step:<step>', () => {
  test('<data-layer behavior>', async ({ rpc }) => {
    const name = uniqueName('<Base Name>');
    const id = await rpc.create<number>('<odoo.model>', { name });
    const records = await rpc.searchRead<{ id: number; name: string }>('<odoo.model>', [['id', '=', id]], ['id', 'name']);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe(name);
    await rpc.archive('<odoo.model>', [id]);
  });

  test('<UI behavior> @smoke', async ({ page }) => {
    const formPage = new <RelevantFormPage>(page);
    await formPage.navigate();
    const visible = await page.locator('button', { hasText: '<Button>' }).isVisible({ timeout: 3_000 }).catch(() => false);
    if (!visible) { test.skip(true, '<Button> not available in this Odoo configuration'); return; }
  });
});
```

## Conventions
1. `test`/`expect` from `../../../../core/fixtures/index` — exactly 4 `../` segments
2. All created records use `uniqueName()` or `uniqueEmail()`
3. All `rpc.create()` in test body have matching `rpc.archive()`
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

**C — RPC / Data Failure** (`Odoo RPC error`, `HTTP 500`)
- Check `.env` credentials and model names
- Find orphaned `[TEST]` records:
  ```typescript
  await rpc.searchRead('<model>', [['name', 'like', '[TEST]']], ['id', 'name'], { context: { active_test: false } });
  ```

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
- `[FAIL]` hardcoded string literal for `name`/`login`/`email` in `rpc.create()`
- `[FAIL]` `uniqueName()`/`uniqueEmail()` used but not imported from `../../../../core/utils/RandomDataGenerator`

### 3. RPC Cleanup
- `[FAIL]` `rpc.create()` in test body with no corresponding `rpc.archive()` in teardown
- `[FAIL]` `rpc.unlink()` used for cleanup — use `rpc.archive()` only
- `[WARN]` cleanup not wrapped in `.catch(() => {})` when record may not have been created

### 4. Graceful Skip
- `[FAIL]` `expect(visible).toBe(true)` on config-dependent element — use `test.skip(true, 'reason')`
- `[FAIL]` `test.skip(true)` without reason string
- `[WARN]` non-descriptive reason (`'TODO'`, `'skip'`)

### 5. No UI Data Setup
- `[FAIL]` test data created by filling a form — use `rpc.create()`
- `[PASS]` if the form IS the subject of the test

### 6. Tag Convention
- `[FAIL]` `test.describe()` missing `@module:<name>` or `@step:<name>`
- `[FAIL]` tags only on `test()` not on `describe`
- `[WARN]` `@e2e` on non-`06-chained-flows` spec

### 7. Import Path Depth
- `[FAIL]` wrong number of `../` segments — must be exactly 4 for `src/modules/<module>/tests/<step>/`

### 8. Test Isolation
- `[FAIL]` mutable `let` variables shared between tests in the same describe
- `[WARN]` `test.beforeAll` used to create records

### 9. TypeScript Generics
- `[FAIL]` `rpc.create()` or `rpc.searchRead()` without type parameter

### 10. Timeout/Selector Practices
- `[WARN]` `page.waitForTimeout()` — prefer event-based waits
- `[WARN]` positional CSS selectors (`:nth-child()`) on dynamic content

### 11. 8-Step Folder Convention
- `[FAIL]` spec file outside `01-config` through `08-archive` folders
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
