/**
 * Step 5 — Field Validations for the sales module.
 * Blank required fields on a quotation, and the mandatory Bank Guarantee on distributor customers.
 */
import { test, expect } from '../../../../core/fixtures/index';
import { SalesAppPage, QuotationListPage, QuotationFormPage, CustomerFormPage } from '../../pages/SalesPage';
import { SALES_MASTER_DATA } from '../../data/sales.master-data';
import {
  SALES_BLANK_FIELD_CASES,
  SALES_BANK_GUARANTEE_AMOUNT_VALID,
  SALES_BANK_GUARANTEE_EXPIRY_VALID,
} from '../../data/sales.validation-cases';

const D = SALES_MASTER_DATA;

test.describe('Sales Field Validations @module:sales @step:validations', () => {
  for (const c of SALES_BLANK_FIELD_CASES) {
    test(`quotation with a blank ${c.label} cannot be saved (step ${c.step})`, async ({ page }) => {
      test.setTimeout(240_000);
      const app = new SalesAppPage(page);
      const form = new QuotationFormPage(page);

      await app.open();
      await app.switchCompany(D.company);
      await app.goToQuotations();
      await new QuotationListPage(page).clickNewQuotation();
      await form.waitForNewForm();

      // A read-only, pre-filled field cannot be left blank by a user, so there is nothing to validate.
      if (c.skipIfReadOnly && c.field) {
        let state = await form.fieldState(c.field);
        if (!state.present) {
          await form.openTab(/other\s*info/i);
          state = await form.fieldState(c.field);
        }
        test.skip(
          state.present && !state.editable && state.value !== '',
          `${c.label} is read-only and already filled ("${state.value}") in this configuration`,
        );
      }

      // Standard fill, leaving only the field under test blank / untouched.
      await form.fillQuotation({
        customer: c.omit === 'customer' ? null : D.customer,
        quotationType: c.omit === 'quotationType' ? null : D.quotationType,
        salesTeam: c.omit === 'salesTeam' ? null : D.salesTeam,
        warehouse: c.omit === 'warehouse' ? null : D.warehouse,
        lines: [
          { product: D.product1, quantity: 1, discount: 10 },
          { product: D.product2, quantity: 2, discount: 10 },
        ],
      });

      // Odoo pre-fills several of these fields (Salesperson, Sales Team, Warehouse, Payment Terms ...), so "not
      // touched" is NOT "blank". Empty the field for real, and only then try to save.
      if (c.skipIfReadOnly && c.field) {
        await form.openTab(/other\s*info/i);
        const emptied = await form.clearMany2one(c.field);
        const nowShows = await form.many2oneValue(c.field);
        test.skip(
          !emptied || nowShows !== '',
          `${c.label} cannot be emptied here (it is read-only, or Odoo fills it in again); it still shows "${nowShows}"`,
        );
        test.info().annotations.push({ type: 'field-state', description: `${c.label} was emptied before saving` });
      }

      const outcome = await form.trySave();
      if (outcome.saved && c.field && c.skipIfReadOnly) {
        // Report what the saved record holds: if Odoo re-filled the field while saving, it was not really saved blank.
        await form.openTab(/other\s*info/i);
        const afterSave = await form.many2oneValue(c.field);
        test.info().annotations.push({ type: 'after-save', description: `${c.label} on the saved quotation: "${afterSave}"` });
        expect(
          false,
          `Odoo saved the quotation although ${c.label} was emptied. On the saved quotation the field shows "${afterSave || '(empty)'}"` +
            (afterSave ? ' — Odoo filled it in again while saving.' : ' — it was saved blank.'),
        ).toBe(true);
      }
      expect(outcome.saved, `Odoo saved the quotation although ${c.label} was blank`).toBe(false);
      expect(
        outcome.invalidFields > 0 || outcome.notification !== '' || outcome.dialog !== '',
        `Odoo blocked the save but showed no validation signal for ${c.label}`,
      ).toBe(true);
      test.info().annotations.push({
        type: 'odoo-validation',
        description: outcome.dialog || outcome.notification || `${outcome.invalidFields} invalid field(s)`,
      });
    });
  }

  test('a distributor customer needs both Bank Guarantee amount and expiry date', async ({ page }) => {
    test.setTimeout(420_000);
    const app = new SalesAppPage(page);
    const customer = new CustomerFormPage(page);

    await app.open();
    await app.switchCompany(D.company);
    await app.goToCustomers();
    await app.searchAndOpen(D.customer);
    await customer.setCustomerGroup(D.distributorGroup);
    await customer.openBankGuaranteeTab();

    const amount = await customer.bankGuaranteeAmountInput();
    const expiry = await customer.bankGuaranteeExpiryInput();
    await expect(amount).toBeVisible();
    await expect(expiry).toBeVisible();
    const { year, month, day } = SALES_BANK_GUARANTEE_EXPIRY_VALID;
    const validDate = await customer.futureDateFor(expiry, year, month, day);

    try {
      await test.step('amount blank, expiry date filled', async () => {
        await customer.setInput(amount, '0');
        await amount.press('Tab');
        await customer.setInput(expiry, validDate);
        await expiry.press('Escape');
        const outcome = await customer.trySave({ strict: true });
        expect(outcome.saved, 'saved with a blank Bank Guarantee amount').toBe(false);
        expect(outcome.dialog, 'Odoo should explain that the amount is required').toMatch(/bank guarantee amount/i);
        await customer.dismissDialog('stay');
      });

      await test.step('amount filled, expiry date blank', async () => {
        await customer.setInput(amount, SALES_BANK_GUARANTEE_AMOUNT_VALID);
        await amount.press('Tab');
        await customer.setInput(expiry, '');
        await expiry.press('Escape');
        const outcome = await customer.trySave({ strict: true });
        // The expiry-date message is brief and auto-dismissing, so only the refusal itself is asserted.
        expect(outcome.saved, 'saved with a blank Bank Guarantee expiry date').toBe(false);
        await customer.dismissDialog('stay');
      });

      await test.step('amount and expiry date both blank', async () => {
        await customer.setInput(amount, '0');
        await amount.press('Tab');
        await customer.setInput(expiry, '');
        await expiry.press('Escape');
        const outcome = await customer.trySave({ strict: true });
        expect(outcome.saved, 'saved with both Bank Guarantee fields blank').toBe(false);
        expect(
          outcome.invalidFields > 0 || outcome.dialog !== '' || outcome.notification !== '',
          'Odoo should flag the blank fields (invalid field, dialog or notification)',
        ).toBe(true);
      });
    } finally {
      // Never leave unsaved edits on the customer record.
      await customer.dismissDialog('discard').catch(() => {});
      await customer.discard().catch(() => {});
    }
  });
});
