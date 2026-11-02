// Builds a Markdown + self-contained HTML manual for a converted tour from:
//   - the original tour JSON (step titles/content)
//   - the screenshots captured by the generated spec while replaying it
//
// Usage: node build-manual.js <tour-name> <path-to-tour.json>
// Example: node build-manual.js sales ../../tour/sales.json

const fs = require('fs');
const path = require('path');

const [, , tourName, tourJsonPath] = process.argv;
if (!tourName || !tourJsonPath) {
  console.error('Usage: node build-manual.js <tour-name> <path-to-tour.json>');
  process.exit(1);
}

const tourData = JSON.parse(fs.readFileSync(path.resolve(tourJsonPath), 'utf-8'));
const tour = tourData.tours[0];
const screenshotDir = path.join(__dirname, 'generated/screenshots', tourName);
const manualDir = path.join(__dirname, 'generated/manuals');
fs.mkdirSync(manualDir, { recursive: true });

// Adaptations made by the translator (hand-authored here, since this run didn't go through
// a fully automated pipeline) — surfaced in REVIEW.md and noted inline in the manual.
// One entry per tour (keyed by the `tourName` arg); sequences not run at all (e.g. excluded
// trailing/accidental steps, or fields that no longer exist on the form) are listed under
// `excluded` so the manual can say so instead of just "no screenshot captured".
const TOUR_NOTES = {
  'cash-sales-order': {
    displayTitle: 'CASH SALES ORDER',
    adapted: new Set(),
    excluded: new Set(),
  },
  'credit-sales-order-serial': {
    displayTitle: 'CREDIT SALES ORDER - SERIAL',
    adapted: new Set([200, 282, 300, 301, 302, 303, 304, 305, 314]),
    excluded: new Set(),
  },
  'credit-sales-order': {
    displayTitle: 'CREDIT SALES ORDER',
    adapted: new Set([10, 50, 60, 70, 90, 140, 150, 160, 170, 180, 190, 200, 210, 220, 290, 300, 330, 340, 350, 410]),
    // 80 = Credit selected twice. 380-520 = Register Payment (journal 'Commercial - Cash Receipts' replaces the tour's
    // non-existent 'Customer Receipts - Cash'; amount left as pre-filled). 420-480 do not exist in the export.
    excluded: new Set([80]),
    // Fields Odoo fills in by itself: the user only has to CHECK them (highlighted in the manual).
    autoFill: new Set([140, 150, 160, 170, 180, 190, 200, 210]),
  },
  'overdue-credit-sales-order': {
    displayTitle: 'OVERDUE CREDIT SALES ORDER',
    adapted: new Set([10, 50, 60, 70, 90, 140, 150, 160, 170, 180, 190, 200, 210, 220, 224, 226, 290, 300, 330, 340, 350, 410]),
    // 380-520 = Register Payment (journal 'Commercial - Cash Receipts' replaces the tour's non-existent 'Customer Receipts - Cash';
    // amount left as pre-filled). 224/226 = Request Overdue Approval / Approve Overdue, done with the admin user.
    excluded: new Set(),
    // Fields Odoo fills in by itself: the user only has to CHECK them (highlighted in the manual).
    autoFill: new Set([140, 150, 160, 170, 180, 190, 200, 210]),
    // 224/226 only appear while the customer really has an overdue invoice. When the screenshots were taken, Odoo showed
    // Confirm straight away for this customer, so these two steps have no screenshot (the replay handles both cases).
    infoBoxes: {
      224: ['No screenshot for this step', 'The Request Overdue Approval button is shown only while the customer still has an unpaid invoice that is past its due date. It takes the place of the Confirm button, in the same position at the top left of the order. When the pictures for this guide were taken, the customer had no overdue invoice at that moment, so Odoo showed Confirm straight away (see the next steps). If you see **Request Overdue Approval**, click it and then wait for the approver.'],
      226: ['No screenshot for this step', 'The Approve Overdue button is shown to the authorised person only after an approval was requested. When it is clicked, Odoo replaces it by the **Confirm** button. If the customer is not overdue, this step does not exist and you go directly to Confirm.'],
    },
  },
  'high-discount-sales-order': {
    displayTitle: 'HIGH DISCOUNT CASH SALES ORDER',
    adapted: new Set([60, 133, 134, 137, 140, 152, 153, 154]),
    // 154 = 'Commercial - Cash Receipts' replaces the tour's non-existent 'Customer Receipts - Cash' (amount left as pre-filled).
    // 142/143 = Request / Approve Over Commission, both done with the admin user (member of the Over Commission Approvers group).
    excluded: new Set(),
    // Fields Odoo fills in by itself: the user only has to CHECK them (highlighted in the manual).
    autoFill: new Set([135, 136, 137, 138, 139, 140]),
    overrides: {
          "10": {
                "title": "Open the Sales app",
                "content": "Click the **Sales** tile in the Home menu.",
                "description": "Why: All quotations and sales orders are created and followed up in the Sales app, so this is where every sale starts. What you will see: The Home menu shows all your apps as tiles. The Sales tile is highlighted in red. After you click it, the Sales app opens. Watch out: if you do not see the Sales tile, your user has no access to the Sales app. Ask your administrator."
          },
          "20": {
                "title": "Open the Orders menu",
                "content": "Click **Orders** in the top menu bar.",
                "description": "Why: The Orders menu groups everything about customer orders: quotations, sales orders and customers. What you will see: A short drop-down list opens under the word Orders."
          },
          "30": {
                "title": "Open Quotations",
                "content": "Click **Quotations**.",
                "description": "Why: A sale always begins as a quotation (a draft offer). It only becomes a real Sales Order after it is confirmed, and for a high discount that confirmation needs an approval first. What you will see: The list of existing quotations opens, with a New button at the top left."
          },
          "40": {
                "title": "Start a new quotation",
                "content": "Click the **New** button.",
                "description": "Why: This opens an empty quotation form for the new sale. What you will see: A blank quotation form with the next quotation number (it shows \"New\" until you save). The New button is highlighted in red."
          },
          "50": {
                "title": "Search for the customer",
                "content": "Click the **Customer** field and type **abc**.",
                "description": "Why: Every sale must belong to a customer. The customer decides the address, invoice address, price list and the default payment terms. What you will see: While you type, a drop-down list shows the customers whose name matches what you typed. Watch out: type only a part of the name. Several customers can look alike, so read the full name before you choose."
          },
          "60": {
                "title": "Select the customer",
                "content": "Click **abc** in the drop-down list.",
                "description": "Why: Choosing the customer from the list links the quotation to the correct customer record. What you will see: The customer name, its address, the invoice address and the delivery address are filled in automatically under the field. Watch out: check that the address shown is the right one for this sale."
          },
          "70": {
                "title": "Set the Order Payment Type to Cash",
                "content": "In **Order Payment Type**, choose **Cash**.",
                "description": "Why: This tour is for a CASH sale: the customer pays at once, so there is no credit period. Cash and Credit orders follow different rules, different payment terms and different approvals. What you will see: A small drop-down with the values Cash and Credit. After you choose, the field shows Cash. Watch out: do not choose Credit here. A credit order is paid later and would need different payment terms."
          },
          "80": {
                "title": "Set the Quotation Type to Sales",
                "content": "In **Quotation Type**, choose **Sales**.",
                "description": "Why: The quotation type tells the company what kind of sale this is (Sales, Project or Repair). A normal sale of stock items is \"Sales\". What you will see: The drop-down closes and shows Sales."
          },
          "90": {
                "title": "Add a product line",
                "content": "In the Order Lines tab, click **Add a product**.",
                "description": "Why: The lines of the order are the products the customer buys. Without a line there is nothing to deliver or invoice. What you will see: A new empty line appears in the table, with the cursor in the Product column."
          },
          "100": {
                "title": "Search for the product",
                "content": "Type the product code **02BB 023** in the Product column.",
                "description": "Why: Searching by the product code is the fastest and safest way to find the exact item. What you will see: A drop-down shows the products that match the code you typed."
          },
          "110": {
                "title": "Select the product",
                "content": "Click **[02BB 023] BALL BEARING 6202-2RS**.",
                "description": "Why: This puts the product on the line. Odoo then fills in the description, the unit of measure and the normal Unit Price automatically. What you will see: The line shows the product, its description, Quantity 1.0000, the unit (pcs) and the Unit Price (for example 280.00). Watch out: check the unit price. The discount you give in the next steps is taken from this price."
          },
          "120": {
                "title": "Check the quantity",
                "content": "The **Quantity** is already **1.0000**. Keep it, or change it to the quantity the customer wants.",
                "description": "Why: The quantity multiplied by the unit price gives the order amount. The discount is calculated on that amount. What you will see: The Quantity cell of the line is highlighted in red. Watch out: a quantity larger than the stock available can block the delivery later."
          },
          "130": {
                "title": "Type the high discount: 25 %",
                "content": "In the **Disc.%** column, type **25**.",
                "description": "Why: A discount is a reduction of the selling price, given as a percentage. A normal small discount can be given freely. A HIGH discount, such as 25 %, is a larger reduction that cuts into the company margin and into the sales commission. This is called an \"over commission\" case, so the company wants a responsible person to look at it and agree before the order is confirmed. What you will see: The Disc.% cell turns into an input box and the number 25 appears in it. The red frame shows where to type. Watch out: type the percentage only (25), not 0.25 and not the % sign. Giving a high discount without approval is not allowed: Odoo will ask for approval in a later step."
          },
          "131": {
                "title": "Press Enter to accept the discount",
                "content": "Press **Enter** on the keyboard.",
                "description": "Why: Enter confirms the number you typed and recalculates the line. What you will see: The line now shows Disc.% 25.00 and a lower Tax excl. amount (for example 210.00 Rs instead of 280.00 Rs). Odoo may open an empty second line under it: simply ignore it, it is not saved. Watch out: check that the Disc.% column really shows 25.00 before you go on."
          },
          "132": {
                "title": "Open the Other Info tab",
                "content": "Click the **Other Info** tab.",
                "description": "Why: The Other Info tab holds the sales team, the warehouse and the payment terms. They decide who gets the sale, from where the goods leave and when the customer must pay. What you will see: The tab opens under the form with the Sales, Delivery and Invoicing sections."
          },
          "133": {
                "title": "Open the Payment Terms list",
                "content": "Click the **Payment Terms** field.",
                "description": "Why: The payment terms say when the customer has to pay. For a Cash order, the customer pays immediately. What you will see: The field is highlighted and a drop-down list of terms opens (Immediate Payment, TC 50%, 01 Day, 07 Days, 14 Days and so on). On this customer Odoo may already propose Immediate Payment, but the recorded tour started from a credit term (90 Days), so always look at the value. Watch out: a CASH order must never keep a credit term like 90 Days. Change it in the next step."
          },
          "134": {
                "title": "Choose Immediate Payment",
                "content": "Click **Immediate Payment**.",
                "description": "Why: Because this is a cash order, the money is due right away. \"Immediate Payment\" means the invoice is due on the day it is issued. What you will see: The Payment Terms field shows Immediate Payment. Watch out: if this field still shows a credit term, the invoice will show a due date in the future and the customer will not look overdue when he really owes money."
          },
          "135": {
                "title": "Check the Sales Team",
                "content": "Look at the **Sales Team** field.",
                "description": "Why: The sales team (sales centre) decides to which branch the sale and its commission belong. What you will see: Odoo normally fills the team in by itself from the user or the customer (the screenshot shows JAM Factory - EKALA). A drop-down list is opened so that you can see the alternatives. Watch out: AUTO-FILLED: check that the team is the one you really sell for. Change it only when it is wrong."
          },
          "136": {
                "title": "Click Search More",
                "content": "Click **Search More...** at the bottom of the list.",
                "description": "Why: The short drop-down shows only a few teams. Search More opens the complete list. What you will see: A pop-up window with all sales teams opens."
          },
          "137": {
                "title": "Select Colombo Sales Centre",
                "content": "Click **Colombo Sales Centre** in the pop-up list.",
                "description": "Why: This chooses the sales centre for the order. What you will see: The pop-up closes and the Sales Team field shows Colombo Sales Centre. Watch out: AUTO-FILLED: always check that the correct sales centre is shown."
          },
          "138": {
                "title": "Check the Warehouse",
                "content": "Look at the **Warehouse** field.",
                "description": "Why: The warehouse is the place from which the goods are delivered. The delivery order and the stock movement are created for this warehouse. What you will see: Odoo fills in a warehouse by itself. A drop-down list is opened to show the alternatives. Watch out: AUTO-FILLED: check that the warehouse really has the product in stock. Change it only when wrong."
          },
          "139": {
                "title": "Click Search More",
                "content": "Click **Search More...** at the bottom of the list.",
                "description": "Why: To see all warehouses, not only the first few. What you will see: A pop-up window with the warehouses opens."
          },
          "140": {
                "title": "Select JAM Warehouse Ekala",
                "content": "Click **JAM Warehouse Ekala (JM-EK)**.",
                "description": "Why: This chooses the warehouse from where the goods will be delivered. What you will see: The pop-up closes and the Warehouse field shows JAM Warehouse Ekala. Watch out: AUTO-FILLED: check the warehouse before you save."
          },
          "141": {
                "title": "Save the quotation",
                "content": "Click the **Save** icon (cloud with an arrow) at the top left of the form.",
                "description": "Why: Until you save, the quotation does not exist. Saving gives it its number and lets Odoo check the discount against the company rules. What you will see: The title changes from \"New\" to the quotation number (for example S00206). Because the discount is higher than the normal limit, the first button at the top changes from Confirm to **Request Over Commission Approval**. Watch out: if you do not save, the approval buttons will not appear."
          },
          "142": {
                "title": "Click Request Over Commission Approval",
                "content": "Click **Request Over Commission Approval** at the top left of the quotation.",
                "description": "Why: A discount of 25 % is a high discount, so the normal Confirm button is replaced by this one. \"Over commission\" means the discount is bigger than the sales person may give alone. By clicking the button you ask the authorised approver (a manager) to check the discount and agree to it. Odoo records the request and sends an activity (a to-do notice) to the approver. What you will see: The button is highlighted in red. After you click it, the page reloads and the button is replaced by **Approve Over Commission**, which waits for the approver. The request is also written in the chatter (message history) of the order. Watch out: the order cannot be confirmed, delivered or invoiced until the approval is given. Do not give the customer the goods before this."
          },
          "143": {
                "title": "Click Approve Over Commission",
                "content": "The authorised approver clicks **Approve Over Commission**.",
                "description": "Why: This is the approval itself. Only a person in the \"Over Commission Approvers\" group may click it. It tells Odoo that a responsible person has checked the 25 % discount and accepts it. Here the same user who asked is allowed to approve because that user also belongs to the Over Commission Approvers group, even though the approval notice may name another manager. What you will see: The button is highlighted in red. After you click it, the page reloads and the usual **Confirm** button appears again at the top left. Watch out: if you are NOT an approver, the button is greyed out or does nothing. Then ask the manager named in the approval activity to open the quotation and click it."
          },
          "144": {
                "title": "Confirm the order",
                "content": "Click **Confirm**.",
                "description": "Why: Confirming turns the quotation into a real Sales Order. From now on the price, the discount and the quantity are fixed, and Odoo prepares the delivery. What you will see: The status bar moves from Quotation to **Sales Order**. A Delivery smart button appears at the top right of the order. Watch out: a confirmed order cannot simply be changed any more. Check the discount before you click."
          },
          "146": {
                "title": "Open the Delivery",
                "content": "Click the **Delivery** smart button.",
                "description": "Why: A confirmed order creates a delivery order. This is the document the warehouse uses to send the goods to the customer. What you will see: The delivery order opens, with the product and the quantity to deliver. Watch out: if the product is not available, the delivery stays \"Waiting\". Press Check Availability or wait for stock."
          },
          "147": {
                "title": "Validate the delivery",
                "content": "Click **Validate**.",
                "description": "Why: Validate means the goods have really left the warehouse. Stock is reduced and the order is now ready to be invoiced. What you will see: The status of the delivery changes to **Done**. If Odoo shows a pop-up window, confirm it. Watch out: validate only when the goods have really been handed over."
          },
          "148": {
                "title": "Go back to the sales order",
                "content": "Click the order number (breadcrumb) or press the back shortcut.",
                "description": "Why: After the delivery is done you return to the sales order to create the invoice. What you will see: The sales order is shown again, now with a **Create Invoice** button."
          },
          "149": {
                "title": "Create the invoice",
                "content": "Click **Create Invoice**.",
                "description": "Why: The invoice is the legal bill that asks the customer to pay. It is created from the delivered quantities of the order, so the discount you gave is on it.\n\nDocument explanation: the created invoice (a draft customer invoice) lists the product, the quantity, the unit price, the 25 % discount and the total to pay. What you will see: A small window asks for the invoice type (Regular invoice). Create it. The new invoice opens in Draft status. Watch out: a draft invoice is not final. Check the discount and the total before you confirm it."
          },
          "150": {
                "title": "Confirm the invoice",
                "content": "Click **Confirm** on the invoice.",
                "description": "Why: Confirming posts the invoice: it gets its number and is recorded in the accounts and in the customer balance. What you will see: The status changes from Draft to **Posted**. A **Register Payment** button appears at the top left. Watch out: a posted invoice can no longer be edited. If something is wrong, a credit note is needed."
          },
          "151": {
                "title": "Click Register Payment",
                "content": "Click **Register Payment**.",
                "description": "Why: This records the money received from the customer against the invoice.\n\nDocument explanation: the payment is the receipt document. It states the journal (cash or bank), the amount and the date, and closes the invoice when the full amount is paid. What you will see: A pop-up window opens with the Journal, the Amount (already the full invoice total), the Payment Date and the Memo."
          },
          "152": {
                "title": "Open the Journal list",
                "content": "Click the **Journal** field and clear it.",
                "description": "Why: The journal tells where the money went, for example the cash drawer or a bank. For a cash sale we use a cash receipts journal. What you will see: A drop-down list of journals opens."
          },
          "153": {
                "title": "Click Search More",
                "content": "Click **Search More...**.",
                "description": "Why: To see every journal in one list. What you will see: A pop-up with all journals opens."
          },
          "154": {
                "title": "Select the cash receipts journal",
                "content": "Click **Commercial - Cash Receipts**.",
                "description": "Why: The recorded tour used a journal called \"Customer Receipts - Cash\", which does not exist on this system. **Commercial - Cash Receipts** is the matching cash journal. What you will see: The pop-up closes and the Journal field shows Commercial - Cash Receipts. The Amount stays as Odoo filled it in. Watch out: ADAPTED: check with Accounts that this is the correct cash journal for your branch. The amount is pre-filled with the invoice total: do not change it for a full payment."
          },
          "155": {
                "title": "Create the payment",
                "content": "Click **Create Payment**.",
                "description": "Why: This books the payment. What you will see: The window closes and the invoice shows a green **Paid** (or **In Payment**) ribbon. The customer owes nothing for this sale. Watch out: if Odoo shows an error about an \"outstanding receipts account\", the journal is not set up. Ask Accounts."
          },
          "156": {
                "title": "Trace the invoice back to the order: Sales Orders button",
                "content": "Click the **Sales Orders** smart button on the invoice.",
                "description": "Why: A smart button is a shortcut. This one takes you from the invoice to the sales order it came from, so you can prove that the discount, the approval, the delivery and the payment belong together. What you will see: The Sales Orders smart button (it shows the number of linked orders, here 1) is highlighted. The invoice itself shows the green ribbon In Payment / Paid. After the click, the sales order with the same order number opens."
          },
          "157": {
                "title": "Open the Invoices smart button",
                "content": "Click the **Invoices** smart button on the sales order.",
                "description": "Why: It lists the invoice created for the order, so you can go back to it at any time. What you will see: The invoice opens again with the green ribbon In Payment / Paid. Watch out: this is the end of the tour. The order is confirmed, delivered, invoiced and paid."
          }
    },
  },
  'cash-sales-order-serial': {
    // Steps whose recorded text does not match what they act on - flagged for review in REVIEW.md
    displayTitle: 'CASH SALES ORDER - SERIAL',
    adapted: new Set([200, 210, 220, 282, 291, 312, 318, 319, 320]),
    excluded: new Set(),
  },
  'return-cash-sales-order': {
    displayTitle: 'RETURN CASH SALES ORDER',
    adapted: new Set([10, 50, 60, 70, 80, 100, 110, 140, 150, 160, 170, 180, 190, 200, 210, 280, 290, 300, 310, 320, 360, 380, 430, 460]),
    // 420-470 = advance payment: Create Advance Payment -> open the draft payment -> check the prefilled amount ->
    // Confirm -> Posted -> back to the order. The recorded typing of an amount (440/450/460) is replaced by highlighting
    // the prefilled amount. The Payments smart button (481) is not clicked: it can stay hidden on this instance.
    excluded: new Set(),
    // Fields Odoo fills in by itself: the user only has to CHECK them (highlighted in the manual).
    autoFill: new Set([140, 150, 160, 170, 180, 190, 200, 210]),
  },
  'return-reinvoice-cash-sales-order': {
    displayTitle: 'RETURN & CREATE INVOICE - CASH SALES ORDER',
    adapted: new Set([10, 50, 60, 70, 80, 100, 110, 140, 150, 160, 170, 180, 190, 200, 210, 280, 290, 300, 340, 360, 460]),
    // 370-440 = Register Payment with the cash journal: this instance has no outstanding receipts account on the
    // cash journal, so Odoo refuses the payment. Left out of the manual until it is configured.
    excluded: new Set([370, 380, 390, 400, 410, 420, 430, 440]),
    // Fields Odoo fills in by itself: the user only has to CHECK them (highlighted in the manual).
    autoFill: new Set([140, 150, 160, 170, 180, 190, 200, 210]),
  },
  sales: {
    adapted: new Set([10, 50, 60, 70, 80, 83, 84, 97]),
    excluded: new Set(),
  },
  'create-a-cash-customer': {
    adapted: new Set([10, 20, 30, 90, 110, 180, 190, 200]),
    excluded: new Set([140, 150, 160, 224]),
    // The recorded title/content for 10/20/30 describe a menu path that no longer exists
    // ("Click Sales Module" → "Orders" → "Customers") — the screenshots now show what the
    // replay actually does instead (open the Home menu, click Contacts, land in Contacts),
    // so the caption needs to say that too or image and text contradict each other.
    overrides: {
      10: { title: 'Open the Home menu', content: 'Click the Home menu (app switcher) icon to open the app grid.' },
      20: { title: 'Click Contacts', content: 'Click the "Contacts" app tile — replaces the recorded Sales → Orders → Customers path, which no longer exists in this instance (see REVIEW.md).' },
      30: { title: 'Contacts app loaded', content: 'The Contacts app list view is ready.' },
    },
  },
};
const DISPLAY_TITLE = (TOUR_NOTES[tourName] || {}).displayTitle || null;
const { adapted: ADAPTED_SEQUENCES, excluded: EXCLUDED_SEQUENCES, overrides: OVERRIDES = {}, autoFill: AUTOFILL_SEQUENCES = new Set(), intro: INTRO = null, infoBoxes: INFO_BOXES = {} } =
  TOUR_NOTES[tourName] || { adapted: new Set(), excluded: new Set() };

