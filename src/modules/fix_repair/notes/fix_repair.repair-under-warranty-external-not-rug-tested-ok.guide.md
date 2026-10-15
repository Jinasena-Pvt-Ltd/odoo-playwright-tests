# Repair User Guide — Factory
## Type 4: Under Warranty (External not RUG) — Tested OK

> Source: Odoo Tour Recorder export
> `Tour/4B. Repair User Guide - Factory [ Under Warranty ( External not RUG )  - Tested Ok ].json`

---

## 1. Overview

This manual explains how to register and complete a **factory** repair for a customer's product which is **under warranty (external, not RUG)** and has an existing **serial number**, when the technician finds the item **Tested OK** — nothing needs repairing. It runs from the Helpdesk ticket, through the factory and the sales centre, to dispatch back to the customer.

### Ticket stages covered

`New` → `Sent to Factory` → `Received at Factory` → `Repair Completed` → `Sent to Sales Centre` → `Received at Sales Centre` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service and Inventory apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the finished product (with its serial number, already sold through a sales order) already exist in Odoo.
- The item has been physically brought to the branch by the customer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Under Warranty - External not RUG |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Factory Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Serial Number | 0701_002 (Product [JMC6] Multi Chopper 6Hp (Tractor Type) is filled automatically) |
| Repair result | Tested OK (no diagnosis, parts or quotation) |

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
| D | 18–20 | Mark the item Tested OK, mark the task done and close it. |
| E | 21–22 | Send the item back to the sales centre and receive it there. |
| F | 23–25 | Dispatch the item back to the customer. |

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
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01659`) — the ticket has no user-editable title. |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)

### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Under Warranty - External not RUG**. |
| **Description** | Selects the flow for a product that is under warranty (external, not RUG) and has a serial number. For this type the item is identified by an existing **Serial Number**; there is no *Create Serial No* step. |

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

## Section D — Complete the Task as Tested OK (Steps 18–20)

### Step 18: Tested OK

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Tested OK**. |
| **Description** | If the repair item can be restored to its original condition through a process that has no monetary value, or is found to work, use this facility. It skips the diagnosis, image, parts, quotation and deposit steps of the full flow (the "Add Data" reminders about diagnosis and image can be ignored). |

*Screenshot: Task dialog — Tested OK button* (`18-tested-ok.png`)

### Step 19: Mark as done

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Mark as done**. |
| **Description** | Since the work on the task has been completed, end it. The ticket moves to *Repair Completed*. |

*Screenshot: Task dialog — Mark as done button* (`19-mark-as-done.png`)

### Step 20: Close

| | |
|---|---|
| **Navigation** | Task dialog (Done) |
| **Action** | Click **Close**. |
| **Description** | Returns to the ticket. The task now shows a green done check. |

*Screenshot: Task dialog (Done) — Close button* (`20-close-task.png`)

---

## Section E — Return to the Sales Centre (Steps 21–22)

### Step 21: Send to Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Sales Centre**. |
| **Description** | Since this item was received from a sales centre and sent to the factory, send it back to the sales centre. The button appears once the task is done (you may need to refresh the page). |

*Screenshot: Ticket form — Send to Sales Centre button* (`21-send-to-sales-centre.png`)

### Step 22: Received at Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Sales Centre**. |
| **Description** | Accepts the item at the sales centre. |

*Screenshot: Ticket form — Received at Sales Centre button* (`22-received-at-sales-centre.png`)

---

## Section F — Dispatch (Steps 23–25)

### Step 23: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed repair item back to the customer. The button appears once the sales-centre receipt is done (you may need to refresh the page). |

*Screenshot: Ticket form — Dispatch button* (`23-dispatch.png`)

### Step 24: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the transfer: the item leaves for the customer. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`24-validate-dispatch.png`)

### Step 25: Close

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Close** to go to the ticket view. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close button* (`25-close.png`)

*Screenshot: Result: ticket in Handed Over to Customer, after the Close action* (`26-final-ticket.png`)

---

## QA notes

- Steps 1-17 follow the *Under Warranty (External not RUG) - Full Flow* (4A) guide: no Product selection and no **Create Serial No** step; the item is identified by an existing **Serial Number**, which fills in the Product. This tour has no warranty card step and no RUG steps. From the task onward the flow follows the *Tested OK* pattern: **Tested OK** replaces diagnosis / image / parts / quotation / deposit / deliveries / balance payment.
- The Serial Number field only offers serials already sold to a customer. The tour typed its own serial; as required by the test-data rules the automated run picks a serial of [JMC6] whose on-hand quantity is zero (this run used `0701_002`), skipping serials that still hold stock in a Repair location, which would make the receipt and the Dispatch fail. The Product field is filled from the serial.
- The tour selects the Return Receipt Location "Jinasena Ampara Branch"; the automated run selects its stock location `BR-AM/Stock`. The tour also has an *Open Task* click after **Create & View Task**; on this instance the task is already open at that point, so there is no separate step for it. The option selected for the Type is **Repair - Under Warranty - External not RUG**.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run clicks the real button, falls back to the same call via `/web/dataset/call_kw` if no picking appears, and validates the receipt through RPC (the receipt's Validate button is hidden by the Studio views). The receipt opens as a full page, so the Back screenshot (step 13) shows the Done receipt without a framed button.
- **Send to Sales Centre** and **Dispatch** become visible only after a full page reload once the previous action completes. A hash-only navigation does not refresh the record, so the automated flow uses `page.reload()` in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots (serial entered, final ticket) have no box. Screenshots come from one clean, fully-passing automated run (admin role): ticket `REPAIR/2026/01659`.
- The "Add Data" toast notifications on the Tested OK screenshot (diagnosis/image not set) are expected for this shortcut path; they do not block the flow.
- Every screenshot shows a red "Database neutralized for testing: no emails sent, etc." banner at the top. This is expected on the test database and is not part of the normal production screen.
