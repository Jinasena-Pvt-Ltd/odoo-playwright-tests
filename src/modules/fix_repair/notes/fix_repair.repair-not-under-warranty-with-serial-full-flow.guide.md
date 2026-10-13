# Repair User Guide — Factory
## Type 3: Not Under Warranty (With Serial No) — Full Flow

> Source: Odoo Tour Recorder export
> `Tour/3A. Repair User Guide - Factory [ Not Under Warranty ( With Serial No ) - Full Flow ].json`

---

## 1. Overview

This manual explains how to register and complete a **factory** repair for a customer's product whose **warranty has expired** and which has an existing **serial number**. The process starts with a Helpdesk ticket at the receiving branch, moves the item to the factory, records the repair through a Field Service task, quotes the spare part for the customer's online approval, collects a 50% deposit, routes the item back through the sales centre, collects the balance and ends when the item is dispatched back to the customer.

### Ticket stages covered

`New` → `Sent to Factory` → `Received at Factory` → `Diagnosis` → `Estimation Sent to Customer` → `Estimation Approval Received` → `Advance Received` → `Repair Started` → `Repair Completed` → `Sent to Sales Centre` → `Received at Sales Centre` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service, Inventory and Accounting apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the finished product (with its serial number, already sold through a sales order) already exist in Odoo.
- The item has been physically brought to the branch by the customer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Not Under Warranty (With Serial No) |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Factory Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Serial Number | 0630_010 (Product [JMC6] Multi Chopper 6Hp (Tractor Type) is filled automatically) |
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
| C | 14–17 | Send the item to the factory, receive it there and create the Field Service task. |
| D | 18–30 | The technician records the diagnosis, attaches a photo of the item and adds the spare part. |
| E | 31–37 | Open the quotation, send it to the customer by email and confirm it when the customer accepts. |
| F | 38–44 | Company policy: a 50% deposit must be paid in advance before the repair proceeds. |
| G | 45–59 | Validate the deliveries of the repair part and complete the repair task. |
| H | 60–61 | Send the repaired item back to the sales centre and receive it there. |
| I | 62–68 | Collect the remaining balance from the customer. |
| J | 69–71 | Dispatch the repaired item back to the customer. |

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
| **Action** | Click the **Type** field and select **Repair - Not Under Warranty (With Serial No)**. |
| **Description** | Selects the flow for a product whose warranty period has expired but which has a serial number. For this type the item is identified by an existing **Serial Number**; there is no *Create Serial No* step. |

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
| **Action** | In **Job Location**, select **Factory Repair**. |
| **Description** | Defines where the repair will be performed. **Factory Repair** means the item is sent from the branch to the factory. |

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
| **Action** | Click **Serial Number**, type the serial number of the finished product (e.g. `0630_010`) and select it from the list. |
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
| **Description** | Validates the return operation: the item is received into stock and the transfer becomes *Done*. This is required before *Send to Factory* appears. |

*Screenshot: Transfer (Ready) — Validate button* (`12-validate-return.png`)

### Step 13: Back

| | |
|---|---|
| **Navigation** | Transfer (Done) |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous menu — the ticket view. The screenshot shows the receipt in the *Done* state; on this instance it opens as a full page, so there is no Back button to frame. |

*Screenshot: Transfer (Done)* (`13-back.png`)

---

## Section C — Send to the Factory and Plan the Task (Steps 14–17)

### Step 14: Send to Factory

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Factory**. |
| **Description** | Sends the item to the factory for repair. |

*Screenshot: Ticket form — Send to Factory button* (`14-send-to-factory.png`)

### Step 15: Received at Factory

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Factory**. |
| **Description** | Confirms that the item has arrived at the factory. |

*Screenshot: Ticket form — Received at Factory button* (`15-received-at-factory.png`)

### Step 16: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Plan Intervention**. |
| **Description** | To assign the job to a repair technician, create a Field Service task. |

*Screenshot: Ticket form — Plan Intervention button* (`16-plan-intervention.png`)

