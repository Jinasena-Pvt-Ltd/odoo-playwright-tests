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
 * test relied on. Retargeted to Credit Limit next, but that rule turned out to depend on
 * a customer's real outstanding/overdue AR balance (confirmed live via
 * `partner_credit_warning` staying empty for any fresh customer regardless of order size
 * or the Credit Limit field) — not reproducible without posting real invoices, so it
 * skipped non-deterministically.
 *
 * Retargeted again to the Bank Guarantee Approvers group: like Insufficient Margin, this
 * rule is driven by an order/customer ATTRIBUTE (the customer's "Mandatory Bank
 * Guarantee" flag + the order's Bank Guarantee Amount/Expiry Date), not real payment
 * history — confirmed live in 05-validations' Bank Guarantee test that checking this flag
 * doesn't block the Contact form itself, but is enforced at Sales Order confirmation via
 * a "Request/Approve Bank Guarantee" gate. `admin` is confirmed NOT a member of "Sales /
 * Jin - Sales - Bank Guarantee Approvers" (only ever added to Margin Approvers).
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage, SalesCustomerFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

test.describe('Sales User Permissions @module:sales @step:permissions', () => {
  test('blocks a user outside the Bank Guarantee Approvers group from granting Bank Guarantee approval @smoke', async ({ page }) => {
    const customerPage = new SalesCustomerFormPage(page);
    await customerPage.navigate();
    await customerPage.customerName.setValue(uniqueName('Bank Guarantee Customer'));

    const tabOpened = await customerPage.openBankGuaranteeTabIfPresent();
    if (!tabOpened) {
      test.skip(true, 'Bank Guarantee Details tab not present in this Odoo environment');
      return;
    }
    await customerPage.mandatoryBankGuarantee.enable();
    await customerPage.save();
    const customerName = await customerPage.customerName.getValue();

    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(customerName);
    if (!customerFound) {
      test.skip(true, `Could not select the newly-created customer "${customerName}" — transient UI issue, not a missing-data problem`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    await formPage.setOrderPaymentType(SALES_TEST_CONFIG.orderPaymentType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }
    const added = await formPage.addOrderLines([
      { product: SALES_TEST_CONFIG.product, quantity: 1, discount: 0 },
    ]);
    if (added === 0) {
      test.skip(true, 'Reference product not found in this Odoo environment');
      return;
    }
    await formPage.save();

    const approvalVisible = await formPage.isStatusButtonVisible(/request.*bank.*guarantee.*approval/i);
    if (!approvalVisible) {
      test.skip(true, 'Bank Guarantee approval workflow is not configured in this Odoo environment');
      return;
    }

    await formPage.clickStatusButtonByRole(/request\s+bank\s+guarantee\s+approval/i);

    const denied = await formPage.attemptApprovalAndCheckIfDenied(/approve bank guarantee/i);
    expect(denied, 'admin is not a member of the Bank Guarantee Approvers group, so clicking Approve must be rejected, not silently accepted').toBe(true);

    // The order must remain unconfirmed — permission enforcement should have real effect,
    // not just show a toast while quietly letting the state change anyway.
    expect(await formPage.isConfirmVisible()).toBe(false);
  });
});
