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
  'profit-margin-sales-order': {
    displayTitle: 'PROFIT MARGIN CONTROL CASH SALES ORDER',
    // 100/110/120 = product TESTMARGIN1 sold at 1000 (cost 1,200) replaces the tour's JMC6: on this database JMC6 has cost 0, so it never
    // triggers the margin gate. Selling below cost is what makes Odoo ask for approval.
    // 251 = 'Commercial - Cash Receipts' replaces the tour's non-existent 'Customer Receipts - Cash' (amount left as pre-filled).
    // 230 = the details button opens an Odoo "Invalid Operation" dialog whose text IS the details; it is shown, then closed (not a failure).
    adapted: new Set([100, 110, 120, 251]),
    excluded: new Set(),
    autoFill: new Set([160, 170, 180, 190, 200, 210]),
    infoBoxes: {
      241: ['About the button spelling', 'The button is spelled **Request Insufficient Marginn Approval** (two letters n at the end of Marginn). That is exactly how it is configured in Odoo, so do not look for another button. The text will be corrected when the Odoo configuration is corrected.'],
    },
    overrides: {
      "10": { title: "Open the Sales app from the home screen", content: "After you log in to Odoo you land on the home screen, which shows a grid of app icons. Find the **Sales** icon and click it once. The Sales app opens and its menu bar appears across the top of the page.",
        description: "Why: Odoo is split into small programs called apps. Everything about selling (quotations, orders, invoices) lives in the Sales app, so every sale starts here. What you will see: The Home screen shows all the apps you may use as coloured tiles. The Sales tile is marked with a red frame. When you click it, the Sales app opens. Watch out: if you cannot find a Sales tile, your user has not been given access to Sales. Please ask your system administrator to add it." },
      "20": { title: "Click Orders in the top menu", content: "Look at the menu bar at the top of the screen and click **Orders**. A small dropdown list opens just below it.",
        description: "Why: The menu bar at the top is like the table of contents of the app. The word Orders groups everything about customer orders. What you will see: A short list opens just under the word Orders. You do not have to do anything else in this list yet. The next step tells you which line to click." },
      "30": { title: "Click Quotations to open the quotation list", content: "In the dropdown click **Quotations**. A list opens showing every quotation that already exists, with the customer, the date and the status of each one.",
        description: "Why: A quotation is a price offer that you prepare for the customer. It is only a draft: nothing is delivered or invoiced yet. It becomes a real Sales Order only after it is confirmed. In this guide, the profit margin decides whether the order may be confirmed. What you will see: A list of all quotations opens. At the top left there is a purple New button. Watch out: you may see many quotations in the list. Do not open one of them. You are going to create a new one." },
      "40": { title: "Click New to start a blank quotation", content: "At the top left of the list click the purple **New** button. A blank quotation form opens. Its title shows \"New\" until you save it.",
        description: "Why: This gives you a blank quotation form to type the new sale into. What you will see: An empty form opens. Instead of a number it shows the word New. The number is given automatically when you save in a later step. The New button is marked with a red frame." },
      "50": { title: "Click the Customer field and type the customer name", content: "Click the **Customer** field and start typing **abc**. Odoo shows a dropdown with the customers whose names match what you typed.",
        description: "Why: Every sale belongs to a customer. The customer you pick fills in the delivery address, the invoice address and many default settings for you. What you will see: As soon as you type, a small list appears under the field and shows the customers whose names contain the letters you typed. Watch out: you only need to type the first letters of the customer name. Read the full name in the list before you choose it, because some customers have very similar names." },
      "60": { title: "Select the customer from the dropdown", content: "Click **abc** in the dropdown. The Customer, Invoice Address and Delivery Address fields fill in by themselves.",
        description: "Why: Clicking the name in the list links the quotation to that exact customer. What you will see: The customer name appears in the field. Under it, Odoo fills in the customer's address, and the Invoice Address and Delivery Address fields below are filled in as well. You do not need to type any of this. Watch out: take a moment to check that the address shown is the right one for this sale. A wrong address would send the goods or the bill to the wrong place." },
      "70": { title: "Choose Cash as the order payment type", content: "Open the **Order Payment Type** field and choose **Cash**. The field now shows the word Cash.",
        description: "Why: This field tells Odoo how the customer will pay. This guide is about a CASH sale, which means the customer pays straight away and gets no credit time. A Credit sale follows other rules and other approvals. What you will see: A small list with two choices opens: Cash and Credit. After you click Cash, the field shows the word Cash. Watch out: do not choose Credit for this sale. If you do, the rest of the steps in this guide will not match what you see on your screen." },
      "80": { title: "Choose the quotation type", content: "Open the **Quotation Type** field and choose **Sales**. The field now shows the word Sales.",
        description: "Why: The company uses the quotation type to know what kind of sale this is: Sales (normal sale of goods), Project or Repair. The profit margin check works for normal Sales quotations, so we pick Sales. What you will see: The list closes and the field shows the word Sales. Watch out: a Project quotation is not checked for margin. If you choose Project by mistake, the approval buttons you will see later will not appear." },
      "90": { title: "Click Add a product to add an order line", content: "Below the order lines table click **Add a product**. A new empty line appears and the cursor moves into its Product cell.",
        description: "Why: The order lines are the things the customer is buying. Without a line there is nothing to deliver, nothing to invoice and no profit to calculate. What you will see: A new empty row is added to the table. The cursor is already in the first column, which is called Product, so you can start typing right away." },
      "100": { title: "Search for the product", content: "In the new line type the product code **TESTMARGIN1** into the Product cell. A dropdown of matching products appears.",
        description: "Why: Every product has a short code. Typing the code is the quickest and safest way to find exactly the item you want. What you will see: A list appears under the cell and shows the products that match the code you typed. Watch out: the original recording used a product called JMC6 (Multi Chopper 6Hp). For this guide a test product is used instead. It is sold for less than it costs on purpose, so that you can see what Odoo does when the profit is too low. With your real products, type their normal product code or name." },
      "110": { title: "Select the product", content: "Click **[TESTMARGIN1] [TEST] Margin Request Product** in the dropdown. The description, the unit of measure and the unit price fill in on the line. For this guide the Unit Price is **1,000**.",
        description: "Why: Choosing the product fills the row for you: the product name, the description, the unit (for example pcs) and, behind the scenes, what the product costs the company. Odoo will later compare this cost with your selling price to find out how much profit you make. What you will see: The row now shows the product. For this guide the Unit Price is then set to 1,000 while the product costs 1,200. In plain words, the company would lose 200 on every item sold. Watch out: with a normal product, keep the price Odoo suggests. If you lower the price too much, the order will need approval, which is exactly what this guide shows." },
      "120": { title: "Check the quantity and the unit price", content: "Look at the **Quantity** cell. It shows **1**, which is what we want, so leave it as it is. Next to it the **Unit Price** column shows 1,000.00.",
        description: "Why: Quantity and price together give the value of the order, and the profit margin is worked out from them. In simple words, the profit margin is the part of the selling price that is left as profit after the product cost is paid. The formula is: (selling price - cost) / selling price x 100. Our example: (1,000 - 1,200) / 1,000 x 100 = -20 %. A minus sign means a loss. What you will see: The Quantity cell is marked with a red frame and shows 1. The Unit Price column shows 1,000.00. Watch out: the company has a minimum margin it allows without approval (you will see the exact number in a later step). Any order below that minimum has to be approved first." },
      "130": { title: "Open the Other Info tab", content: "Under the order lines click the **Other Info** tab. It holds the sales team, the warehouse and the payment terms.",
        description: "Why: Under the order lines there are several tabs. The Other Info tab keeps the settings that are not about the products: when the customer must pay, which sales team the sale belongs to and from which warehouse the goods will leave. What you will see: The tab opens. You will see a Sales section (Sales Team, Warehouse) and an Invoicing section (Payment Terms). Watch out: if you do not see these fields, make sure you clicked the tab named Other Info and not another tab." },
      "140": { title: "Check the Payment Terms field", content: "In the Invoicing section click the **Payment Terms** field. A dropdown with all the payment terms opens.",
        description: "Why: Payment terms say when the customer has to pay. For a cash sale the money is due at once. What you will see: A list of payment terms opens (for example Immediate Payment, 30 Days, 90 Days). Watch out: a credit period such as 30 Days or 90 Days is wrong for a cash sale. Please look at the current value and change it if it is not Immediate Payment." },
      "150": { title: "Select Immediate Payment", content: "Click **Immediate Payment** in the dropdown. The field now shows the words Immediate Payment.",
        description: "Why: Immediate Payment means the invoice is due on the same day it is created. That fits a cash sale, where the customer pays when the sale is made. What you will see: The Payment Terms field now shows Immediate Payment. Watch out: if the field still shows another term, click it again and choose Immediate Payment before you continue." },
      "160": { title: "Check the Sales Team field", content: "In the Sales section click the **Sales Team** field. Odoo has usually filled in a team already, and a dropdown with the other teams opens.",
        description: "Why: The sales team (also called a sales centre) is the group or branch that gets the credit for the sale. It is also used in the sales reports. What you will see: Odoo usually fills in a team by itself, based on you or the customer. When you click the field, a small list shows the other teams you could choose. This is a CHECK step: you only need to look at what Odoo filled in. Watch out: change the team only if the one shown is wrong for this sale. If it is correct, you can skip to the next step that tells you to select it." },
      "170": { title: "Click Search More to see every sales team", content: "At the bottom of the dropdown click **Search More...**. A window opens that lists all the sales teams.",
        description: "Why: The small list shows only the first few teams. Search More opens the complete list, so you can find the team you want even if it is not in the short list. What you will see: A window titled Search: Sales Team opens on top of the quotation. It lists all the sales teams, one per row." },
      "180": { title: "Select the sales team", content: "In the window click **Colombo Sales Centre**. The window closes and the Sales Team field shows that name.",
        description: "Why: This tells Odoo which sales team owns this sale. What you will see: The window closes by itself and the Sales Team field shows Colombo Sales Centre. Watch out: use the sales team of your own branch. The team used here is only the example from the recording." },
      "190": { title: "Check the Warehouse field", content: "Click the **Warehouse** field. Odoo has usually filled one in already, and a dropdown with the other warehouses opens.",
        description: "Why: The warehouse is the store the goods will be taken from. The delivery order that Odoo creates later is made for this warehouse. What you will see: Odoo usually fills in a warehouse by itself. When you click the field, a small list shows the other warehouses. This is a CHECK step: you only look at what was filled in. Watch out: the warehouse must really hold the product. If it does not, the delivery cannot be completed later." },
      "200": { title: "Click Search More to see every warehouse", content: "At the bottom of the dropdown click **Search More...**. A window opens that lists all the warehouses.",
        description: "Why: The small list does not show every warehouse. Search More opens the complete list. What you will see: A window titled Search: Warehouse opens, with one warehouse per row." },
      "210": { title: "Select the warehouse", content: "In the window click **JAM Warehouse Ekala**. The window closes and the Warehouse field shows that name.",
        description: "Why: This sets the store the goods will leave from. What you will see: The window closes and the Warehouse field shows JAM Warehouse Ekala- (JM-EK). Watch out: choose the warehouse that really has the goods. The one shown here is only the example from the recording." },
      "220": { title: "Save the quotation and notice the new buttons", content: "At the top of the form click the small **Save** icon (a cloud with an arrow). The word New is replaced by the quotation number. Now look at the buttons at the top left: **Confirm** has disappeared, and **Request Insufficient Marginn Approval** and **Insufficient Margin Details** have appeared.",
        description: "Why: Nothing is stored until you save. Saving gives the quotation its number and, at the same time, lets Odoo calculate the profit margin of the order and compare it with the company minimum. What you will see: The word New at the top changes to a number such as S00286. Now look at the buttons at the top left. The usual purple Confirm button is GONE. Instead you see two new buttons: Request Insufficient Marginn Approval and Insufficient Margin Details. This is the profit margin control at work. Watch out: do not worry, nothing is broken. The order is simply waiting. Odoo hides Confirm until an authorised person agrees to sell at this low profit." },
      "230": { title: "Click Insufficient Margin Details to see why", content: "Click the grey **Insufficient Margin Details** button. A window titled Invalid Operation opens and lists the figures behind the low margin.",
        description: "Why: This button explains, in numbers, why the order cannot be confirmed. Reading it is the best way to understand the problem before you ask for approval. What you will see: A window titled Invalid Operation opens with the message: Insufficient margin. You need approval to proceed. Do not be alarmed by the title. This is not a mistake you made. It is just the way Odoo shows the explanation. The lines mean: Item Code is the product that has the problem. Base Price is the selling price before any discount (1000.0). Discounts is the discount you gave on the line (0.0 means none). Other Charges (Commission) is commission or extra cost taken out of the sale (0.0 means none). Cost is what the product costs the company (1200.0). Net Margin is the profit percentage that is left after all of that (-20.0, which is a loss). Min. Sales Margin % is the lowest profit percentage the company accepts without approval (22.9). Watch out: compare the two numbers at the bottom. Net Margin (-20.0) is lower than the minimum (22.9). That is the reason approval is needed. To avoid the approval you could raise the price or reduce the discount." },
      "240": { title: "Close the details window", content: "Read the figures, then click the **Close** button. You are back on the quotation, and nothing has been changed.",
        description: "Why: You have read the figures, so you can close the window. It only shows information. It has no button to go on, because the next action is to ask for approval from the quotation itself. What you will see: The window disappears and you are back on the quotation. It is still in the Quotation stage. Nothing has been changed or saved by reading the details." },
      "241": { title: "Click Request Insufficient Marginn Approval", content: "Click the purple **Request Insufficient Marginn Approval** button. The page refreshes and the button is replaced by the approval button.",
        description: "Why: Selling at a low profit is a business decision, so only a person with the right authority may allow it. This button sends your request to that authorised person (the approver). What you will see: The page refreshes. The Request button disappears and the Approve button, which belongs to the approver, takes its place. Watch out: the order still cannot be confirmed. Tell the approver that a request is waiting, so the order does not get stuck. Also note that the request button cannot be clicked twice." },
      "242": { title: "Approve the insufficient margin (authorised person)", content: "The authorised person opens the quotation and clicks **Approve Insufficient Margin**. The page refreshes and the purple **Confirm** button appears again at the top left.",
        description: "Why: This step is done by the approver, not by the salesperson. By clicking, the approver says: I have seen the figures and I accept to sell at this profit. In this guide the same administrator user is allowed to approve, so you can do it yourself. What you will see: The page refreshes and the purple Confirm button comes back at the top left, in the place where it was hidden. Watch out: if you are not an approver you will not see this button. In that case ask the approver to open the same quotation and click it for you." },
      "243": { title: "Click Confirm to make it a Sales Order", content: "Click **Confirm**. The stage bar at the top right moves from Quotation to **Sales Order**, and a **Delivery** button appears at the top of the form.",
        description: "Why: The approval is given, so the quotation can now become a real order. Confirming means: yes, we will sell this to the customer. What you will see: The bar at the top right moves from Quotation to Sales Order. A new Delivery button (a shortcut called a smart button) appears at the top of the form. Watch out: after confirmation you cannot freely change the price or the quantity. Please be sure the details are correct before you click." },
      "244": { title: "Click the Delivery button", content: "At the top of the order click the **Delivery** smart button. The delivery order opens and shows the product and the quantity to send.",
        description: "Why: When the order was confirmed, Odoo created a delivery order for the warehouse. This is the paper that tells the warehouse staff to send the goods. A smart button is a shortcut button at the top of a form that takes you to a related document. What you will see: The delivery order opens and shows the product and the quantity to send. If the stock needs to be reserved, Odoo checks the availability first." },
      "245": { title: "Click Validate to finish the delivery", content: "Click **Validate**. If Odoo asks you to confirm in a small window, accept it. The delivery status changes to **Done**.",
        description: "Why: Validate means: the goods have really left the warehouse. Odoo then reduces the stock and allows you to invoice the customer. What you will see: The delivery status changes to Done. Watch out: if Odoo asks you to confirm in a small window, accept it. If the product is not in stock, Validate will not work until the stock has arrived. Only validate when the goods have really been handed over." },
      "246": { title: "Go back to the sales order", content: "At the top left click the order number (for example **S00286**). The sales order opens again and its Delivery button shows 1.",
        description: "Why: The delivery is finished. The next job, invoicing, is started from the sales order, so we go back to it. What you will see: The sales order opens again. The Delivery button at the top now shows 1, and the Delivered column of the product line shows 1. This proves that the goods have been delivered." },
      "247": { title: "Create and confirm the invoice", content: "Click **Create Invoice**, choose the regular invoice in the small window and click **Create Invoice** again. The draft invoice opens. Click **Confirm** on it, and its status changes to **Posted**.",
        description: "Why: The invoice is the bill that asks the customer to pay. It is made from the order, so it has the same product, quantity and price. What you will see: A small window asks what kind of invoice you want. Choose the regular invoice and click Create Invoice. The new invoice opens with the status Draft. Click Confirm on the invoice. It then gets its official number (for example FTI/2026/00100) and its status becomes Posted. Watch out: a Draft invoice can still be changed, but a Posted invoice is final. Check the amount before you confirm it." },
      "248": { title: "Click Register Payment", content: "On the invoice click **Register Payment**. A window opens with the full invoice amount already filled in.",
        description: "Why: This is a cash sale, so the customer pays at once. Register Payment records that money against the invoice. What you will see: A window titled Register Payment opens. The Amount is already filled in with the full amount of the invoice. Watch out: check that the amount and the date are correct. For a full payment do not change the amount." },
      "249": { title: "Open the Journal field", content: "In the window click the **Journal** field. A short dropdown of journals opens.",
        description: "Why: A journal is like a cash book or a bank book. It says where the money went and in which account it is recorded. What you will see: A small list of journals opens." },
      "250": { title: "Click Search More to see every journal", content: "At the bottom of the dropdown click **Search More...**. A window opens that lists all the journals.",
        description: "Why: The small list does not show every journal, and the cash journal may be missing from it. What you will see: A window titled Search: Journal opens and lists all the journals." },
      "251": { title: "Select the cash receipts journal", content: "In the window click **Commercial - Cash Receipts**. The window closes and the Journal field shows that name.",
        description: "Why: Money received in cash must be recorded in a cash receipts journal. What you will see: The window closes and the Journal field shows the journal you chose. Watch out: the original recording used a journal named Customer Receipts - Cash. That journal does not exist in this company, so Commercial - Cash Receipts was used instead. In your own company, pick the cash receipts journal that your Accounts department tells you to use." },
      "252": { title: "Click Create Payment", content: "Click **Create Payment**. The window closes and a green **Paid** (or In Payment) ribbon appears on the invoice.",
        description: "Why: This finishes the payment and closes the invoice. What you will see: The window closes and a green ribbon saying Paid (or In Payment) appears on the invoice. It means the customer owes nothing for this sale. Watch out: if Odoo shows an error that mentions an outstanding receipts account, the journal is not fully set up. Please contact Accounts." },
      "253": { title: "Click the Sales Orders button to trace the invoice", content: "On the invoice click the **Sales Orders** smart button. The sales order that this invoice came from opens.",
        description: "Why: Every document in Odoo is linked to the others. This smart button takes you from the invoice back to the sales order it came from. It lets you prove that the approval, the delivery, the invoice and the payment all belong to the same sale. What you will see: The button is marked with a red frame and shows the number of linked orders (here 1). The invoice shows the green Paid or In Payment ribbon. After you click, the sales order with the same number opens." },
      "254": { title: "Click the Invoices button on the order", content: "On the sales order click the **Invoices** smart button. The invoice opens again with its green ribbon.",
        description: "Why: This does the trip in the other direction, from the order to its invoice. You can use it any time you need to find the bill for an order. What you will see: The invoice opens again with the green Paid or In Payment ribbon. Watch out: this is the end of the guide. The low-margin order was approved, confirmed, delivered, invoiced and paid, and you know how to find every document of the sale." }
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