### Step 17: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the Field Service task and opens it so the technician can create and manage it. |

*Screenshot: Create a Field Service task dialog — Create & View Task button* (`17-create-view-task.png`)

---

## Section D — Diagnosis, Image and Parts (Steps 18–30)

### Step 18: Open the Repair Diagnosis tab

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis tab |
| **Action** | Click the **Repair Diagnosis** tab. |
| **Description** | The technician checked the repair item and found the reason; record it in the diagnosis table. |

*Screenshot: Task form — Repair Diagnosis tab* (`18-diagnosis-tab.png`)

### Step 19: Add a line

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis |
| **Action** | Click **Add a line**. |
| **Description** | Adds a new diagnosis line to fill in. |

*Screenshot: Repair Diagnosis tab — Add a line* (`19-add-line.png`)

### Step 20: Diagnosis Area

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Diagnosis Area** cell and select `Burnt Part`. |
| **Description** | The area of the item where the fault was found. |

*Screenshot: Diagnosis line — Diagnosis Area cell* (`20-diagnosis-area.png`)

### Step 21: Diagnosis Code

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Diagnosis Code** cell and select `Base Plate`. |
| **Description** | The code of the faulty part. |

*Screenshot: Diagnosis line — Diagnosis Code cell* (`21-diagnosis-code.png`)

### Step 22: Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Reason** cell and select `Internal`. |
| **Description** | The reason for the fault. |

*Screenshot: Diagnosis line — Reason cell* (`22-diagnosis-reason.png`)

### Step 23: Sub Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Sub Reason** cell and select `Hi Voltage`. |
| **Description** | The detailed reason for the fault. |

*Screenshot: Diagnosis line — Sub Reason cell* (`23-diagnosis-sub-reason.png`)

### Step 24: Resolution

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Resolution** cell and select `Reject`. |
| **Description** | The resolution decided by the technician. |

*Screenshot: Diagnosis line — Resolution cell* (`24-diagnosis-resolution.png`)

### Step 25: Repair Stage

| | |
|---|---|
| **Navigation** | Repair Diagnosis → diagnosis line |
| **Action** | Click the **Repair Stage** cell and select `1-REP-REC`. |
| **Description** | The repair stage the item is at. |

*Screenshot: Diagnosis line — Repair Stage cell* (`25-diagnosis-repair-stage.png`)

### Step 26: Open the Repair Image tab

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click the **Repair Image** tab. |
| **Description** | At least one image of the item being repaired must be included. |

*Screenshot: Task form — Repair Image tab* (`26-repair-image-tab.png`)

### Step 27: Take a Picture

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click **Take a Picture**, then select the image file and click **Open**. |
| **Description** | Attaches the photo of the item to the task. Once Diagnosis and Image are both set, the **Products** button appears. |

*Screenshot: Repair Image tab — Take a Picture (Repair Image 01)* (`27-take-picture.png`)

### Step 28: Products

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click **Products**. |
| **Description** | Opens the item master (product catalog) to select the items used to repair the product. |

*Screenshot: Task form — Products button* (`28-products.png`)

### Step 29: Add the spare part

| | |
|---|---|
| **Navigation** | Product catalog |
| **Action** | Find the part (e.g. `[02BB 023] BALL BEARING 6202-2RS`) and click **Add**. |
| **Description** | Adds the part with quantity 1 to the task; it becomes a line on the repair quotation. Select each required item and enter the quantity. |

*Screenshot: Product catalog — Add button* (`29-add-part.png`)

### Step 30: Back

| | |
|---|---|
| **Navigation** | Product catalog |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous menu (the task). |

*Screenshot: Product catalog — Back button* (`30-back-from-catalog.png`)

---

## Section E — Quotation and Customer Confirmation (Steps 31–37)

### Step 31: Sales Order

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the quotation created from the parts added to the task. |

