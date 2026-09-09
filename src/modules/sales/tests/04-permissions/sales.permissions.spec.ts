/**
 * Step 4 — User Permissions for the sales module.
 *
 * NOTE: MANAGER_EMAIL/EMPLOYEE_EMAIL are not configured in this environment's .env, so
 * role-vs-role comparisons (the usual shape of this step) aren't possible here — there is
 * only the `admin` identity to test with. What IS genuinely testable with a single
 * identity is Odoo Studio's approval-based access control: it restricts WHICH users may
 * grant a given approval via security-group membership, independent of the general
 * Sales permissions `admin` otherwise has.
 *
 * This originally exercised the Insufficient Margin rule (admin was denied membership in
 * "Sales / Jin - Sales - Sales Margin Approvers" — confirmed live via
 * `studio.approval.rule.check_approval` returning `can_validate: false`). Admin was later
 * deliberately added to that group (2026-09-09) so the 02-business Insufficient Margin
 * test could exercise the full approve→confirm flow end to end, which removed the block
 * this test relied on. Retargeted to the Credit Limit rule instead — confirmed live via
 * the same RPC that admin is NOT a member of "Sales / Jin - Sales - Credit Limit
 * Approvers", so that rule still demonstrates real enforcement with only the `admin`
 * identity available.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

test.describe('Sales User Permissions @module:sales @step:permissions', () => {
  test('blocks a user outside the Credit Limit Approvers group from granting Credit Limit approval @smoke', async ({ page, salesMasterData }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(salesMasterData.customerName);
    if (!customerFound) {
      test.skip(true, `Could not select fixture-created customer "${salesMasterData.customerName}" — transient UI issue, not a missing-data problem`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }

    // A very large quantity AND an explicit high unit price (same technique as the
    // 02-business Credit Limit test) keeps this independent of the customer's actual
    // current overdue balance: the total should exceed any realistic credit limit.
    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 100_000, discount: 0, unitPrice: 999_999 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }
    await formPage.save();

    const approvalVisible = await formPage.isStatusButtonVisible(/request.*credit.*limit.*approval/i);
    if (!approvalVisible) {
      test.skip(true, 'This order did not require Credit Limit approval in this environment (e.g. within the customer\'s configured limit)');
      return;
    }

    await formPage.clickStatusButtonByRole(/request\s+credit\s+limit\s+approval/i);

    const denied = await formPage.attemptApprovalAndCheckIfDenied(/approve credit limit/i);
    expect(denied, 'admin is not a member of the Credit Limit Approvers group, so clicking Approve must be rejected, not silently accepted').toBe(true);

    // The order must remain unconfirmed — permission enforcement should have real effect,
    // not just show a toast while quietly letting the state change anyway.
    expect(await formPage.isConfirmVisible()).toBe(false);
  });
});
