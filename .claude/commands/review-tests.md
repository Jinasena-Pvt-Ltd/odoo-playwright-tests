# Review Test Files Against Project Conventions

You are a code reviewer for the Odoo 17 Playwright HR test framework. Review one or more spec files and report convention violations.

## Arguments
$ARGUMENTS

If a file path or glob is provided, review those files.
If no argument is provided, identify recently modified `.spec.ts` files by running:
```
git status --short
git diff --name-only HEAD
```
Then review those files. If no modified spec files are found, ask the user to specify a path.

## Review Checklist

For each file, evaluate every item below. Report each as:
- `[PASS]` — convention is followed
- `[FAIL]` — convention is violated (must fix before committing)
- `[WARN]` — deviation present but may be intentional
- `[INFO]` — improvement suggestion, not a violation

---

### 1. Import Source
- `[FAIL]` if `test` or `expect` is imported from `@playwright/test` in a spec that does NOT need a role override via `storageState`. The only valid reason to import from `@playwright/test` directly is a permissions-test pattern like `const roleTest = base.extend({}); roleTest.use({ storageState: '...' })`.
- `[FAIL]` if `test` is not imported from `../../../../core/fixtures/index` (or the correct relative path for this file's location — count the depth).
- `[FAIL]` if page object classes are imported using `@modules/` alias — must use relative paths (e.g. `../../pages/EmployeePage`).
- `[WARN]` if `@core/` aliases are used inside `src/modules/` spec files — prefer relative paths.

### 2. Unique Naming
- `[FAIL]` if any `rpc.create()` call passes a hardcoded string literal for `name`, `login`, or `email` without `uniqueName()` or `uniqueEmail()`.
- `[FAIL]` if `uniqueName()` / `uniqueEmail()` are used but not imported from `../../../../core/utils/RandomDataGenerator`.
- `[INFO]` if `RUN_TAG` is concatenated manually instead of using `uniqueName()`.

### 3. RPC Cleanup
- `[FAIL]` if a record is created with `rpc.create()` inside a `test()` body and there is no corresponding `rpc.archive()` in the same test body or in an `afterEach`/`afterAll` hook.
- `[FAIL]` if `rpc.unlink()` is used for cleanup — this project uses `rpc.archive()` (sets `active: false`), never hard-delete.
- `[WARN]` if a cleanup `rpc.archive()` is not wrapped in `.catch(() => {})` when the record may not have been created (e.g. after a conditional skip).
- `[PASS]` for records owned by the `hrMasterData` fixture — those are cleaned up by the fixture teardown.

### 4. Graceful Skip Pattern
- `[FAIL]` if a test throws or uses `expect(visible).toBe(true)` to assert that a config-dependent element is present — use `test.skip(true, 'reason')` instead.
- `[FAIL]` if `test.skip(true)` is called without a second string argument explaining why — the reason string is mandatory, not optional.
- `[WARN]` if `test.skip()` is called with a non-descriptive reason like `'TODO'` or `'skip'`.
- `[PASS]` if the correct pattern is used: `const visible = await locator.isVisible({ timeout: 3_000 }).catch(() => false); if (!visible) test.skip(true, '...');`

### 5. No UI-Based Data Setup
- `[FAIL]` if test data is created by navigating to a form and filling fields — all record creation must go through `rpc.create()`.
- `[PASS]` if the form navigation IS the subject of the test (testing the create flow itself).

### 6. Tag Convention
- `[FAIL]` if the `test.describe()` block does not include both `@module:<name>` and `@step:<name>` tags.
- `[FAIL]` if tags appear only on individual `test()` calls and not on the `describe` block — tags on `describe` are inherited by all tests inside.
- `[WARN]` if `@e2e` is used on a non-`02-business` spec.
- `[INFO]` if no test in the suite has `@smoke` — consider marking the most critical test.

### 7. Import Path Depth
- `[FAIL]` if the relative path from the spec file to `core/fixtures/index` has the wrong number of `../` segments. For any file in `src/modules/<module>/tests/<step>/`, the correct path is exactly `../../../../core/fixtures/index` (4 levels up: `<step>/` → `tests/` → `<module>/` → `modules/` → resolves `core/...` under `src/`).

### 8. Test Isolation
- `[FAIL]` if tests within the same `describe` block share mutable state via variables declared outside `test()` (a `let` written by one test and read by another).
- `[WARN]` if `test.beforeAll` is used to create records — prefer the `hrMasterData` worker fixture or per-test `rpc.create()`.

### 9. TypeScript Generics
- `[FAIL]` if `rpc.create()` or `rpc.searchRead()` is called without a type parameter, leaving the return type as implicit `any`.
- `[WARN]` if `// @ts-ignore` or `// @ts-expect-error` is present without a clear explanation comment.

### 10. Timeout and Selector Practices
- `[WARN]` if `page.waitForTimeout()` is used — prefer `waitForSelector`, `waitForURL`, or `waitForLoadState`.
- `[WARN]` if CSS selectors use positional indexes like `:nth-child()` to target dynamic content — use text-based filters instead.
- `[INFO]` if `page.locator()` is used directly in a test instead of a page object method.

### 11. 7-Step Folder Convention
- `[FAIL]` if a spec file lives outside one of the 7 numbered step folders (`01-config`, `02-business`, `03-reporting`, `04-permissions`, `05-validations`, `06-edge-cases`, `07-archive`). Every spec must be placed in the correct numbered folder — no loose spec files at `tests/` root or in non-standard folder names.
- `[WARN]` if the folder number does not match the `@step:` tag (e.g. a file in `02-business/` tagged `@step:config`).
- `[INFO]` if a step folder is empty or contains only placeholder/skip-all tests — note it for the author to fill in.

---

## Output Format

For each reviewed file:

```
## Review: <file path>

### Summary
- FAIL: N  |  WARN: N  |  INFO: N

### Findings

| # | Severity | Item | Line | Detail |
|---|----------|------|------|--------|
| 1 | FAIL | RPC Cleanup | 45 | rpc.create('hr.employee', ...) has no rpc.archive() |
| 2 | WARN | Graceful Skip | 67 | test.skip() called without a reason string |
...

### Required Actions (FAIL items)
1. Line 45: Add `await rpc.archive('hr.employee', [id]);` before test end

### Suggestions (WARN / INFO items)
...
```

If all checks pass, output: `All convention checks passed for <file>.`
