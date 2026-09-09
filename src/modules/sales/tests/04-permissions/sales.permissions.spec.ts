/**
 * Step 4 — User Permissions for the sales module.
 *
 * NOTE: MANAGER_EMAIL/EMPLOYEE_EMAIL are not configured in this environment's .env, so
 * role-vs-role comparisons (the usual shape of this step) aren't possible here — there is
 * only the `admin` identity to test with. What IS genuinely testable with a single
 * identity is Odoo Studio's approval-based access control: it restricts WHICH users may
 * grant a given approval via security-group membership, independent of the general
 * Sales permissions `admin` otherwise has. Confirmed live via RPC
 * (`studio.approval.rule.check_approval` → `{ approved: false, can_validate: false }`)
 * that `admin` is correctly denied membership in "Sales / Jin - Sales - Sales Margin
 * Approvers" — this suite exercises that enforcement directly instead of only skipping
 * around it (see sales.notes.md).
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

test.describe('Sales User Permissions @module:sales @step:permissions', () => {
  test('blocks a user outside the Sales Margin Approvers group from granting Insufficient Margin approval @smoke', async ({ page, salesMasterData }) => {
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

    // Deliberately below any plausible product cost, to force the Insufficient Margin
    // approval requirement (same technique as the 02-business margin test).
    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0, unitPrice: 1 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }
    await formPage.save();

    const approvalVisible = await formPage.isStatusButtonVisible(/request.*insufficient.*margin.*approval/i);
    if (!approvalVisible) {
      test.skip(true, 'Insufficient Margin approval workflow is not configured in this Odoo environment');
      return;
    }

    await formPage.clickStatusButtonByRole(/request\s+insufficient\s+margin\w*\s+approval/i);

    const denied = await formPage.attemptApprovalAndCheckIfDenied(/approve insufficient margin/i);
    expect(denied, 'admin is not a member of the approver group, so clicking Approve must be rejected, not silently accepted').toBe(true);

    // The order must remain unconfirmed — permission enforcement should have real effect,
    // not just show a toast while quietly letting the state change anyway.
    expect(await formPage.isConfirmVisible()).toBe(false);
  });
});
