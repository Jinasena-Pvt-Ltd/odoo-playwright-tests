import { Page } from '@playwright/test';
import { BaseFormPage } from '../../../core/base/BaseFormPage';
import { BaseListPage } from '../../../core/base/BaseListPage';
import { Many2OneField } from '../../../core/components/Many2OneField';
import { Many2ManyField } from '../../../core/components/Many2ManyField';
import { SelectionField } from '../../../core/components/SelectionField';

/**
 * Page object for the Helpdesk ticket form as customized by the Fix Repair
 * Studio app (custom `x_studio_*` fields layered on `helpdesk.ticket`).
 * Reflects the flow captured in the "Repair User Guide" Odoo Tour exports.
 *
 * This instance does not serve the newer `/odoo/<slug>` pretty URLs (confirmed
 * against a live instance — `/odoo/helpdesk` 404s), so `navigate()` replicates
 * the tour's own menu-click path instead of a hardcoded deep link.
 *
 * `ticket_type_id` is a many2one (not a plain selection) rendered as an
 * autocomplete input — confirmed via DOM inspection against a live ticket.
 * `name` is server-assigned via sequence once the ticket is first
 * saved/assigned (e.g. by `assignToMe()`) and is never user-editable.
 */
export class FixRepairTicketPage extends BaseFormPage {
  readonly repairType: Many2OneField;
  readonly customer: Many2OneField;
  readonly product: Many2OneField;
  readonly returnReceiptLocation: Many2OneField;
  readonly jobLocation: SelectionField;
  readonly repairReason: Many2ManyField;

  constructor(page: Page) {
    super(page);
    this.repairType = new Many2OneField(page, 'ticket_type_id');
    this.customer = new Many2OneField(page, 'partner_id');
    this.product = new Many2OneField(page, 'product_id');
    this.returnReceiptLocation = new Many2OneField(page, 'x_studio_return_receipt_location');
    this.jobLocation = new SelectionField(page, 'x_studio_job_location');
    this.repairReason = new Many2ManyField(page, 'x_studio_repair_reason');
  }

  /**
   * Opens a fresh, unsaved ticket via Helpdesk → Tickets → New (see class doc
   * for why). Broken into discrete steps (rather than one opaque call) so
   * callers — e.g. the manual-generating spec — can screenshot in between.
   */
  async navigate(): Promise<void> {
    await this.openHelpdeskApp();
    await this.openTicketsList();
    await this.clickNewTicket();
  }

  /** Step 1: open the Helpdesk app from the home menu grid. */
  async openHelpdeskApp(): Promise<void> {
    await this.navigateTo('/web');
    // `/web` alone lands on whatever app was last open, not the app grid —
    // the home-menu toggle must be clicked explicitly to reach it.
    await this.page.locator('a.o_menu_toggle').click();
    await this.page.locator('[data-menu-xmlid="helpdesk.menu_helpdesk_root"]').click();
    await this.waitForOdooReady();
  }

