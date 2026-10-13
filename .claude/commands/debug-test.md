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

**C — Data / State Failure** (orphaned `[TEST]` records, unexpected form state)
- Check `.env` credentials and `ODOO_BASE_URL`
- Search for leftover test records in Odoo directly via the UI using the `[TEST]` name prefix
- Reset test state by archiving or deleting orphaned records before re-running

**D — State / Version Mismatch** (unexpected status values)
- Use array containment: `expect(['Status A', 'Status B']).toContain(status)`

## Step 3: Reproduce
```bash
HEADLESS=false SLOW_MO=500 npx playwright test --grep "<test name>" --project=admin
npx playwright test --grep "<test name>" --project=admin --debug
```

## Step 4: Fix → `npm run lint` → re-run test
