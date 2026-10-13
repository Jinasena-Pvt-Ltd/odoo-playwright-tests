# Repair User Guide — Branch
## Type 1: Under Warranty - RUG - Tested OK

> Source: Odoo Tour Recorder export
> `Tour/2F. Repair User Guide - Branch [ Under Warranty - RUG - Tested Ok ].json`

---

## 1. Overview

This manual explains how to register and complete a **branch** (Centre Repair) repair for a product that is **under warranty** (RUG) and is found to be working (**Tested OK**), from the Helpdesk ticket through the repair task to dispatch back to the customer.

### Ticket stages covered

`New` → `Plan Intervention` → `Task done` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service and Inventory apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the finished product (with its serial number, already sold through a sales order) already exist in Odoo.
- The customer has brought the item to the branch and a photo of the warranty card is available.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Under Warranty - RUG |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Centre Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Serial Number | 0630_009 (Product [JMC6] Multi Chopper 6Hp (Tractor Type) is filled automatically) |
| Warranty Card | Image of the customer's warranty card |
| Result | Tested OK - no paid repair, item dispatched back to the customer |

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
| A | 1–12 | Open Helpdesk, create the ticket, classify it as Under Warranty - RUG, enter the serial number and attach the warranty card. |
| B | 13–15 | Return the item into stock and validate the receipt. |
| C | 16–17 | Create the Field Service task for the repair technician. |
| D | 18–20 | The technician confirms the item works, marks the task as done and closes it. |
| E | 21–23 | Dispatch the tested item back to the customer. |

---

