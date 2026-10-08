# Repair User Guide — Branch
## Type 2: Not Under Warranty (Without Serial No.) — Full Flow (Centre Repair)

> Source: Odoo Tour Recorder export
> `Tour/1C. Repair User Guide - Branch [ Not Under Warranty (Without Serial No ) - Full Flow ].json`

---

## 1. Overview

This manual explains how to register and complete a **branch (Centre Repair)** repair for an out-of-warranty product with **no serial number**, from the Helpdesk ticket through quotation, payments and dispatch.

### Ticket stages covered

`New` → `Diagnosis` → `Estimation Sent to Customer` → `Estimation Approval Received` → `Repair Started` → `Repair Completed` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service, Sales, Accounting and Inventory apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer, product and spare parts already exist in Odoo (Contacts and Product Master).
- The item has been physically brought to the branch by the customer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Not Under Warranty (Without Serial No.) |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Low Pressue |
| Job Location | Centre Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Product | [JMC6] Multi Chopper 6Hp (Tractor Type) |
| Diagnosis | Burnt Part / Base plate / Internal / Hi Voltage / Reject / 1-REP-REC |
| Spare part quoted | [02BB 023] BALL BEARING 6202-2RS (1,200.00) |
| Payments | 50% deposit, then balance — Commercial Bank journal |

### How to read each step

| Field | Meaning |
|---|---|
| **Navigation** | Where you are in Odoo. |
| **Action** | What to click, select, or type. |
| **Description** | Why the step is needed and what happens. |
| **Screenshot** | The screen right before the action, with the target element framed in red (see the `.html` manual for the embedded images). |

### Step summary

| Section | Steps | Purpose |
|---|---|---|
| A | 1–11 | Open Helpdesk, create the ticket, classify it (branch Centre Repair), and generate a temporary serial number. |
| B | 12–14 | Return the item into stock and validate the receipt. |
| C | 15–16 | Plan the intervention and create the Field Service task (no factory transfer for a Centre Repair). |
| D | 17–29 | Record the diagnosis, attach a photo and add the spare part to be quoted. |
| E | 30–37 | Send the quotation by email and confirm it once the customer accepts online. |
| F | 38–44 | Create and confirm the deposit invoice and register the 50% advance payment. |
| G | 45–52 | Validate the delivery transfers and mark the repair task as done. |
| H | 53–62 | Collect the remaining balance and dispatch the repaired item back to the customer. |

---

## Section A — Create the Repair Ticket (Steps 1–11)

### Step 1: Open the HelpDesk app

| | |
|---|---|
| **Navigation** | Odoo Home → Apps |
| **Action** | Click the **Helpdesk** app icon on the home screen. |
| **Description** | Opens the Helpdesk Overview dashboard, showing every support team you have access to. |

*Screenshot: Odoo Apps home screen — Helpdesk app icon* (`01-helpdesk-app.png`)


### Step 2: Open the repair tickets

| | |
|---|---|
| **Navigation** | Helpdesk → Overview → Customer Care - Repair |
| **Action** | On the **Customer Care - Repair** team card, click **Tickets**. |
| **Description** | Opens the list of repair tickets already created for the team. |

*Screenshot: Helpdesk Overview — Tickets button on the Customer Care - Repair team card* (`02-tickets-button.png`)


### Step 3: Create a new ticket

| | |
|---|---|
| **Navigation** | Helpdesk → Customer Care - Repair (Tickets) |
| **Action** | Click **New** at the top-left of the ticket list. |
| **Description** | Opens a blank Helpdesk ticket form for the repair item received from the customer. |

*Screenshot: All Tickets list — New button* (`03-new-button.png`)


### Step 4: Assign the ticket to yourself