*Screenshot: Task form — Sales Order button* (`31-sales-order-button.png`)

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
| **Description** | To see whether the quotation has been approved, go back to the task. |

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
| **Description** | The order moves to *Sales Order* once the customer accepts; this activates the Confirm step of the quotation. On this instance the Confirm button itself is hidden in the back-office view once the email has been sent, so the customer's online acceptance (the real-world path) confirms the order. |

*Screenshot: Quotation Sent — state before the customer accepts* (`37-confirm.png`)

*Screenshot: Customer portal — quotation, Accept & Sign button* (`37b-portal-quotation.png`)

*Screenshot: Customer portal — Validate Order signature pop-up, Accept & Sign button* (`37c-portal-signature.png`)

*Screenshot: Customer portal — order signed and confirmed* (`37d-portal-confirmed.png`)

---

## Section F — 50% Deposit (Steps 38–44)

### Step 38: Create Invoice

| | |
|---|---|
| **Navigation** | Sales Order (confirmed) |
| **Action** | Click **Create Invoice**. |
| **Description** | As per company policy, a 50% deposit must be paid in advance to proceed with the repair. This creates the draft invoice on which the deposit is registered. |

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
| **Description** | Select the correct journal, i.e. how the money was received. |

*Screenshot: Register Payment dialog — Journal field* (`41-journal.png`)

### Step 42: Journal and Amount

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Select **Commercial Bank** and enter the deposit amount (50% of the invoice, e.g. `600` of `1,200`). |
| **Description** | Type the amount and press Enter. The Payment Difference shows what remains for the balance. |

*Screenshot: Register Payment dialog — Journal set to Commercial Bank, Amount set to 50%* (`42-bank-amount.png`)

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

---

## Section G — Delivery and Task Completion (Steps 45–59)

### Step 45: Tasks — back to the order

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Since the advance has been received, go back to the sales order to complete the repair process. |

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
| **Description** | Opens the delivery transfer of the order: the item used for the repair is consumed by the customer. On this run the order generated a chain of three transfers (`JM-EK/OUT`, `RP-JM/IN`, `RP-JM/OUT`), each ready only after the one before it; see the QA notes. |

*Screenshot: Sales Order — Delivery button* (`47-delivery.png`)

### Step 48: Open the first transfer

| | |
|---|---|
| **Navigation** | Transfers list |
| **Action** | Click the transfer `JM-EK/OUT/00760`. |
| **Description** | Opens the first transfer of the chain. Process the transfers in order: the next one becomes *Ready* only after the previous one is *Done*. |

*Screenshot: Transfers list — JM-EK/OUT/00760* (`48-open-JM-EK-OUT-00760.png`)

### Step 49: Validate

| | |
|---|---|
| **Navigation** | Transfer JM-EK/OUT/00760 (Ready) |
| **Action** | Click **Validate**. |
| **Description** | Completes the stock movement. The transfer becomes *Done*. |

*Screenshot: Transfer JM-EK/OUT/00760 (Ready) — Validate button* (`49-validate-JM-EK-OUT-00760.png`)

### Step 50: Back

| | |
|---|---|
| **Navigation** | Transfer JM-EK/OUT/00760 (Done) |
| **Action** | Click **Back**. |
| **Description** | Returns to the Transfers list to open the next transfer. |

*Screenshot: Transfer JM-EK/OUT/00760 (Done) — Back button* (`50-back-JM-EK-OUT-00760.png`)

### Step 51: Open the second transfer

| | |
|---|---|
| **Navigation** | Transfers list |
| **Action** | Click the transfer `RP-JM/IN/00501`. |
| **Description** | Opens the second transfer of the chain. Process the transfers in order: the next one becomes *Ready* only after the previous one is *Done*. |

*Screenshot: Transfers list — RP-JM/IN/00501* (`51-open-RP-JM-IN-00501.png`)

### Step 52: Validate

| | |
|---|---|
| **Navigation** | Transfer RP-JM/IN/00501 (Ready) |
| **Action** | Click **Validate**. |
| **Description** | Completes the stock movement. The transfer becomes *Done*. |

