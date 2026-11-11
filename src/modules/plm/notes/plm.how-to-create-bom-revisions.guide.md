# PLM — How to Create BOM Revisions
## Engineering Change Order (ECO): modify an existing BOM

> Source: Odoo Tour Recorder export
> `Tour/PLM_1 - How to Create BOM Revisions.json`

---

## 1. Overview

This manual explains how to create a **BOM revision** in the **Product Lifecycle Management (PLM)** app. PLM is used to create a new product, a new BOM and new BOM versions. A revision is made through an ECO: **Start Revision** copies the final BOM, the changes are made in the copy, and **Apply Changes** activates the new version.

### ECO stages covered

`New` → `In Progress` → `Validated` → `Effective`

### Before you start

- You have access to the PLM (Engineering Changes) and Manufacturing apps and are allowed to approve ECOs.
- The active company (top bar) is **Jinasena Agricultural Machinery (Pvt) Ltd.**
- The product already exists, is an **Approved Item** and has a Bill of Materials.
- Naming standard: the product code to be revised starts with **M-** and ends with **-V** followed by the next sequence number (e.g. `M-JMC10D-V1.0`).

### Example data used in this manual

| Field | Value |
|---|---|
| ECO name | M-JMC10D-V1.0 |
| Product | [JMC10D] Multi Chopper with 10Hp. Engine (the screenshots show a [TEST] copy of it) |
| Quantity change | First component: 20 → 18 |
| Added component | [02BB 023] BALL BEARING 6202-2RS |

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
| A | 1–3 | Open the PLM app and start a new Engineering Change Order (ECO). |
| B | 4–7 | Enter the ECO name by the company standard, select the product and create the new BOM version. |
| C | 8–13 | Inside the BOM copy, change a component quantity and add a new component, then return to the ECO. |
| D | 14–18 | Check the BoM Changes, move the ECO to Validated, approve it and apply the changes to activate the revision. |
| E | 19–22 | Open the product and its Bill of Materials to confirm the new version is active. |

---

## Section A — Open Engineering Changes and create the ECO (Steps 1–3)

### Step 1: Open the PLM app

| | |
|---|---|
| **Navigation** | Odoo Home → Apps |
| **Action** | Click the **PLM** (Product Lifecycle Management) app icon on the home screen. |
| **Description** | PLM is used to create a new product, a new BOM and new BOM versions. Opens the PLM Overview dashboard. |

*Screenshot: Odoo Apps home screen — PLM app icon* (`01-plm-app.png`)

### Step 2: Open Engineering Changes

| | |
|---|---|
| **Navigation** | PLM → Overview |
| **Action** | Click the **Engineering Changes** button on the dashboard card (it shows the number of ECOs). |
| **Description** | Click here to start the process. Lists the existing Engineering Change Orders. |

*Screenshot: PLM Overview — Engineering Changes button* (`02-engineering-changes.png`)

### Step 3: Create a new ECO

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders |
| **Action** | Click **New**. |
| **Description** | Opens a blank ECO (Engineering Change Order) form. |

*Screenshot: Engineering Change Orders list — New button* (`03-new-eco.png`)

## Section B — Name the ECO, choose the product and start the revision (Steps 4–7)

### Step 4: Enter the ECO name

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → New |
| **Action** | Click the **Description** (name) field and type the ECO name, e.g. `M-JMC10D-V1.0`. |
| **Description** | According to the company STANDARD, the PRODUCT CODE of the product being revised must start with **M-**, and the next sequence number, preceded by **-V**, is added to the end of the product code (e.g. `M-JMC10D-V1.0`). |

*Screenshot: New ECO — Description (name) field* (`04-eco-name.png`)

### Step 5: Select the product

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → New |
| **Action** | Click the **Product** field, type the product code (e.g. `JMC10D`) and press **Enter** / choose the product. |
| **Description** | The **Bill of Materials** of the product is filled in automatically. The product must be an *Approved Item*, otherwise the ECO shows the error “The Selected Product Should be Approved to Proceed.” |

*Screenshot: New ECO — Product field* (`05-product.png`)

### Step 6: Start the revision

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click **Start Revision**. |
| **Description** | Creates the new BOM version (V2) as a copy of the final BOM and links it to the ECO. |

*Screenshot: ECO — Start Revision button* (`06-start-revision.png`)

### Step 7: Open the new BOM version

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click the **Revision V2** button at the top of the ECO. |
| **Description** | A new version has been created by making a copy of the final BOM. The changes must be made within this copy. Click here to open it. |

*Screenshot: ECO — Revision V2 button* (`07-open-new-bom.png`)

## Section C — Change the components of the new BOM version (Steps 8–13)

### Step 8: Check that the copy is archived

| | |
|---|---|
| **Navigation** | PLM → ECO → Revision V2 (Bill of Materials) |
| **Action** | Click the **Miscellaneous** tab. |
| **Description** | The new BOM version is currently in an **ARCHIVED** state (see the ribbon) and shows its **Version** number. It becomes active only when the ECO is applied. |

*Screenshot: New BOM version — Miscellaneous tab* (`08-miscellaneous.png`)
*Screenshot: Miscellaneous tab — ARCHIVED ribbon and Version 2* (`08b-archived.png`)

### Step 9: Open the Components tab

| | |
|---|---|
| **Navigation** | PLM → ECO → Revision V2 (Bill of Materials) |
| **Action** | Click the **Components** tab. |
| **Description** | View the existing components, or add, delete or modify them. |

*Screenshot: New BOM version — Components tab* (`09-components.png`)

### Step 10: Change a quantity

