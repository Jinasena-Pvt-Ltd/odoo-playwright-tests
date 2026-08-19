/**
 * Step 7 — Archive & Cleanup for the purchase module.
 * TODO: Replace the placeholder test with real test cases.
 */
import { test } from '../../../../core/fixtures/index';
import { OdooRPC } from '../../../../core/api/OdooRPC';

/**
 * Returns true if the primary Odoo model for this module exists on the instance.
 * TODO: Replace 'module.primary.model' with the real Odoo model name (e.g. 'purchase.order').
 */
async function isModuleInstalled(rpc: OdooRPC): Promise<boolean> {
  const r = await rpc.searchRead<{ id: number }>(
    'ir.model', [['model', '=', 'module.primary.model']], ['id'], { limit: 1 },
  );
  return r.length > 0;
}

test.describe('Purchase Archive & Cleanup @module:purchase @step:archive', () => {

  test('placeholder — replace with real test @smoke', async ({ rpc }) => {
    if (!await isModuleInstalled(rpc)) {
      test.skip(true, 'Purchase module not installed on this instance — update isModuleInstalled() model name');
      return;
    }
    // TODO: Implement this test.
    // Conventions:
    //   1. Use rpc.create() for all test data setup — never UI
    //   2. Use uniqueName() for every record name
    //   3. Archive all records in teardown: await rpc.archive(model, [id])
    //   4. Wrap config-dependent assertions in graceful skip:
    //      const visible = await page.locator('button', { hasText: 'X' })
    //        .isVisible({ timeout: 3_000 }).catch(() => false);
    //      if (!visible) test.skip(true, 'X not available in this configuration');
    test.skip(true, 'Not yet implemented — replace this placeholder with real test logic');
  });
});
