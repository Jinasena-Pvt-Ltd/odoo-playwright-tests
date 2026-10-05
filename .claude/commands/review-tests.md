# Review Test Files Against Project Conventions

## Arguments
$ARGUMENTS
File path/glob or auto-detect from `git status --short`.

## Checklist — report as [PASS] [FAIL] [WARN] [INFO]

### 1. Import Source
- `[FAIL]` `test`/`expect` from `@playwright/test` (only valid for role-override in permissions specs)
- `[FAIL]` `test` not from `../../../../core/fixtures/index`
- `[FAIL]` page objects imported via `@modules/` alias — must use relative paths

### 2. Unique Naming
- `[FAIL]` hardcoded string literal for record names, emails, or references in form fills
- `[FAIL]` `uniqueName()`/`uniqueEmail()` used but not imported from `../../../../core/utils/RandomDataGenerator`

### 3. UI Interaction
- `[FAIL]` test uses `rpc.create()` / `rpc.searchRead()` / `rpc.archive()` instead of browser UI interactions
- `[FAIL]` test bypasses the UI to set up or assert data state via RPC
- `[PASS]` test uses page objects and form fills for all create/edit/assert actions

### 4. Graceful Skip
- `[FAIL]` `expect(visible).toBe(true)` on config-dependent element — use `test.skip(true, 'reason')`
- `[FAIL]` `test.skip(true)` without reason string
- `[WARN]` non-descriptive reason (`'TODO'`, `'skip'`)

### 6. Tag Convention
- `[FAIL]` `test.describe()` missing `@module:<name>` or `@step:<name>`
- `[FAIL]` tags only on `test()` not on `describe`
- `[WARN]` `@e2e` on non-`02-business` spec

### 7. Import Path Depth
- `[FAIL]` wrong number of `../` segments — must be exactly 4 for `src/modules/<module>/tests/<step>/`

### 8. Test Isolation
- `[FAIL]` mutable `let` variables shared between tests in the same describe
- `[WARN]` `test.beforeAll` used to create records

### 9. TypeScript Generics
- `[FAIL]` page object methods called without necessary type annotations on return values

### 10. Timeout/Selector Practices
- `[WARN]` `page.waitForTimeout()` — prefer event-based waits
- `[WARN]` positional CSS selectors (`:nth-child()`) on dynamic content

### 11. 7-Step Folder Convention
- `[FAIL]` spec file outside `01-config` through `07-archive` folders
- `[WARN]` folder number mismatches `@step:` tag
- `[INFO]` folder contains only placeholder/skip-all tests

## Output Format

```
## Review: <file>
### Summary — FAIL: N | WARN: N | INFO: N
| # | Severity | Check | Line | Detail |
### Required Actions (FAIL)
### Suggestions (WARN/INFO)
```
If clean: `All convention checks passed for <file>.`
