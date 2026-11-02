# Cash Sales Order — Profit Margin Control

Spec: `src/modules/sales/tests/02-business/sales.margin-approval.spec.ts`
Tags: `@module:sales @step:business @e2e` · opt-in via `RUN_SALES_FLOWS=true`

```bash
RUN_SALES_FLOWS=true HEADLESS=false npx playwright test sales.margin-approval --project=setup --project=admin --workers=1
```

## Scenario (from the recorded tour)
Customer `abc`, Cash, Quotation Type Sales, product `[JMC6] Multi Chopper 6Hp (Tractor Type)` qty 1,
Payment Terms Immediate Payment. When the order margin is below Settings > Sales > "Minimum Sales Margin %" (60),
Confirm is replaced by the margin gate: Insufficient Margin Details (modal) -> Request Insufficient Margin Approval ->
Approve Insufficient Margin (authority person) -> Confirm. Then delivery, invoice, cash receipt and the trace back.

## Test cases (serial)
| # | Test | What it checks |
|---|------|----------------|
| 1 | quotation | Cash order, Immediate Payment, JMC6 line, stage Quotation; reads "Margin: Rs X (Y%)"; compares with `marginPct()` when `FLOW_MARGIN_COST` is set |
| 2 | gating | Confirm hidden, margin < minimum, "Insufficient Margin Details" opens a modal with content, Close works. **Skips** if the gate buttons are absent (message lists buttons seen + margin shown) |
| 3 | approval | Request -> Approve -> Confirm, stage Sales Order (just confirms if the gate was not active) |
| 4 | delivery | Delivery validated, Done |
| 5 | invoice | Invoice created and posted |
| 6 | payment | Register Payment, "Customer Receipts - Cash" (fallback journals), full invoice total, ribbon Paid / In Payment. Skips if no outstanding account |
| 7 | trace | Payment's Sales Orders button shows 1 -> order -> Invoices smart button -> invoice |
| 8 | high margin (optional) | Margin >= minimum: no margin buttons, Confirm works. Skipped unless `FLOW_HIGH_MARGIN_PRODUCT_CODE` is set |

## Margin formula
`margin % = (net unit price - cost) / net unit price x 100`, net price = unit price after discount
(`marginPct(unitPrice, cost, discountPct)` in `calculations/SalesCalculations.ts`).

## Gotchas
- Cost comes from the order line `purchase_price`, copied from the product's **Cost** (`standard_price`), NOT the vendor price.
- Known data issue: product JMC6 has cost 0, so margin shows 100% and the gate does not trigger. Test 2 then skips.
  Fix the product cost, or use `FLOW_MARGIN_UNIT_PRICE` / another product via `FLOW_MARGIN_PRODUCT_CODE` + `FLOW_MARGIN_PRODUCT_NAME`.
- Smart button text is `"1Sale Orders"`; match with `/^\s*1(?!\d)/`, not `/1\b/`.
- Recorded button names (1517/1513/1515) are DB action ids; buttons are located by visible text.
- Approver is the logged-in admin by default; set `ODOO_APPROVER_EMAIL` / `ODOO_APPROVER_PASSWORD` otherwise.
- Env: `FLOW_CONTROL_CUSTOMER`, `FLOW_MARGIN_PRODUCT_CODE/_NAME`, `FLOW_MARGIN_UNIT_PRICE`, `FLOW_MARGIN_COST`, `FLOW_MIN_MARGIN`.
- Each run creates real records (order, delivery, invoice, payment).

## Run log (2026-11-02, headed, admin) — margin gate NOT reproduced yet
- Default JMC6 run: 7 passed, 2 skipped (gate test skipped: JMC6 order lines carry cost 0, margin shows 100%).
- Created `[TEST] Margin Request Product` (code `TESTMARGIN1`, consumable, category FG-TH-20, price 1,000, Cost 1,200) as a loss-making product. Run with
  `FLOW_MARGIN_PRODUCT_CODE=TESTMARGIN1 FLOW_MARGIN_PRODUCT_NAME="[TESTMARGIN1] [TEST] Margin Request Product" FLOW_MARGIN_COST=1200 FLOW_MARGIN_UNIT_PRICE=1000 FLOW_MIN_MARGIN=110`.
- Result: gate still did not fire (no margin buttons), order confirmed directly; invoice step failed with
  "Account 22050010 is of payable type, but is used in a sale operation" (the new product resolves to the wrong income account; JMC6 does not).
- Findings: product `standard_price` (Cost) is NOT what the order-line margin uses. Order lines carry a custom `x_studio_cost_value` (0 even with Cost 1,200). Setting it to 1,200 by RPC on a draft line did not set `x_studio_margin_exceed` either.
- Minimum margin: Settings UI shows 60 but `ir.config_parameter bugfix_sales.minimum_sales_margin.2` = 110.0 (user says 110 applies).
- Open: what actually triggers "Insufficient Margin Details" (Studio automation / server action) and what populates the line cost.
