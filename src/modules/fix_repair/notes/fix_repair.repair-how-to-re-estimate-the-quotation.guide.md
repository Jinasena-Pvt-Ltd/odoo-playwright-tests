# Repair User Guide — How to Re-Estimate the Repair Quotation
## Type 6: Re-estimating a repair quotation (applies to any repair type)

> Source: Odoo Tour Recorder export
> `Tour/6. Repair User Guide - How to Re-Estimate the Repair Quotation.json`

---

## 1. Overview

This manual describes the procedure to follow when a quotation for **any repair type** needs to be **re-estimated**. To reach a quotation that can be re-estimated, a ticket of type **Repair - Not Under Warranty (Without Serial No)** is created, received, repaired at the factory, and its quotation is sent to the customer.

### Situations where re-estimation is possible

1. After the customer approved (confirmed) the quotation.
2. After the sales order is confirmed (the sales order must first be **unlocked**).

Both situations are shown in this manual.

### Before you start

- You have access to the Helpdesk app.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The customer and the product exist in Odoo, and a picture of the repair item is available on your computer.

### Example data used in this manual

| Field | Value |
|---|---|
| Type | Repair - Not Under Warranty (Without Serial No) |
| Return Receipt Location | BR-AM/Stock (Jinasena Ampara Branch) |
| Repair Reason | Difficult to start the engine |
| Job Location | Factory Repair |
| Customer | KURUNEGALA CASH CUSTOMER |
| Product | [JMC6] Multi Chopper 6Hp (Tractor Type) |
| Spare part on the quotation | [02BB 023] BALL BEARING 6202-2RS |

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
| A | 1–10 | Open Helpdesk and create the ticket (Not Under Warranty, Without Serial No, Factory Repair). |
| B | 11–14 | Create the temporary serial number, Return the item and validate the receipt. |
| C | 15–18 | Send the item to the factory, receive it there and create the repair task. |
| D | 19–31 | Record the diagnosis, attach the repair image and add the spare part to the quotation. |
| E | 32–37 | Open the quotation, send it by email and let the customer approve it. |
| F | 38–50 | Re-estimate the approved quotation, raise the quantity, resend it and have it approved again. |
| G | 51–55 | Confirm the re-estimated sales order; the delivery orders are created. |
| H | 56–70 | Unlock, re-estimate, raise the quantity, resend, approve and confirm the sales order again. |

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

*Screenshot: Helpdesk Overview — Tickets button* (`02-tickets-button.png`)

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
| **Description** | Saves the ticket for the first time and assigns it to the current user. This also generates the ticket's sequence-based name. |

*Screenshot: Blank new ticket form — Assign to Me button* (`04-assign-to-me.png`)

### Step 5: Set the repair Type

| | |
|---|---|
| **Navigation** | Ticket form → Type field |
| **Action** | Click the **Type** field and select **Repair - Not Under Warranty (Without Serial No)**. |
| **Description** | Items that are not within the warranty period and for which a serial number cannot be found are accepted under this type. |

*Screenshot: Ticket form — Type field* (`05-repair-type.png`)

### Step 6: Set the Return Receipt Location

| | |
|---|---|
| **Navigation** | Ticket form → Return Receipt Location field |
| **Action** | Click **Return Receipt Location** and select `BR-AM/Stock` (Jinasena Ampara Branch). |
| **Description** | Select the location where you would like to receive the product for repair. |

*Screenshot: Ticket form — Return Receipt Location field* (`06-return-receipt.png`)

### Step 7: Select the Repair Reason

| | |
|---|---|
| **Navigation** | Ticket form → Repair Reason field |
| **Action** | Click **Repair Reason** and select `Difficult to start the engine`. |
| **Description** | A list of common errors is provided; select the ones that apply. |

*Screenshot: Ticket form — Repair Reason field* (`07-repair-reason.png`)

### Step 8: Select the Job Location

| | |
|---|---|
| **Navigation** | Ticket form → Job Location field |
| **Action** | Click **Job Location** and select **Factory Repair**. |
| **Description** | Select the location where the repair will be performed. In this example the repair is done at the factory. |