## Section A — Create the Repair Ticket (Steps 1–12)

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
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01645`) — the ticket has no user-editable title. |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)

### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Under Warranty - RUG**. |
| **Description** | Selects the *Under Warranty - RUG* flow: the product is still under warranty and the repair is carried out at the company's cost under the RUG facility. For this type a **Serial Number** and a photo of the **Warranty Card** are required (there is no *Create Serial No* button). |

*Screenshot: Ticket form — Type field* (`05-repair-type.png`)

### Step 6: Set the Return Receipt Location

| | |
|---|---|
| **Navigation** | Ticket form → Return Receipt Location field |
| **Action** | Click **Return Receipt Location** and select the branch receiving the item (e.g. `BR-AM/Stock`, Jinasena Ampara Branch). |
| **Description** | The location where the item is received for repair. |

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
| **Description** | Defines where the repair will be performed. **Centre Repair** means the repair is done at the branch repair centre itself. |

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
| **Action** | Click **Serial Number**, type the serial number of the finished product (e.g. `0630_009`) and select it from the list. |
| **Description** | Type the serial number of the finished product that was sold through a sales order; only serials already sold to a customer are offered. Selecting it fills in the **Product** automatically (here `[JMC6] Multi Chopper 6Hp (Tractor Type)`), so there is no separate Product step. |

*Screenshot: Ticket form — Serial Number field* (`10-serial-no.png`)

*Screenshot: Ticket form — Serial Number entered, Product filled in* (`10b-serial-entered.png`)

### Step 11: Open the Warranty Card tab

| | |
|---|---|
| **Navigation** | Ticket form → Warranty Details tab |
| **Action** | Click the **Warranty Details** tab. |
| **Description** | It is mandatory to attach one or two images of the warranty card; this tab holds the **Warranty Card** image. |

*Screenshot: Ticket form — Warranty Details tab* (`11-warranty-card-tab.png`)

### Step 12: Attach the warranty card image

| | |
|---|---|
| **Navigation** | Ticket form → Warranty Details → Warranty Card |
| **Action** | Click the **Warranty Card** picture area, select the image file and click **Open**. |
| **Description** | Attaches the photo of the customer's warranty card to the ticket. The image is mandatory for this repair type. |

*Screenshot: Ticket form — Warranty Card image field* (`12-warranty-card-image.png`)

*Screenshot: Ticket form — Warranty card attached* (`12b-warranty-card-attached.png`)

---

## Section B — Receive the Item (Steps 13–15)

### Step 13: Return

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Return**. |
| **Description** | Creates the return operation: the Returned Picking (receipt) for the item. (The server also raises "You may only return Done pickings" after creating it; see the QA notes.) |

*Screenshot: Ticket form — Return button* (`13-return.png`)

### Step 14: Validate the receipt

| | |
|---|---|
| **Navigation** | Transfer (Receipt) → header |
| **Action** | Click **Validate**. |
| **Description** | Validates the return operation: the item is received into stock and the transfer becomes *Done*. |

*Screenshot: Transfer (Ready) — Validate button* (`14-validate-return.png`)

### Step 15: Back

| | |
|---|---|
| **Navigation** | Transfer (Done) |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous menu — the ticket view. The screenshot shows the receipt in the *Done* state; on this instance it opens as a full page, so there is no Back button to frame. |

*Screenshot: Transfer (Done)* (`15-back.png`)

---

## Section C — Plan the Task (Steps 16–17)

### Step 16: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Plan Intervention**. |
| **Description** | To assign the job to a repair technician, create a Field Service task. Because the Job Location is *Centre Repair*, the ticket goes straight to this step once the item is received. |

*Screenshot: Ticket form — Plan Intervention button* (`16-plan-intervention.png`)

### Step 17: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the Field Service task and opens it so the technician can manage it. |

*Screenshot: Create a Field Service task dialog — Create & View Task button* (`17-create-view-task.png`)

---

## Section D — Tested OK and Task Completion (Steps 18–20)

### Step 18: Tested OK

| | |
|---|---|
| **Navigation** | Task form (opened by Create & View Task) → header |
| **Action** | Click **Tested OK**. |
| **Description** | If the repair item can be restored to its original condition through a process that has no monetary value, the item can be returned to the customer under this facility. The item is tested and found to be working, so it needs no paid repair. |

*Screenshot: Task form — Tested OK button* (`18-tested-ok.png`)

### Step 19: Mark as done

| | |
|---|---|
| **Navigation** | Task form → header |
| **Action** | Click **Mark as done**. |
| **Description** | Ends the task: the work on it has been completed. |

*Screenshot: Task form — Mark as done button* (`19-mark-as-done.png`)

### Step 20: Close the task

| | |
|---|---|
| **Navigation** | Task form (Done) |
| **Action** | Click **Close**. |
| **Description** | Closes the task window and returns to the ticket. |

*Screenshot: Task (Done) — Close* (`20-close-task.png`)

---

## Section E — Dispatch (Steps 21–23)

### Step 21: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed item back to the customer. The button appears once the task is done (you may need to refresh the page). |

*Screenshot: Ticket form — Dispatch button* (`21-dispatch.png`)

### Step 22: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the return operation: the item leaves for the customer. The transfer becomes *Done*. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`22-validate-dispatch.png`)

### Step 23: Close

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Close** to go to the ticket view. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Close* (`23-close.png`)

*Screenshot: Result: ticket after the Close action* (`24-final-ticket.png`)

---

## QA notes

- This **Branch** variant of the Under Warranty - RUG flow uses **Job Location = Centre Repair**: after the item is received the ticket goes straight to **Plan Intervention**. The ticket needs a **Serial Number** and a **Warranty Card** image. The repair ends with **Tested OK** on the task, **Mark as done**, and **Dispatch** of the item back to the customer.
- The Serial Number field only offers serials already sold to a customer. The tour typed its own serial; as required by the test-data rules the automated run picks a serial of [JMC6] whose on-hand quantity is zero (this run used `0630_009`), skipping serials that still hold stock in a Repair location from earlier unfinished runs, which would make the final Dispatch fail. The Product field is filled from the serial, so there is no separate Product step.
- The tour and the test-data rules agree on the Repair Reason (`Difficult to start the engine`) and the customer. The Warranty Card image is uploaded from the project's `WarrantyCard.jpg`. The tour's photo step on the Warranty Details tab is the warranty card upload.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run clicks the real button, falls back to the same call via `/web/dataset/call_kw` if no picking appears, and validates the receipt through RPC (the receipt's Validate button is unreliable under the Studio views). The receipt opens as a full page, so the Back screenshot (step 15) shows the Done receipt without a framed button.
- After **Create & View Task** the task window stays open and **Tested OK** is clicked directly in it. The **Dispatch** button appears only after a full page reload once the task is done, so the automated flow reloads in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots (serial entered, warranty card attached, final ticket) have no box. Screenshots come from one clean, fully-passing automated run (admin role).
- Every screenshot shows a red "Database neutralized for testing: no emails sent, etc." banner at the top. This is expected on the test database and is not part of the normal production screen.
