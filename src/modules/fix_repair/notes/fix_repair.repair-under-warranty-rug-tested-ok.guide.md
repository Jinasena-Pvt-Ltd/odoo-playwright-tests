### Type 1: Under Warranty - RUG — Tested OK

> Source: Odoo Tour Recorder export
> `Tour/2C. Repair User Guide - Factory [ Under Warranty - RUG - Tested Ok ].json`

---

## 1. Overview

This manual explains how to register and complete a **factory** repair for a product that is **under warranty** (RUG) when the technician finds the item **Tested OK** — nothing needs repairing. It runs from the Helpdesk ticket, through the factory and the sales centre, to dispatch back to the customer.

### Ticket stages covered

`New` → `Sent to Factory` → `Received at Factory` → `Repair Completed` → `Sent to Sales Centre` → `Received at Sales Centre` → `Handed Over to Customer`

### Before you start

- You have access to the Helpdesk, Field Service and Inventory apps.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the finished product (with its serial number, already sold through a sales order) already exist in Odoo.
- The customer has brought the item and a photo of the warranty card is available.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Under Warranty - RUG |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Factory Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Serial Number | 0630_008 (Product [JMC6] Multi Chopper 6Hp (Tractor Type) is filled automatically) |
| Warranty Card | Image of the customer's warranty card |
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
| A | 1–12 | Open Helpdesk, create the ticket, classify it as Under Warranty - RUG, enter the serial number and attach the warranty card. |
| B | 13–15 | Return the item into stock and validate the receipt. |
| C | 16–19 | Send the item to the factory, receive it there and create the Field Service task. |
| D | 20–22 | Mark the item Tested OK, mark the task done and close it. |
| E | 23–25 | Send the item to the sales centre, receive it there and open the task. |
| F | 26–28 | Dispatch the item back to the customer. |

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
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01643`) — the ticket has no user-editable title. |

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
| **Action** | In **Job Location**, select **Factory Repair**. |
| **Description** | Defines where the repair will be performed. **Factory Repair** means the item is sent to the factory, which adds the *Send to Factory* / *Received at Factory* steps. |

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
| **Action** | Click **Serial Number**, type the serial number of the finished product (e.g. `0630_008`) and select it from the list. |
| **Description** | Type the serial number of the finished product that was sold through a sales order; only serials already sold to a customer are offered. Selecting it fills in the **Product** automatically (here `[JMC6] Multi Chopper 6Hp (Tractor Type)`), so there is no separate Product step. |

*Screenshot: Ticket form — Serial Number field* (`10-serial-no.png`)

*Screenshot: Ticket form — Serial Number entered, Product filled in* (`10b-serial-entered.png`)

### Step 11: Open the Warranty Card tab

| | |
|---|---|
| **Navigation** | Ticket form → Warranty Details tab |
| **Action** | Click the **Warranty Details** tab. |
| **Description** | You must attach one or two images of the warranty card; this tab holds the **Warranty Card** image. |

*Screenshot: Ticket form — Warranty Details tab* (`11-warranty-card-tab.png`)

### Step 12: Attach the warranty card image

| | |
|---|---|
| **Navigation** | Ticket form → Warranty Details → Warranty Card |
| **Action** | Click the **Warranty Card** picture area, select the image file and click **Open**. |
| **Description** | Attaches the photo of the customer's warranty card to the ticket. |

*Screenshot: Ticket form — Warranty Card image field* (`12-warranty-card-image.png`)

*Screenshot: Ticket form — Warranty card attached* (`12b-warranty-card-attached.png`)

---

## Section B — Receive the Item (Steps 13–15)

### Step 13: Return

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Return**. |
| **Description** | Gets the repair item into our company: creates the Returned Picking (receipt) for the item. (The server also raises "You may only return Done pickings" after creating it; see the QA notes.) |

*Screenshot: Ticket form — Return button* (`13-return.png`)

### Step 14: Validate the receipt

| | |
|---|---|
| **Navigation** | Transfer (Receipt) → header |
| **Action** | Click **Validate**. |
| **Description** | Confirms that the item has been received into stock; the transfer becomes *Done*. |

*Screenshot: Transfer (Ready) — Validate button* (`14-validate-return.png`)

### Step 15: Back

| | |
|---|---|
| **Navigation** | Transfer (Done) |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous menu — the ticket view. The screenshot shows the receipt in the *Done* state; on this instance it opens as a full page, so there is no Back button to frame. |

*Screenshot: Transfer (Done)* (`15-back.png`)

---

## Section C — Send to the Factory and Plan the Task (Steps 16–19)

### Step 16: Send to Factory

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Factory**. |
| **Description** | Sends the item to the factory for repair; the ticket moves to *Sent to Factory*. |

*Screenshot: Ticket form — Send to Factory button* (`16-send-to-factory.png`)

### Step 17: Received at Factory

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Factory**. |
| **Description** | Confirms the item has arrived at the factory. |

*Screenshot: Ticket form — Received at Factory button* (`17-received-at-factory.png`)

### Step 18: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Plan Intervention**. |
| **Description** | To assign the job to a repair technician, create a Field Service task. |

*Screenshot: Ticket form — Plan Intervention button* (`18-plan-intervention.png`)

### Step 19: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the Field Service task and opens it so the technician can manage it. |

*Screenshot: Create a Field Service task dialog — Create & View Task button* (`19-create-view-task.png`)

---

## Section D — Complete the Task as Tested OK (Steps 20–22)

### Step 20: Tested OK

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Tested OK**. |
| **Description** | Use this when the technician finds the item works and needs no repair. It skips the diagnosis, parts, quotation and approval steps of the full flow (the "Add Data" reminders about diagnosis and image can be ignored). |

*Screenshot: Task dialog — Tested OK button* (`20-tested-ok.png`)

### Step 21: Mark as done

| | |
|---|---|
| **Navigation** | Task dialog → header |
| **Action** | Click **Mark as done**. |
| **Description** | The work on the task has been completed; this ends the task and the ticket moves to *Repair Completed*. |

*Screenshot: Task dialog — Mark as done button* (`21-mark-as-done.png`)

### Step 22: Close

| | |
|---|---|
| **Navigation** | Task dialog (Done) |
| **Action** | Click **Close**. |
| **Description** | Returns to the ticket. The task now shows a green done check. |

*Screenshot: Task dialog (Done) — Close button* (`22-close-task.png`)

---

## Section E — Return to the Sales Centre (Steps 23–25)

### Step 23: Send to Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Send to Sales Centre**. |
| **Description** | Since this item was received from a sales centre and sent to the factory, send it back to the sales centre. The button appears once the task is done (you may need to refresh the page). |

*Screenshot: Ticket form — Send to Sales Centre button* (`23-send-to-sales-centre.png`)

### Step 24: Received at Sales Centre

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Received at Sales Centre**. |
| **Description** | Accepts the item at the sales centre. |

*Screenshot: Ticket form — Received at Sales Centre button* (`24-received-at-sales-centre.png`)

### Step 25: Tasks

| | |
|---|---|
| **Navigation** | Ticket form → button box |
| **Action** | Click the **Tasks** button. |
| **Description** | Opens the task of this ticket. |

*Screenshot: Ticket form — Tasks button* (`25-tasks-final-invoice.png`)

---

## Section F — Dispatch (Steps 26–28)

### Step 26: Dispatch

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Dispatch**. |
| **Description** | Processes the completed repair item back to the customer. The button appears once the task is done (you may need to refresh the page). |

*Screenshot: Ticket form — Dispatch button* (`31-dispatch.png`)

### Step 27: Validate the dispatch

| | |
|---|---|
| **Navigation** | Returned Picking dialog → header |
| **Action** | Click **Validate**. |
| **Description** | Completes the return operation: the item leaves for the customer. |

*Screenshot: Returned Picking dialog (Ready) — Validate button* (`32-validate-dispatch.png`)

### Step 28: Back

| | |
|---|---|
| **Navigation** | Returned Picking dialog (Done) |
| **Action** | Click **Back** to go to the ticket view. |
| **Description** | The ticket is now in *Handed Over to Customer* — the repair is complete. |

*Screenshot: Transfer dialog (Done) — Back button* (`33-back-to-ticket.png`)

*Screenshot: Result: ticket in Handed Over to Customer, after the Back action* (`34-final-ticket.png`)

---

## QA notes

- Steps 1-19 follow the "Approved Full Flow" (2A) guide: **Serial Number** and **Warranty Card** instead of *Create Serial No*. From the task onward this flow follows the Tested OK guide (1B): **Tested OK** replaces diagnosis / image / parts / quotation / RUG approval / deliveries.
- The Serial Number field only offers serials already sold to a customer. The tour typed its own serial; the automated run picks a sold serial of the product with zero on-hand quantity and a clean history (this run used `0630_008`). The Product field is filled from the serial, so there is no separate Product step.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run swallows the error, then validates the receipt via `/web/dataset/call_kw` (the picking's Validate button is hidden/unreliable under the Studio views). The receipt opens as a full page, so the Back screenshot (step 15) shows the Done receipt without a framed button.
- **Send to Sales Centre** and **Dispatch** become visible only after a full page reload once the previous action completes. A hash-only navigation does not refresh the record, so the automated flow uses `page.reload()` in a polling loop.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots (serial entered, warranty card attached, final ticket) have no box. Screenshots come from one clean, passing automated run against the staging instance.
- The "Add Data" toast notifications on the Tested OK screenshot (diagnosis/image not set) are expected for this shortcut path; they do not block the flow.
- The staging database is a temporary Odoo.sh environment, automatically deleted on 12 October 2026; regenerate the screenshots on the production instance if needed.