*Screenshot: Ticket form — Job Location field* (`08-job-location.png`)

### Step 9: Select the Customer

| | |
|---|---|
| **Navigation** | Ticket form → Customer field |
| **Action** | Click **Customer**, type `KURUNEGALA CASH CUSTOMER` and select it. |
| **Description** | The customer who owns the repair item. |

*Screenshot: Ticket form — Customer field* (`09-customer.png`)

### Step 10: Select the Product

| | |
|---|---|
| **Navigation** | Ticket form → Product field |
| **Action** | Click **Product**, type `JMC6` and select **[JMC6] Multi Chopper 6Hp (Tractor Type)**. |
| **Description** | The repair product, taken from the Product Master. |

*Screenshot: Ticket form — Product field* (`10-product.png`)

---

## Section B — Receive the Item (Steps 11–14)

### Step 11: Create Serial No

| | |
|---|---|
| **Navigation** | Ticket form (status bar) |
| **Action** | Click **Create Serial No**. |
| **Description** | The selected repair type has no serial number, so a temporary serial number must be created for the item. |

*Screenshot: Ticket form — Create Serial No button* (`11-create-serial.png`)

### Step 12: Return (receive the item)

| | |
|---|---|
| **Navigation** | Ticket form (status bar) |
| **Action** | Click **Return**. |
| **Description** | Brings the repair item to our company by creating the receipt (Returned Picking). |

*Screenshot: Ticket form — Return button* (`12-return.png`)

### Step 13: Validate the receipt

| | |
|---|---|
| **Navigation** | Returned Picking form |
| **Action** | Click **Validate**. |
| **Description** | Confirms that the item has been received. |

*Screenshot: Returned Picking — Validate button* (`13-validate-return.png`)

### Step 14: Close the receipt

| | |
|---|---|
| **Navigation** | Returned Picking |
| **Action** | Click **Close** (or Back) to return to the ticket. |
| **Description** | Returns to the previous menu, the repair ticket. |

*Screenshot: Returned Picking — Close button* (`14-close-return.png`)

---

## Section C — Factory and Task (Steps 15–18)

### Step 15: Send to Factory

| | |
|---|---|
| **Navigation** | Ticket form (status bar) |
| **Action** | Click **Send to Factory**. |
| **Description** | Sends the item to the factory for repair. |

*Screenshot: Ticket form — Send to Factory button* (`15-send-to-factory.png`)

### Step 16: Received at Factory

| | |
|---|---|
| **Navigation** | Ticket form (status bar) |
| **Action** | Click **Received at Factory**. |
| **Description** | Confirms that the item has arrived at the factory. |

*Screenshot: Ticket form — Received at Factory button* (`16-received-at-factory.png`)

### Step 17: Plan Intervention

| | |
|---|---|
| **Navigation** | Ticket form (status bar) |
| **Action** | Click **Plan Intervention**. |
| **Description** | Used to assign a task to a repair technician. |

*Screenshot: Ticket form — Plan Intervention button* (`17-plan-intervention.png`)

### Step 18: Create & View Task

| | |
|---|---|
| **Navigation** | Create a Field Service task dialog |
| **Action** | Click **Create & View Task**. |
| **Description** | Creates the task and opens it so it can be managed. |

*Screenshot: Plan Intervention dialog — Create & View Task button* (`18-create-view-task.png`)

---

## Section D — Diagnosis, Image and Parts (Steps 19–31)

### Step 19: Open the Repair Diagnosis tab

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis tab |
| **Action** | Click the **Repair Diagnosis** tab. |
| **Description** | The technician checked the repair item and found the reason. Select the correct one from the table that appears. |

*Screenshot: Task form — Repair Diagnosis tab* (`19-diagnosis-tab.png`)

### Step 20: Add a line

| | |
|---|---|
| **Navigation** | Task form → Repair Diagnosis |
| **Action** | Click **Add a line**. |
| **Description** | Adds a new diagnosis row. |

*Screenshot: Repair Diagnosis tab — Add a line* (`20-add-line.png`)

### Step 21: Find the Diagnosis Area