*Screenshot: Transfer RP-JM/IN/00501 (Ready) — Validate button* (`52-validate-RP-JM-IN-00501.png`)

### Step 53: Back

| | |
|---|---|
| **Navigation** | Transfer RP-JM/IN/00501 (Done) |
| **Action** | Click **Back**. |
| **Description** | Returns to the Transfers list to open the next transfer. |

*Screenshot: Transfer RP-JM/IN/00501 (Done) — Back button* (`53-back-RP-JM-IN-00501.png`)

### Step 54: Open the third transfer

| | |
|---|---|
| **Navigation** | Transfers list |
| **Action** | Click the transfer `RP-JM/OUT/00526`. |
| **Description** | Opens the third transfer of the chain. Process the transfers in order: the next one becomes *Ready* only after the previous one is *Done*. |

*Screenshot: Transfers list — RP-JM/OUT/00526* (`54-open-RP-JM-OUT-00526.png`)

### Step 55: Validate

| | |
|---|---|
| **Navigation** | Transfer RP-JM/OUT/00526 (Ready) |
| **Action** | Click **Validate**. |
| **Description** | Completes the stock movement. The transfer becomes *Done*. |

*Screenshot: Transfer RP-JM/OUT/00526 (Ready) — Validate button* (`55-validate-RP-JM-OUT-00526.png`)

### Step 56: Close

| | |
|---|---|
| **Navigation** | Transfer RP-JM/OUT/00526 (Done) |
| **Action** | Click **Close**. |
| **Description** | Closes the transfer once all three transfers are *Done*. |

*Screenshot: Transfer RP-JM/OUT/00526 (Done) — Close* (`56-close-RP-JM-OUT-00526.png`)

### Step 57: Tasks

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Opens the task created for the repair. |

*Screenshot: Ticket form — Tasks button* (`57-tasks-close.png`)

### Step 58: Mark as done

| | |
|---|---|
| **Navigation** | Task form → status bar |
| **Action** | Click **Mark as done**. |
| **Description** | The work on the originally created task has been completed; this ends the task. |

*Screenshot: Task form — Mark as done button* (`58-mark-as-done.png`)

### Step 59: Close

| | |
|---|---|
| **Navigation** | Task form (Done) |
| **Action** | Click **Close**. |
| **Description** | Returns to the ticket. |

*Screenshot: Task (Done) — Close* (`59-close-task.png`)

---

## Section H — Return to the Sales Centre (Steps 60–61)

### Step 60: Send to Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Sales Centre**. |
| **Description** | Since this item was received from a sales centre and sent to the factory, send it back to the sales centre. The button appears once the task is done (you may need to refresh the page). |

*Screenshot: Ticket form — Send to Sales Centre button* (`60-send-to-sales-centre.png`)

### Step 61: Received at Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Sales Centre**. |
| **Description** | Confirms that the repaired item has arrived at the sales centre. |

*Screenshot: Ticket form — Received at Sales Centre button* (`61-received-at-sales-centre.png`)

---

## Section I — Balance Payment (Steps 62–68)

### Step 62: Tasks — back to the invoice

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Go back to the task to receive the balance payment. |

*Screenshot: Ticket form — Tasks button* (`62-tasks-balance.png`)

### Step 63: Invoices

| | |
|---|---|
| **Navigation** | Task form → button box |
| **Action** | Click the **Invoices** button. |
| **Description** | Opens the invoice so the balance payment can be registered. |

*Screenshot: Task form — Invoices button* (`63-invoices.png`)

### Step 64: Register Payment

| | |
|---|---|
| **Navigation** | Customer Invoice (Partial) |
| **Action** | Click **Register Payment**. |
| **Description** | Opens the payment wizard; the amount is pre-filled with the remaining balance. |

*Screenshot: Partial invoice — Register Payment button* (`64-register-balance.png`)

### Step 65: Select the Journal

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click the **Journal** field. |
| **Description** | Select the correct journal type. |

*Screenshot: Register Payment dialog — Journal field* (`65-journal-balance.png`)

