# Repair User Guide — Branch
## Type 4: Under Warranty (External not RUG) — Full Flow (Centre Repair)

> Source: Odoo Tour Recorder export
> `Tour/4C. Repair User Guide - Branch [ Under Warranty ( External not RUG ) - Full Flow ].json`

---

## 1. Overview

This manual explains how to register and complete a **branch (Centre Repair)** repair for a customer's product that is **still under warranty** and has an existing **serial number**, but whose damage **is not covered by the warranty** and is not a RUG case (type **Under Warranty - External not RUG**). The process starts with a Helpdesk ticket at the receiving branch, records the repair through a Field Service task, quotes the spare part for the customer's online approval, collects a 50% deposit, collects the balance and ends when the item is dispatched back to the customer.

### Ticket stages covered

`New` → `Diagnosis` → `Estimation Sent to Customer` → `Estimation Approval Received` → `Advance Received` → `Repair Started` → `Repair Completed` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service, Inventory and Accounting apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the finished product (with its serial number, already sold through a sales order) already exist in Odoo.
- The item has been physically brought to the branch by the customer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Under Warranty - External not RUG |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Centre Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Serial Number | 0701_002 (Product [JMC6] Multi Chopper 6Hp (Tractor Type) is filled automatically) |
| Spare Part | [02BB 023] BALL BEARING 6202-2RS |
| Payment Journal | Commercial Bank |
| Deposit / Balance | 50% deposit, then the remaining balance |

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
| A | 1–10 | Open Helpdesk, create the ticket and classify it (type, locations, reason, customer) and select the serial number of the finished product. |
| B | 11–13 | Return the item into stock and validate the receipt. |
| C | 14–15 | Plan the intervention and create the Field Service task (Centre Repair: no factory leg). |
| D | 16–28 | The technician records the diagnosis, attaches a photo of the item and adds the spare part. |
| E | 29–32 | Open the quotation, send it to the customer by email and confirm it when the customer accepts. |
| F | 33–39 | Company policy: a 50% deposit must be paid in advance before the repair proceeds. |
| G | 40–47 | Validate the delivery of the repair part and complete the repair task. |
| H | 48–54 | Collect the remaining balance from the customer. |
| I | 55–57 | Dispatch the repaired item back to the customer. |

---