| | |
|---|---|
| **Navigation** | Repair Diagnosis row → Diagnosis Area |
| **Action** | Click **Diagnosis Area** and select `Burnt Part`. |
| **Description** | The area of the item where the fault was found. |

*Screenshot: Diagnosis row — Diagnosis Area* (`21-diagnosis-area.png`)

### Step 22: Find the Diagnosis Code

| | |
|---|---|
| **Navigation** | Repair Diagnosis row → Diagnosis Code |
| **Action** | Click **Diagnosis Code** and select `Base plate`. |
| **Description** | The part code of the fault. |

*Screenshot: Diagnosis row — Diagnosis Code* (`22-diagnosis-code.png`)

### Step 23: Find the Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis row → Reason |
| **Action** | Click **Reason** and select `Internal`. |
| **Description** | The reason for the fault. |

*Screenshot: Diagnosis row — Reason* (`23-diagnosis-reason.png`)

### Step 24: Find the Sub Reason

| | |
|---|---|
| **Navigation** | Repair Diagnosis row → Sub Reason |
| **Action** | Click **Sub Reason** and select `Hi Voltage`. |
| **Description** | The detailed reason for the fault. |

*Screenshot: Diagnosis row — Sub Reason* (`24-diagnosis-sub-reason.png`)

### Step 25: Find the Resolution

| | |
|---|---|
| **Navigation** | Repair Diagnosis row → Resolution |
| **Action** | Click **Resolution** and select `Reject`. |
| **Description** | How the fault is resolved. |

*Screenshot: Diagnosis row — Resolution* (`25-diagnosis-resolution.png`)

### Step 26: Select the Repair Stage

| | |
|---|---|
| **Navigation** | Repair Diagnosis row → Repair Stage |
| **Action** | Click **Repair Stage** and select `1-REP-REC`. |
| **Description** | The stage of the repair process. |

*Screenshot: Diagnosis row — Repair Stage* (`26-diagnosis-repair-stage.png`)

### Step 27: Open the Repair Image tab

| | |
|---|---|
| **Navigation** | Task form → Repair Image tab |
| **Action** | Click the **Repair Image** tab. |
| **Description** | At least one image of the item being repaired must be included. |

*Screenshot: Task form — Repair Image tab* (`27-repair-image-tab.png`)

### Step 28: Take a Picture

| | |
|---|---|
| **Navigation** | Task form → Repair Image |
| **Action** | Click the picture field, go to the location of the image, select it and click **Open**. |
| **Description** | Attaches the image of the item being repaired. |

*Screenshot: Repair Image tab — picture field* (`28-take-picture.png`)

### Step 29: Open Products

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Products** button. |
| **Description** | Opens the product catalog so the items for this repair can be selected. |

*Screenshot: Task form — Products button* (`29-products.png`)

### Step 30: Add the spare part

| | |
|---|---|
| **Navigation** | Choose Products catalog |
| **Action** | Find `[02BB 023] BALL BEARING 6202-2RS` and click **Add**. |
| **Description** | Select the desired item and enter the required quantity. Each item added becomes a line on the quotation. |

*Screenshot: Product catalog — Add button* (`30-add-part.png`)

### Step 31: Close the catalog

| | |
|---|---|
| **Navigation** | Choose Products catalog |
| **Action** | Click **Close** (×). |
| **Description** | Returns to the previous menu. |

*Screenshot: Product catalog — Close button* (`31-close-catalog.png`)

---

## Section E — Send the Quotation (Steps 32–37)

### Step 32: Open the Tasks

| | |
|---|---|
| **Navigation** | Helpdesk ticket form (button box) |
| **Action** | Click the **Tasks** button. |
| **Description** | Opens the task, where the quotation created after adding the item can be viewed. |

*Screenshot: Ticket form — Tasks button* (`32-tasks-quotation.png`)

### Step 33: Open the Sales Order

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the quotation. |

*Screenshot: Task form — Sales Order button* (`33-sales-order.png`)

### Step 34: Send by Email

| | |
|---|---|
| **Navigation** | Sales Order (quotation) |
| **Action** | Click **Send by Email**. |
| **Description** | The quotation must be approved by the customer; click here to process it. |

*Screenshot: Quotation — Send by Email button* (`34-send-by-email.png`)