const AUTOFILL_NOTE = 'Odoo normally fills in this field by itself. Do not just click past it: look at the value and check that it is correct for this customer, sales centre and warehouse. Only change it, as shown in the screenshot, if the value is wrong.';

function screenshotFor(sequence) {
  const file = path.join(screenshotDir, `step-${String(sequence).padStart(3, '0')}.png`);
  return fs.existsSync(file) ? file : null;
}

function buildLocale(locale, localeLabel) {
  const steps = tour.steps
    .filter((s) => !EXCLUDED_SEQUENCES.has(s.sequence))
    .map((s) => {
      const override = OVERRIDES[s.sequence];
      return {
        sequence: s.sequence,
        title: override?.title ?? (s.title_i18n?.[locale] || s.title || ''),
        content: override?.content ?? (s.content_i18n?.[locale] || s.content || ''),
        description: override ? (override.description ?? '') : (s.description_i18n?.[locale] || s.description || ''),
        screenshot: screenshotFor(s.sequence),
        adapted: ADAPTED_SEQUENCES.has(s.sequence),
        autofill: AUTOFILL_SEQUENCES.has(s.sequence),
        info: INFO_BOXES[s.sequence] || null,
      };
    });

  // ---- Markdown ----
  let md = `# ${DISPLAY_TITLE || tour.name} — User Manual (${localeLabel})\n\n`;
  md += `${tour.description_i18n?.[locale] || tour.description}\n\n`;
  md += fs.existsSync(screenshotDir)
    ? `Generated from an Odoo Tour Recorder export, replayed with Playwright, and screenshotted at every step.\n\n`
    : `Generated from an Odoo Tour Recorder export (no screenshots for this manual).\n\n`;
  if (EXCLUDED_SEQUENCES.size > 0) {
    md += `> ${EXCLUDED_SEQUENCES.size} recorded step(s) were excluded from the replay (fields/menus that no longer exist, or accidental trailing steps) — see REVIEW.md.\n\n`;
  }
  if (INTRO) {
    md += `## Documents in this guide\n\n| Document | What it is |\n|---|---|\n`;
    INTRO.forEach(([a, b]) => { md += `| ${a} | ${b} |\n`; });
    md += `\n`;
  }
  md += `---\n\n`;
  steps.forEach((s, i) => {
    const heading = s.title || s.content || `Step ${i + 1}`;
    md += `## ${i + 1}. ${heading}\n\n`;
    if (s.content) md += `${s.content}\n\n`;
    if (s.description && s.description !== s.content) md += `_${s.description}_\n\n`;
    if (s.info) md += `> **ℹ ${s.info[0].toUpperCase()}:** ${s.info[1]}

`;
    if (s.autofill) md += `> **⚠ AUTO-FILLED — PLEASE CHECK:** ${AUTOFILL_NOTE}

`;
    if (s.adapted) md += `> **Note:** this step was adapted from the recorded tour — see REVIEW.md.\n\n`;
    if (s.screenshot) {
      const relPath = path.relative(manualDir, s.screenshot).replace(/\\/g, '/');
      md += `![Step ${i + 1}](${relPath})\n\n`;
    }
    md += `---\n\n`;
  });
  fs.writeFileSync(path.join(manualDir, `${tourName}.${locale}.md`), md, 'utf-8');

  // ---- Self-contained HTML (screenshots embedded as base64) ----
  const stepsHtml = steps
    .map((s, i) => {
      const heading = esc(s.title || s.content || `Step ${i + 1}`);
      const img = s.screenshot
        ? `<img src="data:image/png;base64,${fs.readFileSync(s.screenshot).toString('base64')}" alt="Step ${i + 1} screenshot">`
        : (fs.existsSync(screenshotDir) && !s.info ? '<p class="missing">(no screenshot captured for this step)</p>' : '');
      return `
      <section class="step">
        <h2><span class="step-num">${i + 1}</span>${heading}${s.autofill ? '<span class="autobadge">AUTO-FILLED · CHECK</span>' : ''}</h2>
        ${s.content ? `<p class="content">${esc(s.content).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>` : ''}
        ${s.description && s.description !== s.content ? `<p class="desc">${esc(s.description).replace(/\n/g, '<br>').replace(/(What you will see:|Watch out:)/g, '<br><br>$1').replace(/(Why:|What you will see:|Check:|Watch out:|Tip:|Result:)/g, '<b>$1</b>')}</p>` : ''}
        ${s.info ? `<div class="infobox"><strong>ℹ ${esc(s.info[0])}</strong><br>${esc(s.info[1]).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>` : ''}
        ${s.autofill ? `<div class="autofill"><strong>⚠ AUTO-FILLED — PLEASE CHECK</strong><br>${esc(AUTOFILL_NOTE)}</div>` : ''}
        ${s.adapted ? '<p class="adapted">⚠ Adapted from the recorded tour — see REVIEW.md for details.</p>' : ''}
        ${img}
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="${locale.split('_')[0]}">
<head>
<meta charset="utf-8">
<title>${esc(DISPLAY_TITLE || tour.name)} — User Manual</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f6f7f9; color: #1a1a1a; margin: 0; padding: 0 0 4rem; font-size: 20px; line-height: 1.6; }
  header { background: #714B67; color: #fff; padding: 3rem 2rem; }
  header h1 { margin: 0 0 .75rem; font-size: 2.6rem; font-weight: 800; }
  header p { margin: 0; opacity: .95; font-size: 1.2rem; }
  .topic { background: #fff176; color: #000; padding: .05em .35em; border-radius: 8px; letter-spacing: .02em; }
  main { max-width: 1000px; margin: 0 auto; padding: 2rem; }
  .step { background: #fff; border: 1px solid #e3e3e3; border-left: 8px solid #714B67; border-radius: 12px; padding: 2rem; margin-bottom: 2.5rem; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
  .step h2 { margin: 0 0 1.25rem; font-size: 1.9rem; line-height: 1.3; font-weight: 800; color: #4a2c42; display: flex; align-items: flex-start; gap: .9rem; }
  .step-num { background: #714B67; color: #fff; border-radius: 50%; min-width: 52px; height: 52px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; flex-shrink: 0; }
  .content { color: #111; margin: 0 0 1rem; font-size: 1.4rem; font-weight: 500; }
  .content strong { background: #fff176; color: #000; font-weight: 800; padding: 0 .3em; border-radius: 4px; }
  .desc { color: #1b4d2b; background: #e8f5e9; border-left: 6px solid #43a047; border-radius: 6px; padding: .9rem 1.1rem; font-size: 1.15rem; margin: 0 0 1.25rem; }
  .desc b { color: #0b5d1e; font-weight: 800; }
  .adapted { color: #8a5a00; background: #fff6e5; border: 1px solid #ffe2a8; border-radius: 6px; padding: .6rem .9rem; font-size: 1rem; margin: 0 0 .75rem; }
  .autofill { background: #fff3cd; border: 3px solid #f59e0b; border-radius: 8px; padding: 1rem 1.2rem; font-size: 1.2rem; margin: 0 0 1.25rem; color: #5c3b00; }
  .autofill strong { font-size: 1.3rem; color: #b45309; }
  .autobadge { background: #f59e0b; color: #fff; border-radius: 999px; font-size: .8rem; padding: .25rem .7rem; margin-left: .6rem; white-space: nowrap; align-self: center; }
  .step:has(.autofill) { border-left-color: #f59e0b; }
  .infobox { background: #e3f2fd; border: 3px solid #1e88e5; border-radius: 8px; padding: 1rem 1.2rem; font-size: 1.2rem; margin: 0 0 1.25rem; color: #0d3c6e; }
  .infobox strong { font-size: 1.3rem; color: #0b5cad; }
  .guide { background: #fff; border: 1px solid #e3e3e3; border-left: 8px solid #1e88e5; border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 2.5rem; box-shadow: 0 2px 6px rgba(0,0,0,.08); }
  .guide h2 { margin: 0 0 1rem; font-size: 1.7rem; color: #0b5cad; }
  .guide table { border-collapse: collapse; width: 100%; font-size: 1.15rem; }
  .guide th { text-align: left; vertical-align: top; width: 28%; padding: .7rem 1rem .7rem 0; color: #4a2c42; }
  .guide td { padding: .7rem 0; border-bottom: 1px solid #eee; }
  .guide tr { border-bottom: 1px solid #eee; }
  .missing { color: #999; font-style: italic; }
  img { max-width: 100%; border: 2px solid #ccc; border-radius: 8px; display: block; }
  footer { max-width: 1000px; margin: 0 auto; padding: 0 2rem; color: #888; font-size: 1rem; }
</style>
</head>
<body>
<header>
  <h1>${DISPLAY_TITLE ? `<span class="topic">${esc(DISPLAY_TITLE)}</span>` : esc(tour.name)}</h1>
  <p>${esc(tour.description_i18n?.[locale] || tour.description)}</p>
  ${EXCLUDED_SEQUENCES.size > 0 ? `<p style="opacity:.8;font-size:.9rem;margin-top:.5rem;">${EXCLUDED_SEQUENCES.size} recorded step(s) excluded from the replay — see REVIEW.md.</p>` : ''}
</header>
<main>
${INTRO ? `<section class="guide"><h2>Documents in this guide</h2><table>${INTRO.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</td></tr>`).join('')}</table></section>` : ''}
${stepsHtml}
</main>
<footer>Generated from an Odoo Tour Recorder export (${esc(path.basename(tourJsonPath))})${fs.existsSync(screenshotDir) ? ', replayed and screenshotted with Playwright' : ''}.</footer>
</body>
</html>`;
  fs.writeFileSync(path.join(manualDir, `${tourName}.${locale}.html`), html, 'utf-8');

  return steps.length;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const stepCount = buildLocale('en_US', 'English');
console.log(`Built manual for "${tour.name}" — ${stepCount} steps — en_US only (si_LK/ta_IN were untranslated copies of English, see REVIEW.md)`);
