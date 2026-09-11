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
 * History: this originally exercised the Insufficient Margin rule (admin was denied
 * membership in "Sales / Jin - Sales - Sales Margin Approvers"). Admin was later
 * deliberately added to that group (2026-09-09) so the 02-business Insufficient Margin
 * test could exercise the full approve→confirm flow end to end, removing the block this
 * test relied on. Retargeted to Credit Limit next, but that rule depends on a customer's
 * real outstanding/overdue AR balance (confirmed live via `partner_credit_warning`
 * staying empty for any fresh customer regardless of order size or the Credit Limit
 * field) — not reproducible without posting real invoices, so it skipped
 * non-deterministically. Bank Guarantee was tried after that (customer's "Mandatory
 * Bank Guarantee" flag + a blank/expired guarantee) but confirmed live NOT to gate
 * confirmation at all here — the order confirms straight through with no approval step.
 *
 * Retargeted to Over Commission instead: confirmed live that a large order-line
 * discount (90%) reliably triggers "Request Over Commission Approval" — a rule driven
 * purely by an order-line attribute, not real payment history — and `admin` is
 * confirmed NOT a member of "Sales / Jin - Sales - Over Commission Approvers" (only
 * ever added to Margin Approvers).
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';

test.describe('Sales User Permissions @module:sales @step:permissions', () => {
  test('blocks a user outside the Over Commission Approvers group from granting Over Commission approval @smoke', async ({ page, salesMasterData }) => {
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

    // A 90% discount deliberately maximizes the chance of triggering the Over
    // Commission requirement (confirmed live) — this also happens to drop margin
    // below the Insufficient Margin threshold too, which is fine: only the Over
    // Commission button is targeted below.
    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 90 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }
    await formPage.save();

    const approvalVisible = await formPage.isStatusButtonVisible(/request.*over.*commission.*approval/i);
    if (!approvalVisible) {
      test.skip(true, 'Over Commission approval workflow is not configured in this Odoo environment');
      return;
    }

    await formPage.clickStatusButtonByRole(/request\s+over\s+commission\s+approval/i);

    const denied = await formPage.attemptApprovalAndCheckIfDenied(/approve over commission/i);
    expect(denied, 'admin is not a member of the Over Commission Approvers group, so clicking Approve must be rejected, not silently accepted').toBe(true);

    // The order must remain unconfirmed — permission enforcement should have real effect,
    // not just show a toast while quietly letting the state change anyway.
    expect(await formPage.isConfirmVisible()).toBe(false);
  });
});
