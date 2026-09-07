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