  /**
   * Step 2: from the Helpdesk Overview dashboard, open the team's ticket list.
   *
   * Uses the top navbar's "Tickets" menu (→ "All Tickets") rather than the
   * dashboard card's own "Tickets" button — both are named exactly "Tickets",
   * and the navbar one wins any generic role-based lookup, opening a dropdown
   * instead of the list. Going through that dropdown directly sidesteps the
   * ambiguity rather than fighting it. The kanban view's own "New" button
   * (absent on Overview) confirms a genuine transition.
   */
  async openTicketsList(): Promise<void> {
    await this.page.getByRole('button', { name: 'Tickets', exact: true }).first().click();
    await this.page.getByRole('menuitem', { name: 'All Tickets' }).click();
    await this.page.getByRole('button', { name: /^New$/ }).first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  /** Step 3: click New from the ticket list to open a fresh, unsaved ticket form. */
  async clickNewTicket(): Promise<void> {
    await this.clickNew();
    await this.page.locator('.o_statusbar_buttons').waitFor({ state: 'visible', timeout: 15_000 });
  }

  async openById(id: number): Promise<void> {
    await this.navigateTo(`/web#model=helpdesk.ticket&view_type=form&id=${id}`);
  }

  /**
   * Clicks the "Assign to Me" status-bar action. On this instance, this is
   * also what first saves the ticket and triggers its sequence-based name
   * (e.g. "REPAIR/2026/01489") — the ticket has no user-fillable title field.
   */
  async assignToMe(): Promise<void> {
    await this.clickStatusButton('Assign to Me');
  }

  /** Clicks the "Create Serial No" button shown for repair types without a serial number. */
  async createRepairSerial(): Promise<void> {
    const btn = this.page.locator('button[name="action_create_repair_serial"]');
    await btn.waitFor({ state: 'visible', timeout: 8_000 });
    await btn.click();
    await this.waitForOdooReady();
  }

  /** Confirms the item's arrival at the factory (status-bar action). */
  async receivedAtFactory(): Promise<void> {
    await this.clickStatusButton('Received at Factory');
  }

  /**
   * Clicks "Plan Intervention" and, from the resulting "Create a Field
   * Service task" dialog, clicks "Create & View Task" — opening the FSM task
   * in a dialog on top of the ticket (not a full-page navigation).
   */
  async planInterventionAndViewTask(): Promise<void> {
    await this.clickStatusButton('Plan Intervention');
    await this.page.getByRole('button', { name: 'Create & View Task' }).click();
    // A generic dialog-role wait resolves immediately against the still-open
    // "Create a Field Service task" dialog itself — wait for that dialog's
    // own title to disappear instead, confirming the task view replaced it.
    await this.page.getByText('Create a Field Service task').waitFor({ state: 'hidden', timeout: 15_000 });
    await this.page.getByRole('tab', { name: 'Repair Diagnosis' }).waitFor({ state: 'visible', timeout: 15_000 });
  }

  /**
   * Opens the FSM material/products view for the repair job. Confirmed
   * absent from this instance's backend Task form (even at full desktop
   * width, with the task fully classified) — the industry_fsm module's
   * "Products" smart button appears only in the Field Service app's own
   * (tablet-oriented) task view, not here. Left in place for instances where
   * it is available; callers should check visibility before calling.
   */
  async openMaterials(): Promise<void> {
    await this.page.locator('button[name="action_fsm_view_material"]').click();
    await this.waitForOdooReady();
  }

  /** Opens the FSM tasks smart button. */
  async openTasks(): Promise<void> {
    await this.clickSmartButton('Tasks');
  }

  /** Opens the linked Sales Order smart button / action. */
  async openSalesOrder(): Promise<void> {
    const btn = this.page.locator('button[name="action_view_so"]');
    await btn.waitFor({ state: 'visible', timeout: 8_000 });
    await btn.click();
    await this.waitForOdooReady();
  }

  /** Opens the linked invoices smart button / action. */
  async openInvoices(): Promise<void> {
    const btn = this.page.locator('button[name="action_view_invoices"]');
    await btn.waitFor({ state: 'visible', timeout: 8_000 });
    await btn.click();
    await this.waitForOdooReady();
  }

  /** Sends the item back to the sale centre once repair work is complete. */
  async sendToSalesCentre(): Promise<void> {
    await this.page.locator('button[name="action_send_to_sales_centre"]').click();
    await this.waitForOdooReady();
  }

  /** Confirms receipt of an item at the sale centre. */
  async markReceivedAtSalesCentre(): Promise<void> {
    await this.page.locator('button[name="action_received_at_sales_centre"]').click();
    await this.waitForOdooReady();
  }

  /** Dispatches the completed repair item directly back to the customer. */
  async directDispatch(): Promise<void> {
    await this.page.locator('button[name="fix_repair_action_direct_dispatch"]').click();
    await this.waitForOdooReady();
  }
}

export class FixRepairListPage extends BaseListPage {
  constructor(page: Page) {
    super(page);
  }

  async navigate(): Promise<void> {
    await this.navigateTo('/web');
    await this.page.locator('a.o_menu_toggle').click();
    await this.page.locator('[data-menu-xmlid="helpdesk.menu_helpdesk_root"]').click();
    await this.waitForOdooReady();
    // See FixRepairTicketPage.openTicketsList() for why this goes through the
    // navbar's "Tickets" → "All Tickets" dropdown.
    await this.page.getByRole('button', { name: 'Tickets', exact: true }).first().click();
    await this.page.getByRole('menuitem', { name: 'All Tickets' }).click();
    await this.page.getByRole('button', { name: /^New$/ }).first().waitFor({ state: 'visible', timeout: 20_000 });
  }

  async openTicket(name: string): Promise<void> {
    await this.clickRowByText(name);
  }
}