| | |
|---|---|
| **Navigation** | New ticket form |
| **Action** | Click **Assign to Me** in the status bar. |
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01609`) — the ticket has no user-editable title. |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)


### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Not Under Warranty (Without Serial No.)**. |
| **Description** | Classifies items whose warranty has expired and that have no serial number. The field lists the repair types configured in Studio. |

*Screenshot: Ticket form — Type field* (`05-repair-type.png`)


### Step 6: Set the Return Receipt Location

| | |
|---|---|
| **Navigation** | Ticket form → Return Receipt Location field |
| **Action** | Click **Return Receipt Location** and select the branch receiving the item (e.g. `BR-AM/Stock`, Jinasena Ampara Branch). |
| **Description** | The location where the item is received for repair at the branch. |

*Screenshot: Ticket form — Return Receipt Location field* (`06-return-receipt.png`)


### Step 7: Select the Repair Reason

| | |
|---|---|
| **Navigation** | Ticket form → Repair Reason field |
| **Action** | Click **Repair Reason** and select the reported fault (e.g. `Low Pressue`). |
| **Description** | Choose the common error that best matches the customer's complaint. This is a tags field; at least one reason is required before the item can be returned. (The reason is spelled *Low Pressue* in the Odoo configuration.) |

*Screenshot: Ticket form — Repair Reason field* (`07-repair-reason.png`)


### Step 8: Select the Job Location

| | |
|---|---|
| **Navigation** | Ticket form → Job Location field |
| **Action** | In **Job Location**, select **Centre Repair**. |
| **Description** | Defines where the repair is performed. **Centre Repair** keeps the work at the branch's service centre, so the item does not travel to the factory (no Send to Factory / Send to Sales Centre steps). |

*Screenshot: Ticket form — Job Location field* (`08-job-location.png`)


### Step 9: Select the Customer

| | |
|---|---|
| **Navigation** | Ticket form → Customer field |
| **Action** | Click **Customer** and select `KURUNEGALA CASH CUSTOMER`. |
| **Description** | Email and Phone are filled automatically from the customer record. |

*Screenshot: Ticket form — Customer field* (`09-customer.png`)


### Step 10: Select the Product

| | |
|---|---|
| **Navigation** | Ticket form → Product field |
| **Action** | Click **Product** and select `[JMC6] Multi Chopper 6Hp (Tractor Type)`. |
| **Description** | The repair item from the Product Master. Once Customer, Product and Repair Reason are set, the **Create Serial No** button appears. |

*Screenshot: Ticket form — Product field* (`10-product.png`)


### Step 11: Create a temporary serial number

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Create Serial No**. |
| **Description** | This repair type has no manufacturer serial number, so the system generates a temporary one (equal to the ticket number). Save the ticket first if it has pending changes. |

*Screenshot: Ticket form — Create Serial No button* (`11-create-serial.png`)


## Section B — Receive the Item (Steps 12–14)

### Step 12: Return — receive the item

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Return**. |
| **Description** | Records the item being physically received from the customer by creating a Returned Picking (e.g. `BR-AM/RET/00766`) in the Ready state. |

*Screenshot: Ticket form — Return button* (`12-return.png`)


### Step 13: Validate the receipt

| | |
|---|---|
| **Navigation** | Returned Picking → status bar |
| **Action** | Click **Validate**. |
| **Description** | Confirms the item has arrived into the repair stock location. The ticket cannot move on until this picking is Done. |

*Screenshot: Returned Picking (Ready) — Validate button* (`13-validate-return.png`)


### Step 14: Close

| | |
|---|---|
| **Navigation** | Returned Picking (Done) |
| **Action** | Click **Close** to return to the ticket. |
| **Description** | The receipt is Done. Returning to the ticket, the **Plan Intervention** button is now available. |

*Screenshot: Returned Picking (Done) — Close* (`14-close.png`)


## Section C — Plan the Repair Task (Steps 15–16)

### Step 15: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Plan Intervention**. |
| **Description** | Assigns the work to a repair technician. Because the Job Location is *Centre Repair*, the ticket goes straight to planning at the branch — there is no Send to Factory / Received at Factory leg. |

*Screenshot: Ticket form — Plan Intervention button* (`15-plan-intervention.png`)


### Step 16: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the Field Service task and opens it, where the technician records the diagnosis, photo and parts. |

*Screenshot: Create a Field Service task dialog — Create & View Task button* (`16-create-view-task.png`)


## Section D — Diagnosis, Image and Parts (Steps 17–29)

### Step 17: Open the Repair Diagnosis tab

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis tab |
| **Action** | Click the **Repair Diagnosis** tab. |
| **Description** | The technician records what was found on the item. At least one diagnosis line is required. |

*Screenshot: Task form — Repair Diagnosis tab* (`17-diagnosis-tab.png`)


### Step 18: Add a diagnosis line

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis tab |
| **Action** | Click **Add a line**. |
| **Description** | Adds a new row to the diagnosis table (a short description is filled in first). |

*Screenshot: Repair Diagnosis tab — Add a line* (`18-add-line.png`)


### Step 19: Diagnosis Area

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Diagnosis Area** cell and select `Burnt Part`. |
| **Description** | The area of the machine where the problem lies. |

*Screenshot: Diagnosis line — Diagnosis Area cell* (`19-diagnosis-area.png`)


### Step 20: Diagnosis Code

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Diagnosis Code** cell and select `Base plate`. |
| **Description** | The specific part or code of the fault. |

*Screenshot: Diagnosis line — Diagnosis Code cell* (`20-diagnosis-code.png`)


### Step 21: Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Reason** cell and select `Internal`. |
| **Description** | The root-cause category. |

*Screenshot: Diagnosis line — Reason cell* (`21-diagnosis-reason.png`)


### Step 22: Sub Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Sub Reason** cell and select `Hi Voltage`. |
| **Description** | A finer breakdown of the root cause. |

*Screenshot: Diagnosis line — Sub Reason cell* (`22-diagnosis-sub-reason.png`)


### Step 23: Resolution

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Resolution** cell and select `Reject`. |
| **Description** | The resolution decided by the technician. |

*Screenshot: Diagnosis line — Resolution cell* (`23-diagnosis-resolution.png`)


### Step 24: Repair Stage

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Repair Stage** cell and select `1-REP-REC`. |
| **Description** | The repair stage the item is at. |

*Screenshot: Diagnosis line — Repair Stage cell* (`24-diagnosis-repair-stage.png`)


### Step 25: Open the Repair Image tab

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click the **Repair Image** tab. |
| **Description** | At least one photo of the item being repaired must be attached. (The Add Data notice is expected until a photo is uploaded.) |

*Screenshot: Task form — Repair Image tab* (`25-repair-image-tab.png`)


### Step 26: Take a Picture

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click **Take a Picture**, then select the image file and click **Open**. |
| **Description** | Attaches the photo of the item to the task. Once Diagnosis and Image are both set, the **Products** button appears. |

*Screenshot: Repair Image tab — Take a Picture (Repair Image 01)* (`26-take-picture.png`)


### Step 27: Products

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click **Products**. |
| **Description** | Opens the item master (product catalog) to pick the spare parts used for the repair. |

*Screenshot: Task form — Products button* (`27-products.png`)


### Step 28: Add the spare part

| | |
|---|---|
| **Navigation** | Product catalog |
| **Action** | Find the part (e.g. `[02BB 023] BALL BEARING 6202-2RS`) and click **Add**. |
| **Description** | Adds the part with quantity 1 to the task; it becomes a line on the repair quotation. Repeat for every item needed. |

*Screenshot: Product catalog — Add button* (`28-add-part.png`)


### Step 29: Close the catalog

| | |
|---|---|
| **Navigation** | Product catalog |
| **Action** | Click **Close** to return to the previous menu. |
| **Description** | Returns to the task/ticket. The quotation now exists. |

*Screenshot: Product catalog — Close* (`29-close-catalog.png`)


## Section E — Quotation and Customer Confirmation (Steps 30–37)

### Step 30: Tasks — go to the quotation

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click the **Tasks** button (it shows 1). |
| **Description** | Opens the repair task, which holds the link to the created quotation. |

*Screenshot: Ticket form — Tasks button* (`30-tasks-quotation.png`)


### Step 31: Sales Order

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the quotation created from the parts added to the task. |

*Screenshot: Task form — Sales Order button* (`31-sales-order.png`)


### Step 32: Send by Email

| | |
|---|---|
| **Navigation** | Sales Order (Quotation) |
| **Action** | Click **Send by Email**. |
| **Description** | The quotation must be approved by the customer. This prepares the email containing the online quotation link. |

*Screenshot: Quotation — Send by Email button* (`32-send-by-email.png`)


### Step 33: Send

| | |
|---|---|
| **Navigation** | Send email dialog |
| **Action** | Click **Send**. |
| **Description** | Sends the email and moves the quotation to *Quotation Sent*. |

*Screenshot: Send email dialog — Send button* (`33-send.png`)


### Step 34: Close

| | |
|---|---|
| **Navigation** | Sales Order (Quotation Sent) |
| **Action** | Click **Close**. |
| **Description** | Returns to the previous screen while waiting for the customer. |

*Screenshot: Quotation (Quotation Sent) — Close* (`34-close-quotation.png`)


### Step 35: Tasks — check the confirmation

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click the **Tasks** button. |
| **Description** | Go back to the task to see whether the customer has approved the quotation. |

*Screenshot: Ticket form — Tasks button* (`35-tasks-confirmation.png`)


### Step 36: Sales Order

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the quotation to confirm it. |

*Screenshot: Task form — Sales Order button* (`36-sales-order-confirmation.png`)


### Step 37: Confirm the order

| | |
|---|---|
| **Navigation** | Sales Order (Quotation Sent) / customer portal |
| **Action** | The customer opens **View Quotation** from the email and clicks **Accept & Sign**, then **Accept & Sign** again in the signature pop-up. |
| **Description** | The order moves to *Sales Order* once the customer accepts. On this instance the Confirm button itself is hidden in the back-office view, so the customer's online acceptance (the real-world path) confirms the order. |

*Screenshot: Quotation Sent — state before the customer accepts (the next three images show the customer's online portal: quotation, signature pop-up, and order confirmed)* (`37-confirm.png`, `37b-portal-quotation.png`, `37c-portal-signature.png`, `37d-portal-confirmed.png`)


## Section F — 50% Deposit (Steps 38–44)

### Step 38: Create Invoice

| | |
|---|---|
| **Navigation** | Sales Order (confirmed) |
| **Action** | Click **Create Invoice**. |
| **Description** | Company policy: a 50% deposit must be paid in advance before the repair proceeds. This creates the deposit invoice. |

*Screenshot: Sales Order — Create Invoice button* (`38-create-invoice.png`)


### Step 39: Confirm the invoice

| | |
|---|---|
| **Navigation** | Customer Invoice (Draft) |
| **Action** | Click **Confirm**. |
| **Description** | Posts the invoice so a payment can be registered against it. |

*Screenshot: Draft invoice — Confirm button* (`39-confirm-invoice.png`)


### Step 40: Register Payment

| | |
|---|---|
| **Navigation** | Customer Invoice (Posted) |
| **Action** | Click **Register Payment**. |
| **Description** | Opens the payment wizard for the invoice. |

*Screenshot: Posted invoice — Register Payment button* (`40-register-payment.png`)


### Step 41: Select the Journal

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click the **Journal** field. |
| **Description** | Choose how the money was received. |

*Screenshot: Register Payment dialog — Journal field* (`41-journal.png`)


### Step 42: Journal and Amount

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Select **Commercial Bank** and enter the deposit amount (50% of the invoice, e.g. `600` of `1,200`). |
| **Description** | The tour records the Amount being edited to 50%. The Payment Difference shows what remains for the balance. |

*Screenshot: Register Payment dialog — Journal set to Commercial Bank (the amount is then edited to 50%)* (`42-bank-amount.png`)


### Step 43: Create Payment

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click **Create Payment**. |
| **Description** | Creates the deposit payment. The invoice becomes *Partial*. |

*Screenshot: Register Payment dialog — Create Payment button* (`43-create-payment.png`)


### Step 44: Close

| | |
|---|---|
| **Navigation** | Customer Invoice (Partial) |
| **Action** | Click **Close**. |
| **Description** | Returns to the previous menu. The invoice shows the **Partial** ribbon. |

*Screenshot: Invoice after the deposit — Partial ribbon* (`44-close-invoice.png`)


## Section G — Delivery and Task Completion (Steps 45–52)

### Step 45: Tasks — back to the order

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | With the advance received, return to the sales order to complete the repair process. |

*Screenshot: Ticket form — Tasks button* (`45-tasks-delivery.png`)


### Step 46: Sales Order

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click **Sales Order**. |
| **Description** | Opens the confirmed order. |

*Screenshot: Task form — Sales Order button* (`46-sales-order-delivery.png`)


### Step 47: Delivery

| | |
|---|---|
| **Navigation** | Sales Order → button box |
| **Action** | Click the **Delivery** button. |
| **Description** | Opens the transfers generated by the order. The item used for the repair is consumed by the customer. On this route the order generates a chain of three transfers (e.g. `JM-EK/OUT`, `RP-JM/IN`, `RP-JM/OUT`), each ready only after the one before it. |

*Screenshot: Sales Order — Delivery button* (`47-delivery.png`)


### Step 48: Validate

| | |
|---|---|
| **Navigation** | Delivery transfer (Ready) |
| **Action** | Click **Validate** on each transfer in order. |
| **Description** | Completes the stock movement of the repair parts. Repeat for each transfer in the chain. |

*Screenshot: Delivery transfer (Ready) — Validate button* (`48-validate-delivery.png`)


### Step 49: Close

| | |
|---|---|
| **Navigation** | Delivery transfer (Done) |
| **Action** | Click **Close**. |
| **Description** | Returns to the previous menu once the transfers are Done. |

*Screenshot: Delivery transfer (Done)* (`49-close-delivery.png`)


### Step 50: Open the repair task

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks** to open the task created for the repair. |
| **Description** | Go to the task to complete it. |

*Screenshot: Ticket form — Tasks button* (`50-task.png`)


### Step 51: Mark as done

| | |
|---|---|
| **Navigation** | Task form → status bar |
| **Action** | Click **Mark as done**. |
| **Description** | Ends the repair task. |

*Screenshot: Task form — Mark as done button* (`51-mark-as-done.png`)


### Step 52: Close

| | |
|---|---|
| **Navigation** | Task form (Done) |
| **Action** | Click **Close**. |
| **Description** | Returns to the main menu (the ticket). |

*Screenshot: Task (Done) — Close* (`52-close-task.png`)


## Section H — Balance Payment and Dispatch (Steps 53–62)

### Step 53: Tasks — back to the invoice

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Go back to collect the remaining amount from the customer. |

*Screenshot: Ticket form — Tasks button* (`53-tasks-balance.png`)


### Step 54: Invoices

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Invoices** button (it shows 1). |
| **Description** | Opens the invoice so the balance payment can be registered. |

*Screenshot: Task form — Invoices button* (`54-invoices.png`)


### Step 55: Register Payment

| | |
|---|---|
| **Navigation** | Customer Invoice (Partial) |
| **Action** | Click **Register Payment**. |
| **Description** | Opens the payment wizard; the amount is pre-filled with the remaining balance. |

*Screenshot: Partial invoice — Register Payment button* (`55-register-balance.png`)


### Step 56: Select the Journal

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click the **Journal** field. |
| **Description** | Choose the payment journal. |

*Screenshot: Register Payment dialog — Journal field* (`56-journal-balance.png`)


### Step 57: Commercial Bank

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Select **Commercial Bank**. |
| **Description** | The balance amount stays as pre-filled. |

*Screenshot: Register Payment dialog — Journal set to Commercial Bank* (`57-bank-balance.png`)


### Step 58: Create Payment

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click **Create Payment**. |
| **Description** | Creates the balance payment; the invoice becomes fully paid. |

*Screenshot: Register Payment dialog — Create Payment button* (`58-create-balance.png`)


### Step 59: Close

| | |
|---|---|
| **Navigation** | Customer Invoice (Paid) |
| **Action** | Click **Close**. |
| **Description** | Returns to the main menu (the ticket). |

*Screenshot: Invoice after the balance payment — Close* (`59-close-balance.png`)


### Step 60: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed repair item back to the customer. The button appears after the balance is paid (you may need to refresh the page). |

*Screenshot: Ticket form — Dispatch button* (`60-dispatch.png`)


### Step 61: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the outgoing transfer of the repaired item to the customer. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`61-validate-dispatch.png`)


### Step 62: Close

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Close** to go to the ticket view. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close button* (`62-close.png`, `63-final-ticket.png`)


---

## QA notes

- Steps 1–7 and 9–14 follow the "Full Flow" (1A) and "Tested OK" (1B) guides; the differences in this **Branch** variant are: Repair Reason *Low Pressue*, Job Location **Centre Repair** (no Send to / Received at Factory and no Send to / Received at Sales Centre), and the balance being collected before Dispatch.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run calls it, swallows the error, then validates the resulting picking via `/web/dataset/call_kw` (the Validate button is hidden/unreliable under the Studio views).
- The **Confirm**, invoice **Confirm** and delivery **Validate** buttons are hidden by the Fix-Repair Studio views in the automated user's session. The order is confirmed through the genuine online portal flow (Send by Email → View Quotation → Accept & Sign → Accept & Sign); the invoice is posted and the transfers validated via `/web/dataset/call_kw`. The deposit and balance **Register Payment** wizards are driven through the real UI.
- The sales order generates a chain of three transfers on this route (`JM-EK/OUT` → `RP-JM/IN` → `RP-JM/OUT`); the tour records only one Validate. The automated run validates them all in dependency order.
- The last three recorded tour steps (Amount "1,200.0000" set to 50%, "600", then create payment) are recorder artefacts of the deposit payment (step 42/43) and are not separate screens.
- **Dispatch** becomes visible only after the balance is paid and the page is fully reloaded (computed field). A hash-only navigation does not refresh the record, so the automated flow reloads in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture). Screenshots come from one clean, fully-passing automated run (admin role) against the staging instance.
- The staging database is a temporary Odoo.sh environment, automatically deleted on 12 October 2026; regenerate the screenshots on the production instance if needed.
