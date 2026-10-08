# Repair User Guide — Factory
## Type 2: Not Under Warranty (Without Serial No.) — Tested OK

> Source: Odoo Tour Recorder export
> `Tour/1B. Repair User Guide - Factory [ Not Under Warranty (Without Serial No ) - Tested Ok ].json`

---

## 1. Overview

This manual explains how to register and complete a factory repair for an out-of-warranty product with **no serial number** when the technician finds the item **Tested OK** — nothing needs repairing. The process runs from the Helpdesk ticket at the receiving branch, through the factory, and ends when the item is dispatched back to the customer.

### Ticket stages covered

`New` → `Sent to Factory` → `Received at Factory` → `Repair Completed` → `Sent to Sales Centre` → `Received at Sales Centre` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service and Inventory apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and product already exist in Odoo (Contacts and Product Master).
- The item has been physically brought to the branch by the customer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Not Under Warranty (Without Serial No.) |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Factory Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Product | [JMC6] Multi Chopper 6Hp (Tractor Type) |
| Repair result | Tested OK (no parts, quotation or payment) |

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
| A | 1–11 | Open Helpdesk, create the ticket, classify it, and generate a temporary serial number. |
| B | 12–14 | Return the item into stock and validate the receipt. |
| C | 15–18 | Send to and receive at the factory, then create the Field Service task. |
| D | 19–21 | Mark the item Tested OK, mark the task done, and return to the ticket. |
| E | 22–26 | Send via the sales centre, dispatch, and validate the return to the customer. |

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
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01601`) — the ticket has no user-editable title. |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)


### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Not Under Warranty (Without Serial No.)**. |
| **Description** | Classifies items whose warranty has expired and that have no serial number. The field is a many2one autocomplete listing the repair types configured in Studio. |

*Screenshot: Ticket form — Type field* (`05-repair-type.png`)


### Step 6: Set the Return Receipt Location

| | |
|---|---|
| **Navigation** | Ticket form → Return Receipt Location field |
| **Action** | Click **Return Receipt Location** and select the branch receiving the item (e.g. `BR-AM/Stock`, Jinasena Ampara Branch). |
| **Description** | The location where the repaired item will be received back for the customer. |

*Screenshot: Ticket form — Return Receipt Location field* (`06-return-receipt.png`)


### Step 7: Select the Repair Reason

| | |
|---|---|
| **Navigation** | Ticket form → Repair Reason field |
| **Action** | Click **Repair Reason** and select the reported fault (e.g. `Difficult to start the engine`). |
| **Description** | Choose the common error that best matches the customer's complaint. This is a many2many tags field; at least one reason is required before the item can be returned. |

*Screenshot: Ticket form — Repair Reason field* (`07-repair-reason.png`)


### Step 8: Select the Job Location

| | |
|---|---|
| **Navigation** | Ticket form → Job Location field |
| **Action** | In **Job Location**, select **Factory Repair**. |
| **Description** | Defines where the repair is performed. Factory Repair routes the item through Send to Factory / Received at Factory. |

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
| **Description** | Records the item being physically received from the customer by creating a Returned Picking (e.g. `BR-AM/RET/00759`) in the Ready state. |

*Screenshot: Ticket form — Return button* (`12-return.png`)


### Step 13: Validate the receipt

| | |
|---|---|
| **Navigation** | Returned Picking → status bar |
| **Action** | Click **Validate**. |
| **Description** | Confirms the item has arrived into the repair stock location. The ticket cannot move to the factory until this picking is Done. |

*Screenshot: Returned Picking (Ready) — Validate button* (`13-validate-return.png`)


### Step 14: Close the picking and return to the ticket

| | |
|---|---|
| **Navigation** | Returned Picking → Close |
| **Action** | Click **Close** (or the breadcrumb) to return to the ticket. |
| **Description** | Takes you back to the ticket, where **Send to Factory** is now available. No separate screenshot exists for this step: on this instance the picking opens as a full page, not a dialog, so there is no distinct "Close" screen. |

*No screenshot for this step.*


## Section C — Send to Factory and Create the Task (Steps 15–18)

### Step 15: Send to Factory

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Factory**. |
| **Description** | Sends the item to the factory for repair; the ticket moves to *Sent to Factory*. |

*Screenshot: Ticket form — Send to Factory button* (`15-send-to-factory.png`)


### Step 16: Received at Factory

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Factory**. |
| **Description** | Confirms the factory has received the item; the ticket moves to *Received at Factory*. |

*Screenshot: Ticket form — Received at Factory button* (`16-received-at-factory.png`)


### Step 17: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Plan Intervention**. |
| **Description** | Starts creating a Field Service task for the repair technician. |

*Screenshot: Ticket form — Plan Intervention button* (`17-plan-intervention.png`)


### Step 18: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the task (same name as the ticket) and opens it in a dialog on top of the ticket. |

*Screenshot: Create a Field Service task dialog — Create & View Task button* (`18-create-view-task.png`)


## Section D — Complete the Task as Tested OK (Steps 19–21)

### Step 19: Tested OK

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Tested OK**. |
| **Description** | Use this when the technician finds the item works and needs no repair. It skips the diagnosis, parts, quotation and payment steps of the full flow (the "Add Data" reminders about diagnosis and image can be ignored). |

*Screenshot: Task dialog — Tested OK button* (`19-tested-ok.png`)


### Step 20: Mark as done

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Mark as done**. |
| **Description** | Closes the work on the task; the ticket moves to *Repair Completed*. |

*Screenshot: Task dialog — Mark as done button* (`20-mark-as-done.png`)


### Step 21: Back to the ticket

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Back**. |
| **Description** | Returns to the ticket. The task now shows a green done check. |

*Screenshot: Task dialog (done) — Back button* (`21-back.png`)


## Section E — Return to the Customer (Steps 22–26)

### Step 22: Send to Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Sales Centre**. |
| **Description** | Sends the tested item back to the sales centre. The button can take a few seconds to appear after the task is closed — reload the ticket if it is not yet shown. |

*Screenshot: Ticket form (Repair Completed) — Send to Sales Centre button* (`22-send-to-sales-centre.png`)


### Step 23: Received at Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Sales Centre**. |
| **Description** | Confirms the sales centre has the item back; the ticket moves to *Received at Sales Centre*. |

*Screenshot: Ticket form — Received at Sales Centre button* (`23-received-at-sales-centre.png`)


### Step 24: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Hands the item back to the customer. Because the result is Tested OK, no payment is needed first. This opens a Returned Picking for the item. The button can lag a few seconds — reload if needed. |

*Screenshot: Ticket form (Received at Sales Centre) — Dispatch button* (`24-dispatch.png`)


### Step 25: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the outgoing transfer of the repaired item to the customer. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`25-validate-dispatch.png`)


### Step 26: Close

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Close** (the X) to return to the ticket. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close button* (`26-close.png`)

*Screenshot: Result: ticket in Handed Over to Customer, after the Close action* (`27-final-ticket.png`)


---

## QA notes

- Steps 1-18 are identical to the "Full Flow" (1A) guide; only the task-completion and return legs (steps 19-26) differ: **Tested OK** replaces diagnosis / image / parts / quotation / deposit / delivery chain / balance payment.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run calls it, swallows the error, then validates the resulting picking via `/web/dataset/call_kw` (the picking's Validate button is hidden/unreliable under the Studio views).
- The Returned Picking opens as a full page here (not a dialog), so the tour step "Close" after the first Validate has no separate screen; the dispatch Validate/Close at the end do use a dialog.
- **Send to Sales Centre** and **Dispatch** become visible only after a full page reload once the previous action completes (computed `task_done` / stage state). A hash-only navigation does not refresh the record, so the automated flow uses `page.reload()` in a polling loop.
- The tour records **Tested OK** by `button[name="2316"]` (an action id that differs per database); the automated flow matches it by its label instead. **Mark as done** / **Validate** use `data-hotkey="v"` in the tour; the flow matches by label.
- Repair Reason is selected before Customer/Product (tour order); Customer and Product each trigger an onchange re-render, so the flow waits about 1 second after each commit.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture). Screenshots come from one clean, fully-passing automated run against the staging instance.
- The "Add Data" toast notifications on the Tested OK screenshot (diagnosis/image not set) are expected for this shortcut path; they do not block the flow.
- The staging database is a temporary Odoo.sh environment, automatically deleted on 12 October 2026; regenerate the screenshots on the production instance if needed.