| | |
|---|---|
| **Navigation** | Bill of Materials → Components |
| **Action** | Click the **Quantity** cell of the first line (e.g. 20.0000), type `18` and press **Enter**. |
| **Description** | Changes the quantity of that component in the new version only. |

*Screenshot: Components — Quantity cell of the first line* (`10-qty-cell.png`)

### Step 11: Add a line

| | |
|---|---|
| **Navigation** | Bill of Materials → Components |
| **Action** | Click **Add a line**. |
| **Description** | Adds a new component row. |

*Screenshot: Components — Add a line* (`11-add-a-line.png`)

### Step 12: Add the new component

| | |
|---|---|
| **Navigation** | Bill of Materials → Components |
| **Action** | In the **Component** field type the product code (e.g. `02BB 023`) and press **Enter** to add it. |
| **Description** | The component [02BB 023] BALL BEARING 6202-2RS is added to the new version. |

*Screenshot: Components — new line, Component field* (`12-component-code.png`)
*Screenshot: Components — component added* (`12b-component-added.png`)

### Step 13: Go back to the ECO

| | |
|---|---|
| **Navigation** | Bill of Materials (breadcrumb) |
| **Action** | Click the ECO name in the breadcrumb (top left), e.g. **ECO0079: …**. |
| **Description** | Saves the BOM changes and returns to the ECO. |

*Screenshot: Bill of Materials — ECO breadcrumb* (`13-back-to-eco.png`)

## Section D — Review, validate, approve and apply the changes (Steps 14–18)

### Step 14: Review the BoM Changes

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click the **BoM Changes** tab. |
| **Description** | Lists every change made in the new version (quantity updates and added components). |

*Screenshot: ECO — BoM Changes tab* (`14-bom-changes.png`)
*Screenshot: BoM Changes — list of changes* (`14b-changes-list.png`)

### Step 15: Move the ECO to Validated

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click the **Validated** stage in the status bar. |
| **Description** | The Validated stage requires an approval. |

*Screenshot: ECO — Validated stage* (`15-validated.png`)

### Step 16: Approve

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click **Approve**. |
| **Description** | Registers your approval for the ECO. |

*Screenshot: ECO — Approve button* (`16-approve.png`)

### Step 17: See the approval details

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click the **Approvals** tab. |
| **Description** | Shows who approved the ECO. |

*Screenshot: ECO — Approvals tab* (`17-approvals.png`)
*Screenshot: Approvals — approval details* (`17b-approval-details.png`)

### Step 18: Apply the changes

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click **Apply Changes**. |
| **Description** | Activates the new revision: the new BOM version becomes the active BOM and the previous one is archived. |

*Screenshot: ECO — Apply Changes button* (`18-apply-changes.png`)

## Section E — Check the new BOM version (Steps 19–22)

### Step 19: Open the product

| | |
|---|---|
| **Navigation** | PLM → Engineering Change Orders → ECO |
| **Action** | Click the **Product** link. |
| **Description** | Opens the product form so the new BOM version can be checked. |

*Screenshot: ECO — Product link* (`19-product-link.png`)

### Step 20: Open the More menu

| | |
|---|---|
| **Navigation** | Inventory / Product form |
| **Action** | Click **More** in the button box. |
| **Description** | Find the BOM details. |

*Screenshot: Product — More button* (`20-more.png`)

### Step 21: Open the Bill of Materials

| | |
|---|---|
| **Navigation** | Product → More |
| **Action** | Click **Bill of Materials**. |
| **Description** | Opens the BOM of the product. When the product has several BOMs a list appears first: click the row to open it. |

*Screenshot: Product — More › Bill of Materials* (`21-bill-of-materials.png`)

### Step 22: Check the new version

| | |
|---|---|
| **Navigation** | Bill of Materials |
| **Action** | Click the **Miscellaneous** tab. |
| **Description** | The **Version** now shows the new number (2) and the BOM is no longer archived: the new BOM version is active. |

*Screenshot: Bill of Materials — Miscellaneous tab* (`22-check-version.png`)
*Screenshot: Miscellaneous — new Version number* (`22b-version.png`)

---

## QA notes

- The tour revises the real product `JMC10D`. The automated run does not touch production data: it builds a throw-away `[TEST]` product with a small BOM through RPC (set-up only), flags it as an **Approved Item** (a custom rule — the ECO refuses an unapproved product) and gives it a barcode (required by the product form on this instance). Every documented step is performed through the UI. All created records are `[TEST]`-prefixed and archived afterwards; the screenshots therefore show the test product instead of JMC10D, and the tour’s components (e.g. 20 → 18 of the first line) are reproduced as 20 → 18 on the first component of the test BOM.
- The tour has separate steps for typing the ECO name (two steps) and the product; they are merged here into the two steps “Enter the ECO name” and “Select the product”. The tour’s “Miscellaneous”, “Components” and “BoM Changes” clicks are identical in the run.
- After **Apply Changes** the tour clicks the product link, **More**, **Bill of Materials**, then (JMC10D has several BOM versions) a BOM row. The test product has a single active BOM, so Bill of Materials opens it directly and there is no separate “open the row” step; with several BOMs a list appears first.
- The tour’s **Back to “ECO Number”** step uses the `b` hotkey; the run clicks the ECO breadcrumb, which does the same.
- The ECO uses type *New Product Introduction* (the instance default); its Validated stage needs one approval, given by the administrator in step 16.
- Each screenshot is captured immediately before the step’s action with the target element framed in red (a temporary CSS outline applied to the live element only for the capture); result screenshots have no box. Screenshots come from one clean, passing automated run (admin role).
- Every screenshot shows a red “Database neutralized for testing: no emails sent, etc.” banner at the top. This is expected on the test database and is not part of the normal production screen.
