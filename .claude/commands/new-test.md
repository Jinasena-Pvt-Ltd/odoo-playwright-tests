# Scaffold a New Test Spec File

You are scaffolding a new Playwright TypeScript test spec file for the Odoo 17 HR test framework.

## Arguments
$ARGUMENTS

Parse the arguments as: `<module> <step> "<test description>"`
Examples:
- `hr business "contract approval triggers status change"`
- `leave validations "leave request requires date range"`
- `payroll edge "zero wage boundary behavior"`

## Instructions

Create a new spec file at:
`src/modules/<module>/tests/<step-folder>/<module>.<step>.spec.ts`

Map step names to folders using this exact table:

| Argument | Folder |
|----------|--------|
| config | 01-config |
| business | 02-business |
| reporting | 03-reporting |
| permissions | 04-permissions |
| validations | 05-validations |
| edge | 06-edge-cases |
| archive | 07-archive |

If a file already exists at that path, name the new file `<module>.<step>-<slug>.spec.ts` where `<slug>` is a kebab-case version of the description.

## Required Structure

The file MUST follow this pattern — do not deviate from it:

```typescript
/**
 * Step <N> — <Human-readable description of what this suite tests>.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { <RelevantFormPage>, <RelevantListPage> } from '../../pages/<ModulePage>';
import { uniqueName, uniqueEmail } from '../../../../core/utils/RandomDataGenerator';
import { today } from '../../../../core/utils/DateHelper';

test.describe('<Descriptive Suite Name> @module:<module> @step:<step>', () => {

  // --- RPC-only test (fast, no UI) ---
  test('<description of data-layer behavior>', async ({ rpc }) => {
    const name = uniqueName('<Meaningful Base Name>');
    const id = await rpc.create<{ name: string }>(
      '<odoo.model>',
      { name },
    );

    const records = await rpc.searchRead<{ id: number; name: string }>(
      '<odoo.model>',
      [['id', '=', id]],
      ['id', 'name'],
    );
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe(name);

    await rpc.archive('<odoo.model>', [id]);
  });

  // --- UI test ---
  test('<description of UI behavior> @smoke', async ({ page, rpc, hrMasterData }) => {
    const formPage = new <RelevantFormPage>(page);
    await formPage.navigate();

    const buttonVisible = await page
      .locator('button', { hasText: '<Config-Dependent Button>' })
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (!buttonVisible) {
      test.skip(true, '<Config-Dependent Button> not available in this Odoo configuration');
    }

    // ... test steps ...
  });

  // --- Validation test ---
  test('required field shows error when empty', async ({ page }) => {
    const formPage = new <RelevantFormPage>(page);
    await formPage.navigate();
    await formPage.save().catch(() => {});

    const errorText = await formPage.getFieldError('<field_name>');
    expect(errorText.length, `Expected validation error on <field_name>`).toBeGreaterThan(0);
  });
});
```

## Conventions to Enforce

1. Import `test` and `expect` ONLY from `../../../../core/fixtures/index` — never from `@playwright/test` directly (the only exception is a permissions test needing a role override via `storageState`)
2. The import path `../../../../core/fixtures/index` has exactly 4 `../` segments — correct for any file in `src/modules/<module>/tests/<step>/`
3. ALL created records must use `uniqueName()` or `uniqueEmail()` — never hardcode names
4. ALL records created inside a test body must be archived in teardown: `await rpc.archive('<model>', [id])`; use `rpc.archive()` not `rpc.unlink()`
5. Wrap teardown `rpc.archive()` in `.catch(() => {})` if the test might have been skipped before creation
6. Use `hrMasterData` fixture (not inline `rpc.create`) for any pre-existing employee/contract needed as a test prerequisite
7. Graceful skips use `test.skip(true, 'reason')` with the visibility check inline — not `test.skip(condition)` shorthand
8. Tags go on the `describe` block: `@module:<module> @step:<step>`. Add `@smoke` to the single most critical `test()` in the suite
9. `@e2e` tag is reserved for multi-step `02-business` suites only
10. Page object imports use relative paths (`../../pages/...`), NOT `@modules/` aliases

## Output

Generate the complete file content ready to write to disk, then state the full absolute path (e.g. `D:\Playwright_HR\src\modules\hr\tests\02-business\hr.business-approval.spec.ts`) and confirm the `../../../../` depth is correct for that path.
