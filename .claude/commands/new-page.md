# Scaffold a New Page Object File

You are creating a new Playwright TypeScript page object file for the Odoo 17 HR test framework.

## Arguments
$ARGUMENTS

Parse the arguments as: `<module> <odoo.model> "<field_name:field_type,...>"`
Examples:
- `hr leave.type "name:char,requires_allocation:bool,leave_validation_type:selection,responsible_id:many2one"`
- `payroll salary.structure "name:char,type_id:many2one,wage_type:selection"`
- `leave hr.leave.allocation "holiday_status_id:many2one,number_of_days:monetary,date_from:date,date_to:date"`

## Target File

Create the file at:
`src/modules/<module>/pages/<ModelNameInPascalCase>Page.ts`

Examples: `leave.type` → `LeaveTypePage.ts`, `hr.leave.allocation` → `LeaveAllocationPage.ts`.

## Field Type Mapping

Map field type arguments to component classes and their import paths:

| Field type | Component class | Import path |
|------------|----------------|-------------|
| `char` / `text` / `html` | `CharField` | `../../../core/components/CharField` |
| `many2one` | `Many2OneField` | `../../../core/components/Many2OneField` |
| `many2many` | `Many2ManyField` | `../../../core/components/Many2ManyField` |
| `date` / `datetime` | `DateField` | `../../../core/components/DateField` |
| `selection` | `SelectionField` | `../../../core/components/SelectionField` |
| `boolean` | `BooleanToggle` | `../../../core/components/BooleanToggle` |
| `monetary` / `integer` / `float` | `MonetaryField` | `../../../core/components/MonetaryField` |

Only import component classes that are actually used by the specified fields.

## Required Structure

Follow this pattern EXACTLY, mirroring `src/modules/hr/pages/EmployeePage.ts` and `ContractPage.ts`:

```typescript
import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
// Include only the component imports needed for the specified fields:
import { CharField } from '../../../core/components/CharField';
import { Many2OneField } from '../../../core/components/Many2OneField';
// ... other component imports ...

export class <ModelName>FormPage extends BaseFormPage {
  // One readonly property per field:
  readonly <camelCasePropertyName>: <ComponentClass>;

  constructor(page: Page) {
    super(page);
    // new ComponentClass(page, 'odoo_field_technical_name')
    this.<camelCasePropertyName> = new <ComponentClass>(page, '<odoo_field_name>');
  }

  async navigate(): Promise<void> {
    // Derive the Odoo URL from the model name.
    // Common patterns:
    //   hr.employee       → /odoo/employees/new
    //   hr.contract       → /odoo/payroll/contracts/new
    //   hr.leave          → /odoo/time-off/new
    //   hr.leave.type     → /odoo/time-off/types/new
    // If the URL is uncertain, use /odoo/<model-as-kebab>/new and add a TODO comment.
    await this.navigateTo('/odoo/<url-path>/new');
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/odoo/<url-path>/${id}`);
  }

  async create<ModelName>(data: {
    name: string;
    // One optional parameter per additional field:
    // <camelCasePropertyName>?: <TypeScript type>;
  }): Promise<void> {
    await this.<nameField>.setValue(data.name);
    // Required fields set unconditionally; optional fields use if-guards:
    // if (data.<field>) await this.<field>.setValue(data.<field>);
    await this.save();
  }
}

export class <ModelName>ListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.navigateTo('/odoo/<url-path>');
  }

  async open<ModelName>(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
```

## Conventions to Enforce

1. File lives in `src/modules/<module>/pages/` — use relative imports (`../../../core/...`), NOT `@core/` or `@modules/` aliases; aliases are for test files only
2. Every field declared as `readonly` on the class, initialized in constructor with `new ComponentClass(page, 'odoo_field_name')`
3. The string passed to each component constructor is the Odoo technical field name (snake_case, e.g. `department_id`, `date_start`); the TypeScript property is the semantic camelCase name (e.g. `department`, `dateStart`)
4. Always include `navigate()` and `openById(id: number)` on FormPage
5. Always include `navigate()` and `open<ModelName>(name: string)` on ListPage
6. The `create<ModelName>()` helper is always present — required fields unconditional, optional fields behind `if` guards
7. Do NOT extend `BaseKanbanPage` or `BaseSettingsPage` unless the module explicitly uses those views
8. No assertions inside page objects — they are pure interaction helpers
9. Run `npm run lint` after creating the file

## Output

Generate the complete file content, then state:
- The full absolute path (e.g. `D:\Playwright_HR\src\modules\hr\pages\LeaveTypePage.ts`)
- Which component imports were included and why
- Any URL paths that required inference (note them as TODO if uncertain)