### Step 35: Send

| | |
|---|---|
| **Navigation** | Send by Email dialog |
| **Action** | Click **Send**. |
| **Description** | Sends the email to the customer. |

*Screenshot: Email dialog — Send button* (`35-send.png`)

### Step 36: Close the quotation

| | |
|---|---|
| **Navigation** | Sales Order (Quotation Sent) |
| **Action** | Click **Close** (×). |
| **Description** | Returns to the previous menu. The quotation is now in the *Quotation Sent* stage. |

*Screenshot: Quotation — Close button* (`36-close-quotation.png`)

### Step 37: Customer approves the quotation

| | |
|---|---|
| **Navigation** | Customer portal → View Quotation |
| **Action** | The customer opens the quotation link and clicks **Accept & Sign**, then **Accept & Sign** again in the signature window. |
| **Description** | The customer approves the quotation online. Only an approved quotation can be re-estimated (next steps). |

*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`37-customer-accepts.png`)
*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`37b-portal-signature.png`)
*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`37c-portal-accepted.png`)

---

## Section F — Re-estimate After the Customer Approved (Steps 38–50)

### Step 38: Open the Tasks again

| | |
|---|---|
| **Navigation** | Helpdesk ticket form (button box) |
| **Action** | Click the **Tasks** button. |
| **Description** | To see whether the quotation has been approved. |

*Screenshot: Ticket form — Tasks button* (`38-tasks-approved.png`)

### Step 39: Open the Sales Order

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the approved quotation. |

*Screenshot: Task form — Sales Order button* (`39-sales-order-approved.png`)

### Step 40: Re-estimate

| | |
|---|---|
| **Navigation** | Sales Order (approved quotation) |
| **Action** | Click **Re-estimate**. |
| **Description** | Use this to re-estimate the previous quotation. |

*Screenshot: Quotation — Re-estimate button* (`40-re-estimate.png`)

### Step 41: Confirm with Ok

| | |
|---|---|
| **Navigation** | Re-estimate confirmation dialog |
| **Action** | Click **Ok**. |
| **Description** | Confirms the re-estimate. The quotation is reset to draft, the customer's signature is cleared and the ticket moves back to *Diagnosis*. |

*Screenshot: Confirmation dialog — Ok button* (`41-re-estimate-ok.png`)

### Step 42: Open the Task

| | |
|---|---|
| **Navigation** | Sales Order (button box) |
| **Action** | Click the **Tasks** button. |
| **Description** | Opens the task to see the previous sales order details. |

*Screenshot: Quotation — Tasks button* (`42-so-to-task.png`)

### Step 43: Open Products

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Products** button. |
| **Description** | Opens the product catalog to edit the previous details. |

*Screenshot: Task form — Products button* (`43-task-products.png`)

### Step 44: Increase the quantity

| | |
|---|---|
| **Navigation** | Choose Products catalog |
| **Action** | Click **+** on the item to raise its quantity by one. |
| **Description** | Any item may be added to the quotation at this stage. |

*Screenshot: Product catalog — quantity + button* (`44-increase-quantity.png`)

### Step 45: Back

| | |
|---|---|
| **Navigation** | Choose Products catalog |
| **Action** | Click **Back**. |
| **Description** | Returns to the previous step, the task. |

*Screenshot: Product catalog — Back button* (`45-back-to-task.png`)

### Step 46: Open the Sales Order again

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the re-estimated quotation, now with the new quantity. |

*Screenshot: Task form — Sales Order button* (`46-sales-order-re-estimated.png`)

### Step 47: Send by Email

| | |
|---|---|
| **Navigation** | Sales Order (quotation) |
| **Action** | Click **Send by Email**. |
| **Description** | Resend the quotation to the customer for approval. |

*Screenshot: Quotation — Send by Email button* (`47-resend-by-email.png`)

### Step 48: Send

| | |
|---|---|
| **Navigation** | Send by Email dialog |
| **Action** | Click **Send**. |
| **Description** | Confirms the sending. |

*Screenshot: Email dialog — Send button* (`48-resend.png`)

### Step 49: Close the quotation

