/**
 * Step 5 — Field Validations for the sales module.
 *
 * NOTE: Customer/Product/Sales Team/Warehouse names below are pre-existing
 * environment master data (see sales.master-data.ts) — they are selected via
 * Many2one lookups, not created by these tests, so uniqueName() does not apply
 * to them. Every test gracefully skips when that reference data is absent.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesFormPage, SalesCustomerFormPage } from '../../pages/SalesPage';
import { SALES_TEST_CONFIG } from '../../data/sales.master-data';
import { uniqueName } from '../../../../core/utils/RandomDataGenerator';

async function buildLinesOrSkip(formPage: SalesFormPage): Promise<boolean> {
  const added = await formPage.addOrderLines([
    { product: SALES_TEST_CONFIG.product1, quantity: 1, discount: 10 },
    { product: SALES_TEST_CONFIG.product2, quantity: 2, discount: 10 },
  ]);
  return added > 0;
}

test.describe('Sales Field Validations @module:sales @step:validations', () => {
  test('blocks save when Customer is left blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    expect(await formPage.isCustomerFieldEmpty()).toBe(true);

    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('blocks save when Quotation Type (Order Payment Type) is left blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }

    // Quotation Type intentionally left blank — this is the field under test.
    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('blocks save or is read-only when Payment Terms is blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    await formPage.openOtherInfoTab();

    const readOnly = await formPage.isFieldReadOnly('payment_term_id');
    const value = await formPage.readFieldText('payment_term_id');
    if (readOnly && value) {
      // Field is locked to an auto-filled value — it cannot be left blank by the user.
      expect(value.length).toBeGreaterThan(0);
      return;
    }

    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('blocks save or is read-only when Salesperson is blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    await formPage.openOtherInfoTab();

    const readOnly = await formPage.isFieldReadOnly('user_id');
    const value = await formPage.readFieldText('user_id');
    if (readOnly && value) {
      expect(value.length).toBeGreaterThan(0);
      return;
    }

    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('blocks save or is read-only when Sales Team is blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    await formPage.openOtherInfoTab();

    const readOnly = await formPage.isFieldReadOnly('team_id');
    const value = await formPage.readFieldText('team_id');
    if (readOnly && value) {
      expect(value.length).toBeGreaterThan(0);
      return;
    }

    // Sales Team deliberately left blank — only Warehouse is filled.
    const warehouseOk = await formPage.selectWarehouseIfExists(SALES_TEST_CONFIG.warehouse);
    if (!warehouseOk) {
      test.skip(true, 'Reference Warehouse not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('blocks save or is read-only when Company is blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);

    const readOnly = await formPage.isFieldReadOnly('company_id');
    const value = await formPage.readFieldText('company_id');
    if (readOnly && value) {
      expect(value.length).toBeGreaterThan(0);
      return;
    }

    const otherInfoOk = await formPage.fillOtherInfo(SALES_TEST_CONFIG.salesTeam, SALES_TEST_CONFIG.warehouse);
    if (!otherInfoOk) {
      test.skip(true, 'Reference Sales Team/Warehouse not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('blocks save or is read-only when Warehouse is blank', async ({ page }) => {
    const formPage = new SalesFormPage(page);
    await formPage.navigate();

    const customerFound = await formPage.selectCustomerIfExists(SALES_TEST_CONFIG.customer);
    if (!customerFound) {
      test.skip(true, `Reference customer "${SALES_TEST_CONFIG.customer}" not found in this Odoo environment`);
      return;
    }
    await formPage.setQuotationType(SALES_TEST_CONFIG.quotationType);
    await formPage.openOtherInfoTab();

    const readOnly = await formPage.isFieldReadOnly('warehouse_id');
    const value = await formPage.readFieldText('warehouse_id');
    if (readOnly && value) {
      expect(value.length).toBeGreaterThan(0);
      return;
    }

    // Warehouse deliberately left blank — only Sales Team is filled.
    const teamOk = await formPage.selectSalesTeamIfExists(SALES_TEST_CONFIG.salesTeam);
    if (!teamOk) {
      test.skip(true, 'Reference Sales Team not found in this Odoo environment');
      return;
    }
    if (!(await buildLinesOrSkip(formPage))) {
      test.skip(true, 'Reference products not found in this Odoo environment');
      return;
    }

    const { blocked } = await formPage.attemptSaveExpectingBlock();
    expect(blocked).toBe(true);
  });

  test('requires Bank Guarantee Amount and Expiry Date for a DISTR customer group', async ({ page }) => {
    const customerPage = new SalesCustomerFormPage(page);
    await customerPage.navigate();
    await customerPage.customerName.setValue(uniqueName('Distributor Customer'));

    const groupFound = await customerPage.selectCustomerGroupIfExists(SALES_TEST_CONFIG.distributorCustomerGroup);
    if (!groupFound) {
      test.skip(true, `Customer Group "${SALES_TEST_CONFIG.distributorCustomerGroup}" not configured in this Odoo environment`);
      return;
    }

    const tabOpened = await customerPage.openBankGuaranteeTabIfPresent();
    if (!tabOpened) {
      test.skip(true, 'Bank Guarantee Details tab not present for this customer group in this Odoo environment');
      return;
    }

    const fieldsPresent = await customerPage.hasBankGuaranteeFields();
    if (!fieldsPresent) {
      test.skip(true, 'Bank Guarantee Amount/Expiry Date fields not found — Studio field names may differ in this environment');
      return;
    }

    // Amount blank, Expiry Date filled → save must be blocked.
    await customerPage.bankGuaranteeAmount.setValue(0);
    await customerPage.bankGuaranteeExpiryDate.setValue('2030-12-31');
    const attempt1 = await customerPage.attemptSaveExpectingBlock();
    expect(attempt1.blocked).toBe(true);

    // Amount filled, Expiry Date blank → save must still be blocked.
    await customerPage.bankGuaranteeAmount.setValue(5000);
    await customerPage.bankGuaranteeExpiryDate.clear();
    const attempt2 = await customerPage.attemptSaveExpectingBlock();
    expect(attempt2.blocked).toBe(true);
  });
});
