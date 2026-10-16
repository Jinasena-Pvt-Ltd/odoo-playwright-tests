# Repair User Guide — Change to RUG
## Type 5: Under Warranty (External not RUG) To Under Warranty - RUG

> Source: Odoo Tour Recorder export
> `Tour/5A. Repair User Guide - Under Warranty ( External not RUG )  To Under Warranty - RUG.json`

---

## 1. Overview

This manual explains how to **change** a repair ticket that was started under the **Under Warranty (External not RUG)** type to the **Under Warranty - RUG** type. The ticket is created at the receiving branch for a Factory Repair, and while it is still of type External not RUG the **Change to RUG** button is used. Because the RUG facility requires proof of warranty, the **Warranty Details** tab must then be completed by attaching the warranty card, after which the normal RUG process continues with **Return**.

### When the type can be changed

1. At the time the ticket was created, before the return was received (shown in this manual).
2. After receiving the return, before sending it to the factory.
3. After being sent from the centre, and before being received at the factory.
4. After receiving from the factory, and before creating a task.

After any one of these cases, the warranty details must be attached, then the normal RUG process is followed.

### Ticket stages covered

`New`

### Before you start

- You have access to the Helpdesk app.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the finished product (with its serial number, already sold through a sales order) already exist in Odoo.
- A picture of the customer's warranty card is available on your computer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type (initial) | Repair - Under Warranty - External not RUG |
| Type (after Change to RUG) | Repair - Under Warranty - RUG |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Factory Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Serial Number | 0701_002 (Product [JMC6] Multi Chopper 6Hp (Tractor Type) is filled automatically) |
| Warranty Card | Picture of the customer's warranty card |

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
| A | 1–10 | Open Helpdesk, create the ticket as Under Warranty (External not RUG) and select the serial number. |
| B | 11 | Change the ticket type to Under Warranty - RUG. |
| C | 12–13 | Attach the warranty card in the Warranty Details tab. |
| D | 14 | Return, and continue with the normal RUG process. |

---

## Section A — Create the Repair Ticket under External not RUG (Steps 1–10)

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
| **Description** | Opens a blank Helpdesk ticket form for the repair item. |

*Screenshot: All Tickets list — New button* (`03-new-button.png`)

### Step 4: Assign the ticket to yourself

| | |
|---|---|
| **Navigation** | New ticket form |
| **Action** | Click **Assign to Me** in the status bar. |
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name (e.g. `REPAIR/2026/01681`). |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)

### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Under Warranty - External not RUG**. |
| **Description** | The ticket is first registered as an Under Warranty (External not RUG) repair. The item is identified by an existing Serial Number. |

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
| **Description** | A list of common errors is provided; select the ones that apply. |

*Screenshot: Ticket form — Repair Reason field* (`07-repair-reason.png`)

### Step 8: Select the Job Location

| | |
|---|---|
| **Navigation** | Ticket form → Job Location field |
| **Action** | In **Job Location**, select **Factory Repair**. |
| **Description** | Defines where the repair will be performed. **Factory Repair** means the item is repaired at the factory. |

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
| **Description** | Select the correct serial number. Only serials already sold to a customer are offered. Selecting it fills in the **Product** automatically (here `[JMC6] Multi Chopper 6Hp (Tractor Type)`). |

*Screenshot: Ticket form — Serial Number field* (`10-serial-no.png`)
*Screenshot: Ticket form — Serial Number entered, Product filled in* (`10b-serial-entered.png`)

## Section B — Change the Type to RUG (Step 11)

### Step 11: Change to RUG

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Change to RUG**. |
| **Description** | If you have met the qualifications required to receive the RUG facility at this point, or if a higher official has approved it, you can change the repair type with this button. The Type of the ticket changes from *Repair - Under Warranty - External not RUG* to **Repair - Under Warranty - RUG** (see the Type field in the later screenshots) and the **Warranty Details** tab becomes mandatory. |

*Screenshot: Ticket form — Change to RUG button* (`11-change-to-rug.png`)

## Section C — Attach the Warranty Details (Steps 12–13)

### Step 12: Open the Warranty Details tab

| | |
|---|---|
| **Navigation** | Ticket form → Warranty Details tab |
| **Action** | Click the **Warranty Details** tab (it is marked as required). |
| **Description** | Warranty details must be attached because the ticket is now a RUG repair. |

*Screenshot: Ticket form — Warranty Details tab* (`12-warranty-details-tab.png`)

### Step 13: Attach the warranty card

| | |
|---|---|
| **Navigation** | Ticket form → Warranty Details → Warranty Card |
| **Action** | Click **Take a Picture** under **Warranty Card**, go to the location of the image, select the warranty card image and click **Open**. |
| **Description** | Attaches a picture of the customer's warranty card to the ticket. |

*Screenshot: Warranty Details tab — Warranty Card Take a Picture button* (`13-take-a-picture.png`)
*Screenshot: Warranty Details tab — Warranty Card attached* (`13b-warranty-card-attached.png`)

## Section D — Continue with the RUG process (Step 14)

### Step 14: Return

| | |
|---|---|
| **Navigation** | Ticket form → status bar |
| **Action** | Click **Return** and continue with the normal RUG process. |
| **Description** | Records the item being received from the customer by creating the Returned Picking (receipt). The ticket is now of type **Repair - Under Warranty - RUG**, so from here the repair follows the normal RUG process. This is where this tour ends. (The server also raises "You may only return Done pickings" after creating the picking; see the QA notes.) |

*Screenshot: Ticket form (Type now Under Warranty - RUG) — Return button* (`14-return.png`)

---

## QA Notes

- This tour is about **converting** a ticket from *Under Warranty - External not RUG* to *Under Warranty - RUG*. The tour description lists four moments when this can be done (at ticket creation before the return is received; after receiving the return but before sending to the factory; after sending from the centre but before receipt at the factory; after receiving from the factory but before creating a task); this example follows the first one. After the change the warranty details must be attached, then the normal RUG process is followed. The tour ends at the **Return** click.
- The Serial Number field only offers serials already sold to a customer. The tour typed its own serial (`0207_001`); as required by the test-data rules the automated run picks a serial of [JMC6] whose on-hand quantity is zero (this run used `0701_002`), skipping serials that still hold stock in a Repair location from earlier unfinished runs.
- The tour selects the Return Receipt Location "Jinasena Ampara Branch"; the automated run selects its stock location `BR-AM/Stock`.
- The **Change to RUG** button (`action_change_to_rug`) is visible in the status bar while the ticket is still of type External not RUG. After clicking it the run verifies through RPC that the ticket type is "Repair - Under Warranty - RUG" (the step 14 screenshot shows the changed Type).
- The Warranty Card picture is attached by sending `WarrantyCard.jpg` to the field's hidden file input (the native file chooser opened by **Take a Picture** cannot be driven by the screenshot flow). The Warranty Details tab is highlighted as required in the screenshot of step 12.
- The **Return** button (`fix_repair_action_direct_return`) raises "You may only return Done pickings" server-side but still creates the Returned Picking first. The automated run clicks the real button and falls back to the same call via `/web/dataset/call_kw` if no picking appears, then checks that a return picking exists (this run created picking id 21061). The tour ends here, so the receipt is not validated in this guide.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots (serial entered, warranty card attached) have no box. Screenshots come from one clean, passing automated run (admin role): ticket `REPAIR/2026/01681`, 14 steps, 16 screenshots.
- Every screenshot shows a red "Database neutralized for testing: no emails sent, etc." banner at the top. This is expected on the test database and is not part of the normal production screen.