| | |
|---|---|
| **Navigation** | Sales Order |
| **Action** | Click **Close** (×). |
| **Description** | Returns to the previous menu. |

*Screenshot: Quotation — Close button* (`49-close-resent.png`)

### Step 50: Customer approves again

| | |
|---|---|
| **Navigation** | Customer portal → View Quotation |
| **Action** | The customer clicks **Accept & Sign** and signs again. |
| **Description** | The re-estimated quotation must be approved by the customer once more. |

*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`50-customer-accepts-again.png`)
*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`50b-portal-signature.png`)
*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`50c-portal-accepted.png`)

---

## Section G — Confirm the Sales Order (Steps 51–55)

### Step 51: Open the Tasks

| | |
|---|---|
| **Navigation** | Helpdesk ticket form (button box) |
| **Action** | Click the **Tasks** button. |
| **Description** | To view the sales order details again. |

*Screenshot: Ticket form — Tasks button* (`51-tasks-after-re-estimate.png`)

### Step 52: Open the Sales Order

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Sales Order** button. |
| **Description** | Shows the sales order after the re-estimate. |

*Screenshot: Task form — Sales Order button* (`52-sales-order-after-re-estimate.png`)

### Step 53: Confirm

| | |
|---|---|
| **Navigation** | Sales Order (approved quotation) |
| **Action** | Click **Confirm**. |
| **Description** | Confirms the re-estimated sales order. |

*Screenshot: Sales Order — Confirm button* (`53-confirm.png`)

### Step 54: View the Delivery orders

| | |
|---|---|
| **Navigation** | Sales Order (button box) |
| **Action** | Click the **Delivery** button. |
| **Description** | Delivery orders are created automatically for a confirmed sales order. |

*Screenshot: Sales Order — Delivery button* (`54-delivery-orders.png`)

### Step 55: Back

| | |
|---|---|
| **Navigation** | Delivery orders |
| **Action** | Click **Back**. |
| **Description** | Returns to the sales order. |

*Screenshot: Delivery orders — Back button* (`55-back-from-delivery.png`)

---

## Section H — Re-estimate the Confirmed Sales Order (Steps 56–70)

### Step 56: Unlock

| | |
|---|---|
| **Navigation** | Sales Order (confirmed) |
| **Action** | Click **Unlock**. |
| **Description** | When a confirmed sales order must be re-estimated, you must first click Unlock. |

*Screenshot: Sales Order — Unlock button* (`56-unlock.png`)

### Step 57: Re-estimate

| | |
|---|---|
| **Navigation** | Sales Order (unlocked) |
| **Action** | Click **Re-estimate**. |
| **Description** | Re-estimates the confirmed sales order. |

*Screenshot: Sales Order — Re-estimate button* (`57-re-estimate-confirmed.png`)

### Step 58: Confirm with Ok

| | |
|---|---|
| **Navigation** | Re-estimate confirmation dialog |
| **Action** | Click **Ok**. |
| **Description** | Confirms the re-estimate; the sales order goes back to draft. |

*Screenshot: Confirmation dialog — Ok button* (`58-re-estimate-confirmed-ok.png`)

### Step 59: Open the Task

| | |
|---|---|
| **Navigation** | Sales Order (button box) |
| **Action** | Click the **Tasks** button. |
| **Description** | To view the sales order details again. |

*Screenshot: Sales Order — Tasks button* (`59-so-to-task-again.png`)

### Step 60: Open Products

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Products** button. |
| **Description** | Opens the product catalog to edit the previous details. |

*Screenshot: Task form — Products button* (`60-task-products-again.png`)

### Step 61: Increase the quantity

| | |
|---|---|
| **Navigation** | Choose Products catalog |
| **Action** | Click **+** to raise the quantity by one. |
| **Description** | Any item may be added to the quotation at this stage. |

*Screenshot: Product catalog — quantity + button* (`61-increase-quantity-again.png`)

### Step 62: Back

| | |
|---|---|
| **Navigation** | Choose Products catalog |
| **Action** | Click **Back**. |
| **Description** | Returns to the task. |

*Screenshot: Product catalog — Back button* (`62-back-to-task-again.png`)

