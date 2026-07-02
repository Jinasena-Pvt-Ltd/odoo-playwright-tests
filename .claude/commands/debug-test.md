# Diagnose a Failing Playwright Test

You are a debugging assistant for the Odoo 17 HR Playwright test framework. Help diagnose and fix a failing test.

## Arguments
$ARGUMENTS

Parse as: `<test-file-or-name> [error message or symptom]`
Examples:
- `hr.approvals.spec.ts "TimeoutError waiting for .o_statusbar_buttons"`
- `"contract can be confirmed to Running state" "Expected ['Running', 'Open'] to contain 'Draft'"`
- `src/modules/hr/tests/05-validations/hr.validations.spec.ts`

## Step 1: Locate and Read the Failing Test

Read the file provided. If only a test name is given, find it first:
```bash
grep -r "<test name>" src/modules --include="*.spec.ts" -l
```
Then read the full spec file.

## Step 2: Classify the Failure

Identify which category applies (multiple can apply):

---

### Category A: Locator / Selector Timeout
**Symptoms:** `TimeoutError: locator.waitFor`, `element not found`, `locator.click: Timeout`

Checks to run:
1. Is the locator targeting an Odoo SPA element before the page is ready? Look for `page.locator().click()` calls that bypass a page object's internal wait.
2. Has the Odoo 17 selector changed from what the test expects? Known differences:
   - Status bar buttons: `.o_statusbar_buttons` (v17 valid) vs `.o_status_bar_additional_actions` (newer)
   - Many2one dropdown: `.o_field_many2one_dropdown` or `.o-dropdown--menu`
   - Save button: `.o_form_button_save` or `button[name="save_manually"]`
   - List rows: `.o_data_row` (still valid in v17)
3. Is a conditionally rendered element being accessed without a prior visibility check?
4. Is the default timeout (5s) too short for this Odoo instance? The project sets `expectTimeout: 10_000` globally — if a specific locator needs more, pass `{ timeout: 15_000 }`.

Fixes:
- Append `.first()` if multiple elements match
- Add `{ timeout: 8_000 }` on the specific locator call
- Wrap config-dependent elements in a graceful skip:
  ```typescript
  const visible = await page.locator('button', { hasText: 'X' }).isVisible({ timeout: 3_000 }).catch(() => false);
  if (!visible) test.skip(true, 'X not available in this configuration');
  ```

---

### Category B: Auth / Role Mismatch
**Symptoms:** `403`, `Access Denied`, form loads but fields are read-only, expected buttons missing

Checks:
1. Which Playwright project is running this test? (`admin`, `manager`, `employee`) — see `playwright.config.ts`.
2. Does the test use `hrMasterData`? That fixture always authenticates as admin for RPC calls regardless of the browser project's `storageState`.
3. Are the `auth-storage/*.json` files stale? Auth sessions expire. Re-run setup:
   ```bash
   npx playwright test --project=setup
   ```
4. Does the test override `storageState` explicitly (permissions-test pattern)? Verify the path `auth-storage/employee.json` is correct and the file exists.
5. Is the Odoo user behind `MANAGER_EMAIL` actually in the HR Manager group? Check with:
   ```typescript
   const users = await rpc.searchRead('res.users', [['login', '=', process.env.MANAGER_EMAIL]], ['groups_id', 'name']);
   ```

Fixes:
- Refresh auth: `npx playwright test --project=setup`
- For role isolation in permission tests, use the pattern from `hr.permissions.spec.ts`:
  ```typescript
  import { test as base } from '@playwright/test';
  const employeeTest = base.extend({});
  employeeTest.use({ storageState: 'auth-storage/employee.json' });
  ```

---

### Category C: RPC / Data Setup Failure
**Symptoms:** `Odoo RPC error`, `HTTP 500`, `record not found`, `hrMasterData.employeeId` assertion fails

Checks:
1. Are `ODOO_BASE_URL` and `ODOO_DB` set correctly in `.env`?
2. Is `ADMIN_EMAIL` / `ADMIN_PASSWORD` valid? The `rpc` fixture always authenticates as admin.
3. Is the Odoo model name correct? Common mistakes:
   - `hr.employee` (correct) vs `res.employee` (wrong)
   - `hr.contract` (correct) vs `hr.payroll.contract` (wrong)
   - `hr.leave` (correct) vs `hr.holiday` (old Odoo name)
4. Does `rpc.create()` include all server-required fields? At minimum:
   - `hr.contract` requires: `name`, `employee_id`, `wage`, `date_start`
   - `hr.employee` requires: `name`
5. Did a previous run leave orphaned `[TEST]` records that are blocking creation (e.g. unique constraint)? Find them:
   ```typescript
   await rpc.searchRead('hr.employee', [['name', 'like', '[TEST]']], ['id', 'name', 'active'], { context: { active_test: false } });
   ```

Fixes:
- Add all required fields to `rpc.create()`
- Archive orphaned test records: `await rpc.archive('hr.employee', [orphanId])`
- Verify `.env` variables are loaded: `console.log(process.env.ODOO_BASE_URL)`

---

### Category D: Odoo State / Version Mismatch
**Symptoms:** `Expected ['Running', 'Open'] to contain 'Draft'`, unexpected status, button text differs, passes locally but fails in CI

Checks:
1. Is the test asserting an exact status bar value? Contract states differ across Odoo editions:
   - Community/Enterprise: `New` / `Running` / `Expired` / `Cancelled`
   - Some configurations: `Draft` / `Open` instead
   - Fix: use `expect(['New', 'Draft']).toContain(status)` instead of `expect(status).toBe('New')`
2. Was a field auto-computed by Odoo (e.g. salary rules modifying wage)?
3. Does the Odoo instance have custom modules that alter HR behavior? The graceful skip pattern handles this.
4. Is the test running on a shared instance where another run left data in unexpected state? Ensure all prior test records were archived (`active = false`).

Fixes:
- Replace exact string assertions with array containment: `expect([...]).toContain(value)`
- Add graceful skip before assertions that depend on Odoo configuration

---

## Step 3: Reproduce Efficiently

Provide the exact commands to run only the failing test:

```bash
# Run with browser visible and slow motion
HEADLESS=false SLOW_MO=500 npx playwright test --grep "<test name>" --project=admin

# Step-through debugger
npx playwright test --grep "<test name>" --project=admin --debug

# Interactive UI mode
npx playwright test --grep "<test name>" --project=admin --ui

# Generate a trace even on pass
npx playwright test --grep "<test name>" --project=admin --trace=on
# View trace:
npx playwright show-trace test-results/<path>/trace.zip
```

## Step 4: Produce a Fix

Provide:
1. The exact lines to change and what to change them to
2. Whether the fix belongs in the test, the page object, or a fixture
3. Whether `test.skip(true, 'reason')` is the correct resolution for a config-dependent feature
4. Whether `npm run lint` will surface the issue as a TypeScript error

## Step 5: Verify

After applying the fix:
```bash
npm run lint
npx playwright test --grep "<test name>" --project=admin
npm run test:hr
```
