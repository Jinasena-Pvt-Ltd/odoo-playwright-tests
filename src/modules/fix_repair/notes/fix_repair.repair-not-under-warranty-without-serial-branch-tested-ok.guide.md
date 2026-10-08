# Repair User Guide — Branch
## Type 2: Not Under Warranty (Without Serial No.) — Tested OK (Centre Repair)

> Source: Odoo Tour Recorder export
> `Tour/1D. Repair User Guide - Branch [ Not Under Warranty (Without Serial No ) - Tested Ok ].json`

---

## 1. Overview

This manual explains how to register and complete a **branch (Centre Repair)** repair for an out-of-warranty product with **no serial number** when the technician finds the item **Tested OK**, from the Helpdesk ticket through to dispatch.

### Ticket stages covered

`New` → `Diagnosis` → `Repair Completed` → `Handed Over to Customer`

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
| Repair Reason | Low Pressue |
| Job Location | Centre Repair |
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
| A | 1–11 | Open Helpdesk, create the ticket, classify it (branch Centre Repair), and generate a temporary serial number. |
| B | 12–14 | Return the item into stock and validate the receipt. |
| C | 15–16 | Plan the intervention and create the Field Service task (no factory transfer for a Centre Repair). |
| D | 17–21 | Close and reopen the task, mark the item Tested OK and mark the task done. |
| E | 22–24 | Dispatch the item back to the customer, validate the transfer and finish. |

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


---

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


---

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


---

## Section D — Tested OK and Complete the Task (Steps 17–21)

### Step 17: Close the task dialog

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Close** (the X in the top-right corner). |
| **Description** | The new task is created and linked to the ticket. Close the dialog to return to the ticket; the task is reopened from the ticket in the next step. (If the grey *Add Data* reminders about diagnosis and image are on screen, dismiss them first.) |

*Screenshot: Task dialog — Close button* (`17-close-task-dialog.png`)


### Step 18: Open the task from the ticket

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click **Tasks**. |
| **Description** | Opens the repair task linked to this ticket. |

*Screenshot: Ticket form — Tasks button* (`18-tasks.png`)


### Step 19: Tested OK

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Tested OK**. |
| **Description** | Use this when the technician finds the item works and needs no repair. It skips the diagnosis, parts, quotation and payment steps of the full flow (the *Add Data* reminders about diagnosis and image can be ignored). |

*Screenshot: Task dialog — Tested OK button* (`19-tested-ok.png`)


### Step 20: Mark as done

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Mark as done**. |
| **Description** | Closes the work on the task; the ticket moves to *Repair Completed*. |

*Screenshot: Task dialog — Mark as done button* (`20-mark-as-done.png`)


### Step 21: Close the task

| | |
|---|---|
| **Navigation** | Task dialog (done) |
| **Action** | Click **Close** to go back to the ticket. |
| **Description** | The task now shows a green done check. Closing the dialog returns to the ticket, where the **Dispatch** button is available. |

*Screenshot: Task dialog (done) — Close button* (`21-close-task.png`)


---

## Section E — Dispatch to the Customer (Steps 22–24)

### Step 22: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed repair item back to the customer. Because this is a Centre Repair, the item goes straight back to the customer from the branch — there is no Send to / Received at Sales Centre leg. (The button can take a moment to appear; refresh the page if it is not shown.) |

*Screenshot: Ticket form — Dispatch button* (`22-dispatch.png`)


### Step 23: Validate the dispatch

| | |
|---|---|
| **Navigation** | Transfer dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the outgoing transfer of the repaired item to the customer. |

*Screenshot: Transfer dialog (Ready) — Validate button* (`23-validate-dispatch.png`)


### Step 24: Close

| | |
|---|---|
| **Navigation** | Transfer dialog (Done) |
| **Action** | Click **Close** to go to the ticket view. |
| **Description** | The transfer is Done and the ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close button* (`24-close.png`, `25-final-ticket.png`)


---

## QA notes

- Steps 1–16 are identical to the Branch "Full Flow" (1C) guide: Repair Reason *Low Pressue*, Job Location **Centre Repair** (no Send to / Received at Factory). From the task onward this guide follows the "Tested OK" ending of the Factory guide (1B) — but because this is a Centre Repair the item is dispatched straight from the branch (no Send to / Received at Sales Centre).
- There is **no quotation, deposit, delivery chain or balance payment** in this flow — the technician marks the item Tested OK and the item is returned as is.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run calls it, swallows the error, then validates the resulting picking via `/web/dataset/call_kw` (the Validate button is hidden/unreliable under the Studio views).
- The last two recorded tour steps (a `Vendor Group` dropdown and one of its entries) could not be reproduced: the Vendor Group field does not exist on the Helpdesk ticket (it exists only on Contacts and Users, and is not shown on this customer's Contact form), so they are treated as recorder artefacts and have no screenshot. Please confirm with the tour author where this field was meant to be used.
- In the recorded tour, the task is closed (step 17) and reopened from the ticket (step 18) before Tested OK; the guide follows that order. **Dispatch** becomes visible only after the task is done and the page has fully refreshed, so the automated flow reloads in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture). Screenshots come from one clean, fully-passing automated run (admin role) against the staging instance.
- The staging database is a temporary Odoo.sh environment, automatically deleted on 12 October 2026; regenerate the screenshots on the production instance if needed.