### Step 63: Open the Sales Order

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Sales Order** button. |
| **Description** | Opens the re-estimated quotation. |

*Screenshot: Task form — Sales Order button* (`63-sales-order-re-estimated-again.png`)

### Step 64: Send by Email

| | |
|---|---|
| **Navigation** | Sales Order (quotation) |
| **Action** | Click **Send by Email**. |
| **Description** | Resend the quotation to the customer for approval. |

*Screenshot: Quotation — Send by Email button* (`64-resend-by-email-again.png`)

### Step 65: Send

| | |
|---|---|
| **Navigation** | Send by Email dialog |
| **Action** | Click **Send**. |
| **Description** | Confirms the sending. |

*Screenshot: Email dialog — Send button* (`65-resend-again.png`)

### Step 66: Close the quotation

| | |
|---|---|
| **Navigation** | Sales Order |
| **Action** | Click **Close** (×). |
| **Description** | Returns to the previous menu. |

*Screenshot: Quotation — Close button* (`66-close-resent-again.png`)

### Step 67: Customer approves again

| | |
|---|---|
| **Navigation** | Customer portal → View Quotation |
| **Action** | The customer clicks **Accept & Sign** and signs again. |
| **Description** | The customer approves the re-estimated quotation. |

*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`67-customer-accepts-final.png`)
*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`67b-portal-signature.png`)
*Screenshot: Customer portal — Accept & Sign (before; then the signature window; then the accepted quotation)* (`67c-portal-accepted.png`)

### Step 68: Open the Tasks

| | |
|---|---|
| **Navigation** | Helpdesk ticket form (button box) |
| **Action** | Click the **Tasks** button. |
| **Description** | To view the sales order details again. |

*Screenshot: Ticket form — Tasks button* (`68-tasks-final.png`)

### Step 69: Open the Sales Order

| | |
|---|---|
| **Navigation** | Task form (button box) |
| **Action** | Click the **Sales Order** button. |
| **Description** | Shows the sales order after the second re-estimate. |

*Screenshot: Task form — Sales Order button* (`69-sales-order-final.png`)

### Step 70: Confirm

| | |
|---|---|
| **Navigation** | Sales Order (approved quotation) |
| **Action** | Click **Confirm**. |
| **Description** | Confirm the sales order again and proceed in the manner appropriate for the repair type. |

*Screenshot: Sales Order — Confirm button* (`70-confirm-final.png`)

---

## QA Notes

- The tour starts from a ticket with a sent quotation. To reach that point this example creates a Factory repair ticket of type *Repair - Not Under Warranty (Without Serial No)* as in the Factory full-flow guide (steps 1–31), then sends its quotation.
- The tour has no explicit customer-approval step, but it says *"To see if the quotation has been approved"*. The **Re-estimate** button only appears on a quotation the customer has approved, so the automated run signs the quotation on the public customer portal (steps 37, 50 and 67), the same way the customer would after receiving the email.
- Re-estimate asks for confirmation ("Re-estimate this Sales Order? It will be reset to draft, the customer's signature cleared ... The linked helpdesk ticket will move back to Diagnosis."). The **Re-estimate** button is hidden once an invoice exists for the order.
- The receipt (steps 12–14) is created with the real **Return** button (the server method raises "You may only return Done pickings" but still creates the Returned Picking; the run falls back to the same call over RPC if needed) and validated by RPC because the Validate button is not exposed. The repair image is attached by sending `WaterPump.jpg` to the field's hidden file input.
- After **Confirm** (steps 53 and 70) the run checks the order state through RPC and confirms through RPC if the click did not confirm the order. The run asserts: the quotation returns to draft after each Re-estimate, the quantity rises by one each time (1 → 2 → 3) and the order ends in the Sales Order state.
- Each screenshot is captured immediately before the step's action with the target element framed in red (a temporary CSS outline applied for the capture only); result screenshots (portal signature window, accepted quotation) have no box. Screenshots come from one clean, passing automated run (admin role): 70 steps, 76 screenshots.
- Every screenshot shows a red "Database neutralized for testing: no emails sent, etc." banner at the top. This is expected on the test database and is not part of the normal production screen.
