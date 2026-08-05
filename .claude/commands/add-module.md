# Scaffold a Complete New Test Module

You are scaffolding a complete new test module for the Odoo 17 Playwright test framework.

## Arguments
$ARGUMENTS

The argument is the module name in lowercase (e.g. `leave`, `payroll`, `recruitment`, `appraisal`).

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
    ├── 01-config/
    │   └── <module>.config.spec.ts
    ├── 02-business/
    │   └── <module>.business.spec.ts
    ├── 03-reporting/
    │   └── <module>.reports.spec.ts
    ├── 04-permissions/
    │   └── <module>.permissions.spec.ts
    ├── 05-validations/
    │   └── <module>.validations.spec.ts
    ├── 06-chained-flows/
    │   └── <module>.chained.spec.ts
    ├── 07-edge-cases/
    │   └── <module>.edge-cases.spec.ts
    └── 08-archive/
        └── <module>.archive.spec.ts
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

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/<module>/new');
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/odoo/<module>/${id}`);
  }
}

export class <Module>ListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  // TODO: Replace with the correct Odoo URL for this module
  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/<module>');
  }

  async open<Module>(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
```

### `data/<module>.master-data.ts`

```typescript
import { today } from '../../../core/utils/DateHelper';

/** Static test configuration for the <module> module */
// TODO: Add module-specific test configuration constants
export const <MODULE>_TEST_CONFIG = {} as const;

/** TODO: Add helper functions for date ranges or other test data */
export function get<Module>Dates() {
  const start = today();
  return { dateStart: start };
}
```

### `data/<module>.validation-cases.ts`

```typescript
/**
 * Mandatory field validation cases for the primary <module> Odoo model.
 * TODO: Replace with real field names and expected error messages.
 */
export const <MODULE>_MANDATORY_FIELDS: Array<{
  module: string;
  field: string;
  attemptedValue: string;
  expectedError: string;
}> = [
  // {
  //   module: '<MODULE>',
  //   field: 'name',
  //   attemptedValue: '',
  //   expectedError: 'This field is required',
  // },
];

/** TODO: Add server-side constraint violation cases */
export const <MODULE>_VALIDATION_CASES: typeof <MODULE>_MANDATORY_FIELDS = [];
```

### `calculations/<Module>Calculations.ts`

```typescript
/**
 * <Module> calculation helpers.
 * TODO: Add business calculation functions specific to this module.
 */

// TODO: Define the calculation result shape and implement functions.
// Example pattern:
//
// export interface <Module>Summary { ... }
//
// export function calculate<Module>Summary(value: number): <Module>Summary {
//   return { ... };
// }
```

### Spec Files (all 8)

Generate all 8 spec files using this template, substituting the step name and number from the table below:

```typescript
/**
 * Step <N> — <Step Label> for the <module> module.
 * TODO: Replace the placeholder test with real test cases.
 */
import { test } from '../../../../core/fixtures/index';

test.describe('<Module> <Step Label> @module:<module> @step:<step>', () => {

  test('placeholder — replace with real test @smoke', async ({ page }) => {
    // TODO: Implement this test using page objects (UI interactions only).
    // Conventions:
    //   1. Navigate via page.goto() or page object navigate() methods
    //   2. Use uniqueName() for every record name
    //   3. Wrap config-dependent assertions in graceful skip:
    //      const visible = await page.locator('button', { hasText: 'X' })
    //        .isVisible({ timeout: 3_000 }).catch(() => false);
    //      if (!visible) test.skip(true, 'X not available in this configuration');
    test.skip(true, 'Not yet implemented — replace this placeholder with real test logic');
  });
});
```

Step table:

| Folder | `<step>` tag | `<Step Label>` | `<N>` |
|--------|-------------|----------------|-------|
| 01-config | config | Configuration Setup | 1 |
| 02-business | business | Business Logic | 2 |
| 03-reporting | reporting | Reporting | 3 |
| 04-permissions | permissions | User Permissions | 4 |
| 05-validations | validations | Field Validations | 5 |
| 06-chained-flows | chained | Chained Flows | 6 |
| 07-edge-cases | edge | Edge Cases | 7 |
| 08-archive | archive | Archive & Cleanup | 8 |

## After Scaffolding

### 1. Add npm script to `package.json`

In the `scripts` section, add (in alphabetical order among the `test:*` entries):
```json
"test:<module>": "playwright test --grep \"@module:<module>\""
```

### 2. Add module tag to `CLAUDE.md`

Find the tag table in `CLAUDE.md` and add:
```
| `@module:<module>` | <Module> module |
```

### 3. Verify the scaffold compiles

```bash
npm run lint
```

Fix any TypeScript errors (common: unused imports, missing type annotations).

### 4. Confirm all placeholders skip cleanly

```bash
npx playwright test --grep "@module:<module>" --project=admin
```

All 8 tests should be reported as **skipped**, not failed. If any fail, the TypeScript scaffold has a compile error — re-run `npm run lint` to find it.

## Output

After creating all files, list:
1. The complete directory tree of every file created
2. The `package.json` script line to add
3. The `CLAUDE.md` tag table row to add
4. Confirm that `npm run lint` passes and the placeholder run shows 8 skipped tests
