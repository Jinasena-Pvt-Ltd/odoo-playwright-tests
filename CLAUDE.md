# CLAUDE.md — Odoo Playwright Test Framework

## Project Overview

E2E test framework for **Odoo 17** built with Playwright and TypeScript.
Tests cover any Odoo module following a consistent 7-step structure across all domains.
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
npm run test:edge          # Step 6: edge case tests
npm run test:archive       # Step 7: archive tests
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
| `@module:security-audit` | Daily user group & CRUD permission audit |
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

The master report is **auto-generated** — never hand-edit it.

```bash
npm run report:generate   # regenerate from spec files (no test run needed)
npm run test:report       # run tests then regenerate with real pass/fail results
```

- **Generator:** `scripts/generate-report.js` — scans `src/modules/**/*.spec.ts`
- **Master report:** `reports/master-report-YYYY-MM-DD.html` — section anchors `#<domain>-<step>`
- **Results:** uses `test-results/results.json` when present for real ✅/❌/⏭ status; otherwise ⬜ pending
- **Auto-hook:** Stop hook regenerates the report whenever a `*.spec.ts` file changes
- **Commit:** `git add -f reports/master-report-*.html` (reports/ is gitignored)

---

## Generated Artifacts (not committed)

`auth-storage/` · `playwright-report/` · `allure-results/` · `reports/` · `test-results/`