### Step 66: Commercial Bank

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Select **Commercial Bank**. |
| **Description** | The balance amount stays as pre-filled. |

*Screenshot: Register Payment dialog — Journal set to Commercial Bank* (`66-bank-balance.png`)

### Step 67: Create Payment

| | |
|---|---|
| **Navigation** | Register Payment dialog |
| **Action** | Click **Create Payment**. |
| **Description** | Creates the balance payment; the invoice becomes fully paid. |

*Screenshot: Register Payment dialog — Create Payment button* (`67-create-balance.png`)

### Step 68: Close

| | |
|---|---|
| **Navigation** | Customer Invoice (Paid) |
| **Action** | Click **Close**. |
| **Description** | Returns to the ticket. |

*Screenshot: Invoice after the balance payment — Close* (`68-close-balance.png`)

---

## Section J — Dispatch (Steps 69–71)

### Step 69: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed repair item back to the customer. The button appears once the balance is paid (you may need to refresh the page). |

*Screenshot: Ticket form — Dispatch button* (`69-dispatch.png`)

### Step 70: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the outgoing transfer of the repaired item to the customer. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`70-validate-dispatch.png`)

### Step 71: Close

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Close** to go to the ticket view. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close* (`71-close.png`)

*Screenshot: Result: ticket after the Close action* (`72-final-ticket.png`)

---

## QA notes

- This manual covers the **Not Under Warranty (With Serial No)** factory flow. Compared with the *Without Serial No* flow there is no Product selection and no **Create Serial No** step: the item is identified by an existing **Serial Number**, which fills in the Product. No warranty card is needed because the warranty period has expired. The rest of the flow (factory, task, quotation accepted online, 50% deposit, delivery, sales centre, balance, dispatch) is the same.
- The Serial Number field only offers serials already sold to a customer. The tour typed its own serial; as required by the test-data rules the automated run picks a serial of [JMC6] whose on-hand quantity is zero (this run used `0630_010`), skipping serials that still hold stock in a Repair location from earlier unfinished runs, which would make the receipt and the final Dispatch fail.
- The tour selects the Return Receipt Location "Jinasena Ampara Branch"; the automated run selects its stock location `BR-AM/Stock`. The tour also has an *Open Task* click after **Create & View Task**; on this instance the task is already open at that point, so there is no separate step for it.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run clicks the real button, falls back to the same call via `/web/dataset/call_kw` if no picking appears, and validates the receipt through RPC (the receipt's Validate button is hidden by the Studio views). The receipt opens as a full page, so the Back screenshot (step 13) shows the Done receipt without a framed button.
- On this instance the quotation's **Confirm** button is hidden once the email has been sent, so the guide shows the customer path (View Quotation → Accept & Sign → Accept & Sign on the online portal; step 37 shows the real portal pages). In the latest run the order still showed as *sent* after the portal flow, so the automated run then confirmed it with `action_confirm` over RPC (the spec verifies the order state via RPC and falls back when needed). The draft invoice is posted through RPC (screenshot 39 shows the Confirm button); the deposit and balance payments are registered through the real Register Payment wizard (deposit 600 = 50% of 1,200, balance pre-filled).
- The number of delivery transfers depends on whether stock is available at the branch. This run produced the full three-transfer chain (`JM-EK/OUT/00760` → `RP-JM/IN/00501` → `RP-JM/OUT/00526`), validated in steps 48–56 (a different run may produce a single delivery). The automated run handles both cases; if the order generates a chain of transfers, validate each one in order.
- The **Send to Sales Centre** and **Dispatch** buttons appear in the status bar only after a full page reload once the task is done / the balance is paid, so the automated flow reloads the ticket in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots (serial entered, portal order confirmed, final ticket) have no box. Screenshots come from one clean, fully-passing automated run (admin role): ticket `REPAIR/2026/01649`, quotation `S02185`.
- Every screenshot shows a red "Database neutralized for testing: no emails sent, etc." banner at the top. This is expected on the test database and is not part of the normal production screen.
