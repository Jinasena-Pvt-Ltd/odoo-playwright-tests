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
