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
├── notes/
│   └── <module>.notes.md
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

### `notes/<module>.notes.md`

```markdown
# <Module> — Notes

Free-form domain notes for the <module> module: Odoo quirks, SaaS-specific
constraints, decisions, and anything future contributors on this branch
should know that doesn't belong in test code or CLAUDE.md.
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
