# Scaffold a New Page Object File

You are creating a new Playwright TypeScript page object file for the Odoo 17 test framework.

## Arguments
$ARGUMENTS

Parse the arguments as: `<module> <odoo.model> "<field_name:field_type,...>"`
Examples:
- `helpdesk helpdesk.ticket "name:char,partner_id:many2one,team_id:many2one,priority:selection"`
- `recruitment hr.applicant "partner_name:char,job_id:many2one,stage_id:many2one"`
- `expenses hr.expense "name:char,employee_id:many2one,total_amount:monetary,date:date"`

## Target File

Create the file at:
`src/modules/<module>/pages/<ModelNameInPascalCase>Page.ts`

Examples: `helpdesk.ticket` → `HelpdeskTicketPage.ts`, `hr.applicant` → `HrApplicantPage.ts`.

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

Follow this pattern EXACTLY, mirroring the page objects under `src/modules/helpdesk/pages/`:

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
3. The string passed to each component constructor is the Odoo technical field name (snake_case, e.g. `partner_id`, `date_start`); the TypeScript property is the semantic camelCase name (e.g. `partner`, `dateStart`)
4. Always include `navigate()` and `openById(id: number)` on FormPage
5. Always include `navigate()` and `open<ModelName>(name: string)` on ListPage
6. The `create<ModelName>()` helper is always present — required fields unconditional, optional fields behind `if` guards
7. Do NOT extend `BaseKanbanPage` or `BaseSettingsPage` unless the module explicitly uses those views
8. No assertions inside page objects — they are pure interaction helpers
9. Run `npm run lint` after creating the file

## Output

Generate the complete file content, then state:
- The full absolute path (e.g. `D:\Github\odoo-playwright-tests\src\modules\helpdesk\pages\HelpdeskTicketPage.ts`)
- Which component imports were included and why
- Any URL paths that required inference (note them as TODO if uncertain)