## Section A — Create the Repair Ticket (Steps 1–10)

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
| **Description** | Displays the created tickets and their information. |

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
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01649`) — the ticket has no user-editable title. |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)

### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Under Warranty - External not RUG**. |
| **Description** | Selects the flow for a product that is under warranty but whose damage is not covered by it (External, not RUG). For this type the item is identified by an existing **Serial Number**; there is no *Create Serial No* step. |

*Screenshot: Ticket form — Type field* (`05-repair-type.png`)

### Step 6: Set the Return Receipt Location

| | |
|---|---|
| **Navigation** | Ticket form → Return Receipt Location field |
| **Action** | Click **Return Receipt Location** and select the branch receiving the item (e.g. `BR-AM/Stock`, Jinasena Ampara Branch). |
| **Description** | Select the location where you would like to receive the product for repair. |

*Screenshot: Ticket form — Return Receipt Location field* (`06-return-receipt.png`)

### Step 7: Select the Repair Reason

| | |
|---|---|
| **Navigation** | Ticket form → Repair Reason field |
| **Action** | Click **Repair Reason** and select the reported fault (e.g. `Difficult to start the engine`). |
| **Description** | A list of common errors is provided; select the ones that apply. This is a tags field. |

*Screenshot: Ticket form — Repair Reason field* (`07-repair-reason.png`)

### Step 8: Select the Job Location

| | |
|---|---|
| **Navigation** | Ticket form → Job Location field |
| **Action** | In **Job Location**, select **Centre Repair**. |
| **Description** | Defines where the repair will be performed. **Centre Repair** means the repair is done at the branch's service centre, so there is no Send to Factory / Send to Sales Centre leg. |

*Screenshot: Ticket form — Job Location field* (`08-job-location.png`)

### Step 9: Select the Customer

| | |
|---|---|
| **Navigation** | Ticket form → Customer field |
| **Action** | Click **Customer** and select `KURUNEGALA CASH CUSTOMER`. |
| **Description** | Email and Phone are filled automatically from the customer record. |

*Screenshot: Ticket form — Customer field* (`09-customer.png`)

### Step 10: Enter the Serial Number

| | |
|---|---|
| **Navigation** | Ticket form → Serial Number field |
| **Action** | Click **Serial Number**, type the serial number of the finished product (e.g. `0701_002`) and select it from the list. |
| **Description** | Type the serial number corresponding to the finished product sold via a sales order and select it. Only serials already sold to a customer are offered. Selecting it fills in the **Product** and the **Sales Order** automatically (here `[JMC6] Multi Chopper 6Hp (Tractor Type)`), so there is no separate Product step. |

*Screenshot: Ticket form — Serial Number field* (`10-serial-no.png`)

*Screenshot: Ticket form — Serial Number entered, Product filled in* (`10b-serial-entered.png`)

---

## Section B — Receive the Item (Steps 11–13)

### Step 11: Return

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Return**. |
| **Description** | Records the item being received from the customer: creates the Returned Picking (receipt) for the product. (The server also raises "You may only return Done pickings" after creating it; see the QA notes.) |

*Screenshot: Ticket form — Return button* (`11-return.png`)

### Step 12: Validate the receipt

| | |
|---|---|
| **Navigation** | Transfer (Receipt) → header |
| **Action** | Click **Validate**. |
| **Description** | Validates the return operation: the item is received into stock and the transfer becomes *Done*. This is required before *Plan Intervention* appears. |

*Screenshot: Transfer (Ready) — Validate button* (`12-validate-return.png`)

### Step 13: Back

| | |
|---|---|
| **Navigation** | Transfer (Done) |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous menu — the ticket view. The screenshot shows the receipt in the *Done* state; on this instance it opens as a full page, so there is no Back button to frame. |

*Screenshot: Transfer (Done)* (`13-back.png`)

---

## Section C — Plan the Task (Steps 14–15)

### Step 14: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Plan Intervention**. |
| **Description** | To assign the job to a repair technician, create a Field Service task. With Centre Repair the ticket goes straight to Plan Intervention after the receipt is validated. |

*Screenshot: Ticket form — Plan Intervention button* (`14-plan-intervention.png`)

### Step 15: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the Field Service task and opens it so the technician can create and manage it. |

*Screenshot: Create a Field Service task dialog — Create & View Task button* (`15-create-view-task.png`)

---

## Section D — Diagnosis, Image and Parts (Steps 16–28)

### Step 16: Open the Repair Diagnosis tab

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis tab |
| **Action** | Click the **Repair Diagnosis** tab. |
| **Description** | The technician checked the repair item and found the reason; record it in the diagnosis table. |

*Screenshot: Task form — Repair Diagnosis tab* (`16-diagnosis-tab.png`)

### Step 17: Add a line

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis |
| **Action** | Click **Add a line**. |
| **Description** | Adds a new diagnosis line to fill in. |

*Screenshot: Repair Diagnosis tab — Add a line* (`17-add-line.png`)

### Step 18: Diagnosis Area

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Diagnosis Area** cell and select `Burnt Part`. |
| **Description** | The area of the item where the fault was found. |

*Screenshot: Diagnosis line — Diagnosis Area cell* (`18-diagnosis-area.png`)

### Step 19: Diagnosis Code

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Diagnosis Code** cell and select `Base Plate`. |
| **Description** | The code of the faulty part. |

*Screenshot: Diagnosis line — Diagnosis Code cell* (`19-add-line.png`)

### Step 20: Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Reason** cell and select `Internal`. |
| **Description** | The reason for the fault. |

*Screenshot: Diagnosis line — Reason cell* (`20-diagnosis-area.png`)

### Step 21: Sub Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Sub Reason** cell and select `Hi Voltage`. |
| **Description** | The detailed reason for the fault. |

*Screenshot: Diagnosis line — Sub Reason cell* (`21-diagnosis-code.png`)

### Step 22: Resolution

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Resolution** cell and select `Reject`. |
| **Description** | The resolution decided by the technician. |

*Screenshot: Diagnosis line — Resolution cell* (`22-diagnosis-reason.png`)

### Step 23: Repair Stage

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Repair Stage** cell and select `1-REP-REC`. |
| **Description** | The repair stage the item is at. |

*Screenshot: Diagnosis line — Repair Stage cell* (`23-diagnosis-repair-stage.png`)

### Step 24: Open the Repair Image tab

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click the **Repair Image** tab. |
| **Description** | At least one image of the item being repaired must be included. |

*Screenshot: Task form — Repair Image tab* (`24-diagnosis-resolution.png`)

### Step 25: Take a Picture

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click **Take a Picture**, then select the image file and click **Open**. |
| **Description** | Attaches the photo of the item to the task. Once Diagnosis and Image are both set, the **Products** button appears. |

*Screenshot: Repair Image tab — Take a Picture (Repair Image 01)* (`25-diagnosis-repair-stage.png`)

### Step 26: Products

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click **Products**. |
| **Description** | Opens the item master (product catalog) to select the items used to repair the product. |

*Screenshot: Task form — Products button* (`26-products.png`)

### Step 27: Add the spare part

| | |
|---|---|
| **Navigation** | Product catalog |
| **Action** | Find the part (e.g. `[02BB 023] BALL BEARING 6202-2RS`) and click **Add**. |
| **Description** | Adds the part with quantity 1 to the task; it becomes a line on the repair quotation. Select each required item and enter the quantity. |

*Screenshot: Product catalog — Add button* (`27-add-part.png`)

### Step 28: Back

| | |
|---|---|
| **Navigation** | Product catalog |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous menu (the task). |

*Screenshot: Product catalog — Back button* (`28-back-from-catalog.png`)

---

## Section E — Quotation and Customer Confirmation (Steps 29–32)

### Step 29: Sales Order

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the quotation created from the parts added to the task. |

*Screenshot: Task form — Sales Order button* (`29-add-part.png`)

### Step 30: Send by Email

| | |
|---|---|
| **Navigation** | Sales Order (Quotation) |
| **Action** | Click **Send by Email**. |
| **Description** | The quotation must be approved by the customer. This prepares the email containing the online quotation link. |

*Screenshot: Quotation — Send by Email button* (`30-back-from-catalog.png`)

### Step 31: Send

| | |
|---|---|
| **Navigation** | Send email dialog |
| **Action** | Click **Send**. |
| **Description** | Sends the email and moves the quotation to *Quotation Sent*. |

*Screenshot: Send email dialog — Send button* (`31-sales-order-button.png`)

### Step 32: Confirm the order

| | |
|---|---|
| **Navigation** | Sales Order (Quotation Sent) / customer portal |
| **Action** | The customer opens **View Quotation** from the email and clicks **Accept & Sign**, then **Accept & Sign** again in the signature pop-up. |
| **Description** | The order moves to *Sales Order* once the customer accepts; this activates the Confirm step of the quotation. On this instance the Confirm button itself is hidden in the back-office view once the email has been sent, so the customer's online acceptance (the real-world path) confirms the order. |

*Screenshot: Quotation Sent — state before the customer accepts* (`32-confirm.png`)

*Screenshot: Customer portal — quotation, Accept & Sign button* (`32b-portal-quotation.png`)

*Screenshot: Customer portal — Validate Order signature pop-up, Accept & Sign button* (`32c-portal-signature.png`)

*Screenshot: Customer portal — order signed and confirmed* (`32d-portal-confirmed.png`)

---

## Section F — 50% Deposit (Steps 33–39)

### Step 33: Create Invoice

| | |
|---|---|
| **Navigation** | Sales Order (confirmed) |
| **Action** | Click **Create Invoice**. |
| **Description** | As per company policy, a 50% deposit must be paid in advance to proceed with the repair. This creates the draft invoice on which the deposit is registered. |

*Screenshot: Sales Order — Create Invoice button* (`33-create-invoice.png`)

### Step 34: Confirm the invoice

| | |
|---|---|
| **Navigation** | Customer Invoice (Draft) |
| **Action** | Click **Confirm**. |
| **Description** | Posts the invoice so a payment can be registered against it. |

*Screenshot: Draft invoice — Confirm button* (`34-close-quotation.png`)

### Step 35: Register Payment

| | |
|---|---|
| **Navigation** | Customer Invoice (Posted) |
| **Action** | Click **Register Payment**. |
| **Description** | Opens the payment wizard for the invoice. |

*Screenshot: Posted invoice — Register Payment button* (`35-register-payment.png`)

### Step 36: Select the Journal

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click the **Journal** field. |
| **Description** | Select the correct journal, i.e. how the money was received. |

*Screenshot: Register Payment dialog — Journal field* (`36-journal.png`)

### Step 37: Journal and Amount

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Select **Commercial Bank** and enter the deposit amount (50% of the invoice, e.g. `600` of `1,200`). |
| **Description** | Type the amount and press Enter. The Payment Difference shows what remains for the balance. |

*Screenshot: Register Payment dialog — Journal set to Commercial Bank, Amount set to 50%* (`37-bank-amount.png`)

### Step 38: Create Payment

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click **Create Payment**. |
| **Description** | Creates the deposit payment. The invoice becomes *Partial*. |

*Screenshot: Register Payment dialog — Create Payment button* (`38-create-invoice.png`)

### Step 39: Close

| | |
|---|---|
| **Navigation** | Customer Invoice (Partial) |
| **Action** | Click **Close**. |
| **Description** | Returns to the previous menu. The invoice shows the **Partial** ribbon. |

*Screenshot: Invoice after the deposit — Partial ribbon* (`39-close-invoice.png`)

---

## Section G — Delivery and Task Completion (Steps 40–47)

### Step 40: Tasks — back to the order

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Since the advance has been received, go back to the sales order to complete the repair process. |

*Screenshot: Ticket form — Tasks button* (`40-register-payment.png`)

### Step 41: Sales Order

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click **Sales Order**. |
| **Description** | Opens the confirmed order. |

*Screenshot: Task form — Sales Order button* (`41-journal.png`)

### Step 42: Delivery

| | |
|---|---|
| **Navigation** | Sales Order → button box |
| **Action** | Click the **Delivery** button. |
| **Description** | Opens the delivery transfer of the order: the item used for the repair is consumed by the customer. On this run the order generated a single delivery transfer (`BR-AM/OUT/00777`) which opens directly; see the QA notes. |

*Screenshot: Sales Order — Delivery button* (`42-bank-amount.png`)

### Step 43: Validate

| | |
|---|---|
| **Navigation** | Transfer BR-AM/OUT/00777 (Ready) |
| **Action** | Click **Validate**. |
| **Description** | Completes the stock movement. The transfer becomes *Done*. |

*Screenshot: Transfer BR-AM/OUT/00777 (Ready) — Validate button* (`43-create-payment.png`)

### Step 44: Close

| | |
|---|---|
| **Navigation** | Transfer BR-AM/OUT/00777 (Done) |
| **Action** | Click **Close**. |
| **Description** | Closes the transfer once it is *Done*. |

*Screenshot: Transfer BR-AM/OUT/00777 (Done) — Close* (`44-close-BR-AM-OUT-00777.png`)

### Step 45: Tasks

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Opens the task created for the repair. |

*Screenshot: Ticket form — Tasks button* (`45-tasks-close.png`)

### Step 46: Mark as done

| | |
|---|---|
| **Navigation** | Task form → status bar |
| **Action** | Click **Mark as done**. |
| **Description** | The work on the originally created task has been completed; this ends the task. |

*Screenshot: Task form — Mark as done button* (`46-mark-as-done.png`)

### Step 47: Close

| | |
|---|---|
| **Navigation** | Task form (Done) |
| **Action** | Click **Close**. |
| **Description** | Returns to the ticket. |

*Screenshot: Task (Done) — Close* (`47-close-task.png`)

---

## Section H — Balance Payment (Steps 48–54)

### Step 48: Tasks — back to the invoice

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Go back to the task to receive the balance payment. |

*Screenshot: Ticket form — Tasks button* (`48-tasks-balance.png`)

### Step 49: Invoices

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Invoices** button. |
| **Description** | Opens the invoice so the balance payment can be registered. |

*Screenshot: Task form — Invoices button* (`49-close-BR-AM-OUT-00770.png`)

### Step 50: Register Payment

| | |
|---|---|
| **Navigation** | Customer Invoice (Partial) |
| **Action** | Click **Register Payment**. |
| **Description** | Opens the payment wizard; the amount is pre-filled with the remaining balance. |

*Screenshot: Partial invoice — Register Payment button* (`50-register-balance.png`)

### Step 51: Select the Journal

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click the **Journal** field. |
| **Description** | Select the correct journal type. |

*Screenshot: Register Payment dialog — Journal field* (`51-journal-balance.png`)

### Step 52: Commercial Bank

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Select **Commercial Bank**. |
| **Description** | The balance amount stays as pre-filled. |

*Screenshot: Register Payment dialog — Journal set to Commercial Bank* (`52-bank-balance.png`)

### Step 53: Create Payment

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click **Create Payment**. |
| **Description** | Creates the balance payment; the invoice becomes fully paid. |

*Screenshot: Register Payment dialog — Create Payment button* (`53-create-balance.png`)

### Step 54: Close

| | |
|---|---|
| **Navigation** | Customer Invoice (Paid) |
| **Action** | Click **Close**. |
| **Description** | Returns to the ticket. |

*Screenshot: Invoice after the balance payment — Close* (`54-close-balance.png`)

---

## Section I — Dispatch (Steps 55–57)

### Step 55: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed repair item back to the customer. The button appears once the balance is paid (you may need to refresh the page). |

*Screenshot: Ticket form — Dispatch button* (`55-dispatch.png`)

### Step 56: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the outgoing transfer of the repaired item to the customer. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`56-invoices.png`)

### Step 57: Close

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Close** to go to the ticket view. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close* (`57-close.png`)

*Screenshot: Result: ticket after the Close action* (`58-final-ticket.png`)

---

## QA notes

- This manual covers the **Under Warranty (External not RUG)** flow for a **branch (Centre Repair)** repair. Compared with the *3A* factory flow there is no Send to / Received at Factory and no Send to / Received at Sales Centre: after the receipt is validated the ticket goes straight to Plan Intervention. Compared with the *Without Serial No* branch flow (1C) there is no Product selection and no **Create Serial No** step: the item is identified by an existing **Serial Number**, which fills in the Product. This tour has no warranty card step.
- The Serial Number field only offers serials already sold to a customer. The tour picked its own serial; as required by the test-data rules the automated run picks a serial of [JMC6] whose on-hand quantity is zero (this run used `0701_002`), skipping serials that still hold stock in a Repair location from earlier unfinished runs, which would make the receipt and the final Dispatch fail.
- The tour selects the Repair Reason *Low Pressue*; the test-data rules specify `Difficult to start the engine`, which the automated run and this manual use. The tour selects the Return Receipt Location "Jinasena Ampara Branch"; the automated run selects its stock location `BR-AM/Stock`. The tour's diagnosis steps are generic lookups (typed 1–7); the manual uses the test-data values.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run clicks the real button, which created the picking on this run; the receipt is validated through `/web/dataset/call_kw` (its Validate button is hidden by the Studio views). The receipt opens as a full page, so the Back screenshot (step 13) shows the Done receipt without a framed button.
- On this instance the quotation's **Confirm** button is hidden once the email has been sent, so the guide shows the customer path (View Quotation → Accept & Sign → Accept & Sign on the online portal; step 32 shows the real portal pages). In the latest run the order still showed as *sent* after the portal flow, so the automated run then confirmed it with `action_confirm` over RPC (the spec verifies the order state via RPC and falls back when needed). The draft invoice is posted through RPC (screenshot 34 shows the Confirm button); the deposit and balance payments are registered through the real Register Payment wizard (50% deposit, then the pre-filled balance).
- The number of delivery transfers depends on branch stock. This run produced a single delivery transfer (`BR-AM/OUT/00777`), which the Delivery button opens directly and which was validated through the real Validate button (steps 42–44); a different run may produce the three-transfer chain (`JM-EK/OUT` → `RP-JM/IN` → `RP-JM/OUT`). The automated run handles both cases.
- After the task is closed the tour goes directly to the invoice (no Send to / Received at Sales Centre in the branch flow), and the balance is collected before **Dispatch**. The tour has no separate Close / Tasks / Sales Order navigation between sending the quotation and confirming it; the manual follows the tour.
- The tour also has an *Open Task* click after **Create & View Task**; on this instance the task is already open at that point, so there is no separate step for it. The **Dispatch** button appears in the status bar only after a full page reload once the balance is paid, so the automated flow reloads the ticket in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots (serial entered, portal order confirmed, final ticket) have no box. Screenshots come from one clean, fully-passing automated run (admin role): ticket `REPAIR/2026/01660`, quotation `S02241`.
- Every screenshot shows a red "Database neutralized for testing: no emails sent, etc." banner at the top. This is expected on the test database and is not part of the normal production screen.
