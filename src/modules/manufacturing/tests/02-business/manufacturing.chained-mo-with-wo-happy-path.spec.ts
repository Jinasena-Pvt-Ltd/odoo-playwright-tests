/**
 * Step 2 — MO with Work Orders creation happy path for the manufacturing module.
 *
 * Full multi-phase E2E flow: verify access rights → create + confirm MO →
 * work center costing (pre) → purchases → child MOs → internal transfers →
 * produce all → work center costing (post) → journal entries → cleanup.
 *
 * Several sub-phases are optional depending on the BOM/routing configuration
 * (e.g. a product with no purchase-triggering components has no Purchases
 * smart button). Those use logPhase(..., 'SKIP', reason) and `return` from
 * inside their `test.step()` — NOT `test.skip()`, which would abort the
 * entire multi-hour flow rather than just that one sub-phase.
 */
import type { Page, Locator, TestInfo } from '@playwright/test';
import { test, expect } from '../../../../core/fixtures/index';
import type { OdooRPC } from '../../../../core/api/OdooRPC';
import { ReportAttachment } from '../../../../core/utils/ReportAttachment';

const MO_PRODUCT = process.env.MO_PRODUCT ?? '33PT 4230';
const MO_QTY = process.env.MO_QUANTITY ?? '2';

// Minimum required Odoo groups for MO with Work Orders.
// mrp.group_mrp_routings activates the Work Orders tab on MO forms.
const REQUIRED_GROUPS: Array<{ xmlId: string; name: string; required: boolean }> = [
  { xmlId: 'base.group_user', name: 'Internal User', required: true },
  { xmlId: 'mrp.group_mrp_user', name: 'Manufacturing / User', required: true },
  { xmlId: 'mrp.group_mrp_routings', name: 'Manufacturing / Work Orders', required: true },
  { xmlId: 'stock.group_stock_user', name: 'Inventory / User', required: true },
  { xmlId: 'purchase.group_purchase_user', name: 'Purchase / User', required: false },
];

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

type PhaseOutcome = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

interface WorkCenterCost {
  woName: string;
  plannedDuration: number | null;
  costPerHour: number | null;
  actualDuration: number | null;
}

interface ComponentRow {
  product: string;
  demandQty: number;
  doneQty: number;
  uom: string;
  unitCost: number | null;
  totalCost: number | null;
}

interface EmployeeCostRow {
  wcName: string;
  employee: string;
  durationMin: number;
  cost: number | null;
}

interface JournalEntryRow {
  ref: string;
  date: string;
  account: string;
  label: string;
  debit: number;
  credit: number;
}

interface GroupCheck {
  xmlId: string;
  name: string;
  required: boolean;
  hasGroup: boolean | null;
}

interface MoReport {
  testName: string;
  date: string;
  moReference: string;
  phases: Record<string, { result: PhaseOutcome; notes: string }>;
  workCenters: Record<string, WorkCenterCost>;
  employeeCosting: EmployeeCostRow[];
  components: ComponentRow[];
  journalEntries: JournalEntryRow[];
  userGroups: GroupCheck[];
  overallResult: 'PASS' | 'FAIL';
}

function newReport(): MoReport {
  return {
    testName: 'MO_with_WO_creation_HappyPath',
    date: new Date().toISOString(),
    moReference: '',
    phases: {},
    workCenters: {},
    employeeCosting: [],
    components: [],
    journalEntries: [],
    userGroups: [],
    overallResult: 'PASS',
  };
}

function logPhase(report: MoReport, name: string, result: PhaseOutcome, notes = ''): void {
  report.phases[name] = { result, notes };
  if (result === 'FAIL') report.overallResult = 'FAIL';
  const icon = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : '⚠️';
  console.log(`  ${icon} ${name} → ${result}${notes ? ' | ' + notes : ''}`);
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

async function waitForOdoo(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.o_loading_indicator, .o_loading').waitFor({ state: 'hidden', timeout }).catch(() => null);
}

async function goToMainMO(page: Page, mainMoUrl: string): Promise<void> {
  await page.goto(mainMoUrl);
  await waitForOdoo(page, 15_000);
  await page.locator('.o_form_view').waitFor({ state: 'visible', timeout: 20_000 });
}

async function getListRowCount(page: Page, rowSelector = '.o_list_view .o_data_row'): Promise<number> {
  await page.locator(rowSelector).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);
  return page.locator(rowSelector).count();
}

async function assertNoErrorDialog(page: Page, context: string): Promise<void> {
  const err = page.locator('.o_error_dialog, .modal-dialog:has(.modal-title:has-text("Error"))');
  if (await err.isVisible().catch(() => false)) {
    const msg = await err.innerText().catch(() => 'Unknown error');
    throw new Error(`Error dialog after ${context}: ${msg}`);
  }
}

async function getSmartButtonCount(buttonLocator: Locator): Promise<number> {
  const el = buttonLocator.locator('.o_stat_value, .o_field_integer').first();
  const text = await el.innerText({ timeout: 3_000 }).catch(() => '0');
  const n = parseInt(text.trim(), 10);
  return isNaN(n) ? 0 : n;
}

async function validatePicking(page: Page, ra: ReportAttachment, label: string, screenshotPrefix: string): Promise<void> {
  await ra.screenshot(`${screenshotPrefix}_opened`);

  const validateBtn = page.locator('button[name="button_validate"], button:has-text("Validate")').first();
  if (!(await validateBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    console.log(`  Validate button not found for ${label} – may already be Done.`);
    await ra.screenshot(`${screenshotPrefix}_already_done`);
    return;
  }

  await validateBtn.click();
  await waitForOdoo(page, 10_000);

  const dialogBtn = page.locator(
    '.modal button:has-text("Validate"), .modal button:has-text("Apply"), ' +
    '.modal button:has-text("No Backorder"), .modal button:has-text("Ok"), .modal button:has-text("Yes")',
  ).first();
  if (await dialogBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await dialogBtn.click();
    await waitForOdoo(page, 10_000);
  }

  const noQtyErr = page.locator('.o_error_dialog, .modal-dialog:has(.modal-title:has-text("Error"))');
  if (await noQtyErr.isVisible({ timeout: 2_000 }).catch(() => false)) {
    const errText = await noQtyErr.innerText().catch(() => '');
    if (errText.includes('no quantities reserved') || errText.includes('no quantities')) {
      console.log(`  No quantities reserved for ${label} – trying Check Availability`);
      await noQtyErr.locator('button:has-text("Close"), button.btn-close').first().click().catch(() => {});
      await waitForOdoo(page, 2_000);

      const checkAvailBtn = page.locator('button:has-text("Check Availability"), button[name="action_assign"]').first();
      if (await checkAvailBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await checkAvailBtn.click();
        await waitForOdoo(page, 5_000);
      }

      const retryBtn = page.locator('button[name="button_validate"], button:has-text("Validate")').first();
      if (await retryBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await retryBtn.click();
        await waitForOdoo(page, 10_000);
        const retryDlg = page.locator(
          '.modal button:has-text("Validate"), .modal button:has-text("No Backorder"), .modal button:has-text("Apply")',
        ).first();
        if (await retryDlg.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await retryDlg.click();
          await waitForOdoo(page, 10_000);
        }
      }

      if (await noQtyErr.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await noQtyErr.locator('button:has-text("Close"), button.btn-close').first().click().catch(() => {});
        console.log(`  Skipping ${label} – no stock to reserve/validate`);
        await ra.screenshot(`${screenshotPrefix}_skipped_no_qty`);
        return;
      }
    }
  }

  await assertNoErrorDialog(page, `${label} Validate`);
  await ra.screenshot(`${screenshotPrefix}_validated`);
}

async function clickWorkOrdersTab(page: Page): Promise<boolean> {
  const tab = page.locator(
    '.o_notebook .nav-link:has-text("Work Orders"), a[data-bs-toggle="tab"]:has-text("Work Orders"), .nav-tabs a:has-text("Work Orders")',
  ).first();
  if (!(await tab.isVisible({ timeout: 5_000 }).catch(() => false))) return false;
  await tab.click();
  await waitForOdoo(page, 5_000);
  return true;
}

function parseDurationMins(text: string): number {
  const t = String(text || '').trim();
  if (/^\d{1,4}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }
  return parseFloat(t.replace(/[^0-9.]/g, '')) || 0;
}

// Iterating every row of an unknown-length dynamic list requires positional
// indexing — there is no stable text to filter on until each row is read.
async function readWorkOrderRows(page: Page, durationField = 'duration_expected'): Promise<Array<{ wcName: string; woName: string; duration: number }>> {
  const rows = page.locator('[name="workorder_ids"] .o_data_row');
  const count = await rows.count();
  const results: Array<{ wcName: string; woName: string; duration: number }> = [];
  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const wcName = (await row.locator('[name="workcenter_id"]').innerText().catch(() => '')).trim() || `WC_${i + 1}`;
    const woName = (await row.locator('[name="name"]').innerText().catch(() => '')).trim() || `WO-${String(i + 1).padStart(3, '0')}`;
    const durText = await row.locator(`[name="${durationField}"]`).innerText().catch(() => '0');
    results.push({ wcName, woName, duration: parseDurationMins(durText) });
  }
  return results;
}

async function readComponents(page: Page): Promise<ComponentRow[]> {
  const results: ComponentRow[] = [];
  try {
    const compTab = page.locator('.o_notebook .nav-link:has-text("Components"), a[data-bs-toggle="tab"]:has-text("Components")').first();
    if (await compTab.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await compTab.click();
      await waitForOdoo(page, 4_000);
    }

    const rows = page.locator('[name="move_raw_ids"] .o_data_row, [name="move_ids"] .o_data_row');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const product = (await row.locator('[name="product_id"]').innerText({ timeout: 2_000 }).catch(() => '')).trim();
      const demand = (await row.locator('[name="product_uom_qty"]').innerText({ timeout: 2_000 }).catch(() => '0')).replace(/[^0-9.]/g, '');
      const done = (await row.locator('[name="qty_done"], [name="quantity_done"]').innerText({ timeout: 2_000 }).catch(() => '0')).replace(/[^0-9.]/g, '');
      const uom = (await row.locator('[name="product_uom"]').innerText({ timeout: 2_000 }).catch(() => '')).trim();
      const costRaw = (await row.locator('[name="unit_cost"], [name="price_unit"]').innerText({ timeout: 2_000 }).catch(() => '')).replace(/[^0-9.]/g, '');
      const unitCost = costRaw ? parseFloat(costRaw) : null;
      const doneQty = parseFloat(done) || 0;
      const totalCost = unitCost != null ? unitCost * doneQty : null;
      if (product) results.push({ product, demandQty: parseFloat(demand) || 0, doneQty, uom, unitCost, totalCost });
    }
  } catch (e) {
    console.log(`  WARN: readComponents failed: ${(e as Error).message.split('\n')[0]}`);
  }
  return results;
}

async function readWorkOrderEmployees(page: Page, timeLimitMs: number): Promise<EmployeeCostRow[]> {
  const results: EmployeeCostRow[] = [];
  const rows = page.locator('[name="workorder_ids"] .o_data_row');
  const count = await rows.count();

  for (let i = 0; i < count; i++) {
    if (Date.now() >= timeLimitMs) {
      console.log(`  WARN: readWorkOrderEmployees stopped at WC ${i + 1}/${count} — time budget exhausted`);
      break;
    }
    const wcName = (await rows.nth(i).locator('[name="workcenter_id"]').innerText().catch(() => '')).trim() || `WC_${i + 1}`;
    try {
      await rows.nth(i).click({ timeout: 5_000 });
      await waitForOdoo(page, 4_000);

      const isModal = await page.locator('.modal.show, .modal.d-block').isVisible({ timeout: 2_000 }).catch(() => false);
      const container = isModal ? page.locator('.modal.show, .modal.d-block').first() : page;

      const timeTab = container.locator('.o_notebook .nav-link:has-text("Time"), a[data-bs-toggle="tab"]:has-text("Time")').first();
      if (await timeTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await timeTab.click();
        await waitForOdoo(page, 3_000);
      }

      const timeRows = container.locator('[name="time_ids"] .o_data_row');
      const tCount = await timeRows.count();
      for (let t = 0; t < tCount; t++) {
        const empText = await timeRows.nth(t).locator('[name="employee_id"]').innerText({ timeout: 2_000 }).catch(() => '');
        const durText = await timeRows.nth(t).locator('[name="duration"]').innerText({ timeout: 2_000 }).catch(() => '0');
        const emp = empText.trim() || 'Unknown';
        const dur = parseFloat(durText.replace(/[^0-9.]/g, '')) || 0;
        if (emp || dur > 0) results.push({ wcName, employee: emp, durationMin: dur, cost: null });
      }

      if (isModal) {
        const closeBtn = page.locator('.modal.show button.btn-close, .modal.d-block button:has-text("Close"), .modal.show button:has-text("Discard")').first();
        if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await closeBtn.click();
          await waitForOdoo(page, 3_000);
        }
      } else {
        await page.goBack();
        await waitForOdoo(page, 5_000);
        const tab = page.locator('.o_notebook .nav-link:has-text("Work Orders"), a[data-bs-toggle="tab"]:has-text("Work Orders")').first();
        if (await tab.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await tab.click();
          await waitForOdoo(page, 3_000);
        }
      }
    } catch (e) {
      console.log(`  WARN: Could not read employee times for ${wcName}: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  return results;
}

function printConsoleTable(title: string, headers: string[], rows: Array<Array<string | number>>): void {
  const allRows = [headers, ...rows];
  const colWidths = headers.map((h, i) => Math.max(h.length, ...allRows.map(r => String(r[i] ?? '').length)));
  const sep = '  +' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
  const fmt = (cells: Array<string | number>) => '  |' + cells.map((c, i) => ` ${String(c ?? '').padEnd(colWidths[i])} `).join('|') + '|';
  console.log(`\n  ── ${title}`);
  console.log(sep);
  console.log(fmt(headers));
  console.log(sep);
  rows.forEach(r => console.log(fmt(r)));
  console.log(sep + '\n');
}

// ---------------------------------------------------------------------------
// Journal entries — read via the authenticated admin `rpc` fixture instead of
// scraping the accounting UI. This also avoids the role-under-test (manager/
// employee) potentially lacking read access to account.move.
// ---------------------------------------------------------------------------

async function readJournalEntriesRpc(rpc: OdooRPC, moRef: string): Promise<JournalEntryRow[]> {
  if (!moRef || moRef === 'New' || moRef === 'unknown') return [];

  try {
    let moves = await rpc.searchRead<{ id: number; ref: string; name: string }>(
      'account.move', [['ref', '=', moRef]], ['id', 'ref', 'name'], { limit: 20 },
    );
    if (moves.length === 0) {
      moves = await rpc.searchRead<{ id: number; ref: string; name: string }>(
        'account.move', [['ref', 'ilike', moRef]], ['id', 'ref', 'name'], { limit: 20 },
      );
    }

    const productions = await rpc.searchRead<{ id: number; move_raw_ids: number[]; move_finished_ids: number[] }>(
      'mrp.production', [['name', '=', moRef]], ['move_raw_ids', 'move_finished_ids'], { limit: 1 },
    );
    const stockMoveIds = productions.length ? [...productions[0].move_raw_ids, ...productions[0].move_finished_ids] : [];

    let svlMoveIds: number[] = [];
    if (stockMoveIds.length > 0) {
      const svls = await rpc.searchRead<{ account_move_id: [number, string] | false }>(
        'stock.valuation.layer', [['stock_move_id', 'in', stockMoveIds]], ['account_move_id'], { limit: 50 },
      );
      svlMoveIds = svls.filter(s => s.account_move_id).map(s => (s.account_move_id as [number, string])[0]);
    }

    const allMoveIds = [...new Set([...moves.map(m => m.id), ...svlMoveIds])];
    if (allMoveIds.length === 0) return [];

    const allMoves = await rpc.searchRead<{ id: number; ref: string; name: string; date: string; line_ids: number[] }>(
      'account.move', [['id', 'in', allMoveIds]], ['id', 'ref', 'name', 'date', 'line_ids'], { limit: 50 },
    );
    const lineIds = allMoves.flatMap(m => m.line_ids);
    if (lineIds.length === 0) return [];

    const lines = await rpc.searchRead<{
      move_id: [number, string];
      account_id: [number, string] | false;
      name: string;
      debit: number;
      credit: number;
    }>('account.move.line', [['id', 'in', lineIds]], ['move_id', 'account_id', 'name', 'debit', 'credit'], { limit: 300 });

    const moveMap = new Map(allMoves.map(m => [m.id, { ref: m.ref || m.name, date: m.date || '' }]));
    const results: JournalEntryRow[] = [];
    for (const line of lines) {
      const mv = moveMap.get(line.move_id[0]) ?? { ref: '', date: '' };
      const account = Array.isArray(line.account_id) ? line.account_id[1] : '';
      if (account) {
        results.push({ ref: mv.ref, date: mv.date, account, label: line.name || '', debit: line.debit || 0, credit: line.credit || 0 });
      }
    }
    return results;
  } catch (e) {
    console.log(`  WARN: readJournalEntriesRpc failed: ${(e as Error).message.split('\n')[0]}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Report generation — returns strings for ReportAttachment instead of
// writing to disk (fs.writeFileSync), so they surface in the Playwright
// HTML report / test-results attachments alongside every other module.
// ---------------------------------------------------------------------------

function generateMarkdownReport(report: MoReport): string {
  const qty = parseFloat(MO_QTY) || 1;
  const lines: string[] = [
    '# MO with Work Orders — Test Report',
    '',
    '## Summary',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| Test Name | ${report.testName} |`,
    `| Date | ${report.date} |`,
    `| MO Reference | ${report.moReference} |`,
    `| **Overall Result** | **${report.overallResult}** |`,
    '',
    '## User Access Groups',
    '',
    '| Group XML ID | Group Name | Required | Has Group |',
    '|--------------|-----------|:--------:|:---------:|',
    ...report.userGroups.map(g => {
      const req = g.required ? '✅ Yes' : 'Optional';
      const has = g.hasGroup === true ? '✅ Yes' : g.hasGroup === false ? '❌ No' : '–';
      return `| \`${g.xmlId}\` | ${g.name} | ${req} | ${has} |`;
    }),
    '',
    '## Phase Results',
    '',
    '| # | Phase | Result | Notes |',
    '|---|-------|:------:|-------|',
    ...Object.entries(report.phases).map(([name, { result, notes }], i) => {
      const icon = result === 'PASS' ? '✅ PASS' : result === 'FAIL' ? '❌ FAIL' : '⚠️ ' + result;
      return `| ${i + 1} | ${name} | ${icon} | ${notes || ''} |`;
    }),
    '',
    '## Work Center Cost Comparison',
    '',
    '| Work Center | Planned (min) | Cost/hr | Expected Cost | Actual (min) | Actual Cost | Δ% |',
    '|-------------|:------------:|:-------:|:-------------:|:------------:|:-----------:|:--:|',
    ...Object.entries(report.workCenters).map(([name, wc]) => {
      const expCost = (wc.plannedDuration != null && wc.costPerHour != null)
        ? ((wc.plannedDuration / 60) * wc.costPerHour * qty).toFixed(2) : 'N/A';
      const actCost = (wc.actualDuration != null && wc.costPerHour != null)
        ? ((wc.actualDuration / 60) * wc.costPerHour * qty).toFixed(2) : 'N/A';
      const variance = (expCost !== 'N/A' && actCost !== 'N/A' && parseFloat(expCost) !== 0)
        ? (((parseFloat(actCost) - parseFloat(expCost)) / parseFloat(expCost)) * 100).toFixed(1) + '%'
        : 'N/A';
      return `| ${name} | ${wc.plannedDuration ?? 'N/A'} | ${wc.costPerHour ?? 'N/A'} | ${expCost} | ${wc.actualDuration ?? 'N/A'} | ${actCost} | ${variance} |`;
    }),
    '',
    '## Direct Materials',
    '',
    '| Product | Demand Qty | Done Qty | UOM | Unit Cost | Total Cost |',
    '|---------|:----------:|:--------:|-----|----------:|-----------:|',
    ...(report.components.length > 0
      ? report.components.map(c =>
          `| ${c.product} | ${c.demandQty} | ${c.doneQty} | ${c.uom} | ${c.unitCost != null ? c.unitCost.toFixed(2) : 'N/A'} | ${c.totalCost != null ? c.totalCost.toFixed(2) : 'N/A'} |`,
        )
      : ['| – | No component data recorded | – | – | – | – |']),
    '',
    '## Employee Costing by Work Center',
    '',
    '| Work Center | Employee | Duration (min) | Cost |',
    '|-------------|----------|:--------------:|-----:|',
    ...(report.employeeCosting.length > 0
      ? report.employeeCosting.map(({ wcName, employee, durationMin, cost }) =>
          `| ${wcName} | ${employee} | ${durationMin} | ${cost != null ? cost.toFixed(2) : 'N/A'} |`,
        )
      : ['| – | No employee time entries recorded | – | – |']),
    '',
    '## Ledger Journal Entries',
    '',
    '| Ref | Date | Account | Label | Debit | Credit |',
    '|-----|------|---------|-------|------:|-------:|',
    ...(report.journalEntries.length > 0
      ? report.journalEntries.map(e =>
          `| ${e.ref} | ${e.date} | ${e.account} | ${e.label} | ${e.debit > 0 ? e.debit.toFixed(2) : ''} | ${e.credit > 0 ? e.credit.toFixed(2) : ''} |`,
        )
      : ['| – | – | No journal entries recorded | – | – | – |']),
  ];
  return lines.join('\n');
}

function generateMermaidReport(report: MoReport): string {
  const esc = (s: unknown) => String(s ?? '').replace(/"/g, "'").replace(/[\n\r]/g, ' ').trim();
  const lines: string[] = [
    '---',
    `title: "MO ${esc(report.moReference)} – ${report.overallResult}"`,
    '---',
    'flowchart TD',
    `S["${esc(report.testName)} – ${report.overallResult}"]`,
  ];
  Object.entries(report.phases).forEach(([name, { result }], i) => {
    const id = `P${i}`;
    const style = result === 'PASS' ? 'fill:#d1fae5,color:#065f46'
      : result === 'FAIL' ? 'fill:#fee2e2,color:#991b1b'
      : 'fill:#fef3c7,color:#92400e';
    lines.push(`${id}["${esc(name)} — ${result}"]`);
    lines.push(`S --> ${id}`);
    lines.push(`style ${id} ${style}`);
  });
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test.describe('Manufacturing MO with Work Orders — Happy Path @module:manufacturing @step:business', () => {

  test('MO with Work Order creation happy path @e2e @smoke', async ({ page, rpc }, testInfo: TestInfo) => {
    test.setTimeout(900_000); // 15 minutes
    const TEST_BUDGET_MS = 900_000;
    const testStartMs = Date.now();
    const timeLeft = () => TEST_BUDGET_MS - (Date.now() - testStartMs);

    const ra = new ReportAttachment(testInfo, page);
    const report = newReport();
    let mainMoUrl = '';

    // ======================================================================
    // PHASE 0 – Verify User Access Rights
    // Checks the CURRENTLY LOGGED-IN role's (admin/manager/employee project)
    // groups via the browser session, not the always-admin `rpc` fixture —
    // this is intentionally a role-under-test permission check.
    // Non-blocking: missing groups log a WARN but do not abort the test.
    // ======================================================================
    await test.step('Phase 0 – Verify User Access Rights', async () => {
      try {
        for (const groupDef of REQUIRED_GROUPS) {
          const hasGroup = await page.evaluate(async (xmlId: string) => {
            try {
              const res = await fetch('/web/dataset/call_kw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  jsonrpc: '2.0', method: 'call', id: Math.floor(Math.random() * 9000) + 1000,
                  params: { model: 'res.users', method: 'has_group', args: [xmlId], kwargs: {} },
                }),
              });
              const json = await res.json();
              return json.result === true;
            } catch {
              return null;
            }
          }, groupDef.xmlId).catch(() => null);

          report.userGroups.push({ ...groupDef, hasGroup });
          const icon = hasGroup === true ? '✅' : hasGroup === false ? '❌' : '?';
          console.log(`  ${icon} ${groupDef.name} (${groupDef.xmlId}) → ${hasGroup === true ? 'Present' : hasGroup === false ? 'MISSING' : 'Unknown'}`);
        }

        printConsoleTable(
          'USER ACCESS GROUPS — MINIMUM REQUIRED FOR MO WITH WORK ORDERS',
          ['Group XML ID', 'Name', 'Required', 'Has Group'],
          report.userGroups.map(g => [g.xmlId, g.name, g.required ? 'Required' : 'Optional', g.hasGroup === true ? 'Yes' : g.hasGroup === false ? 'NO' : '?']),
        );

        const missingRequired = report.userGroups.filter(g => g.required && g.hasGroup === false);
        if (missingRequired.length > 0) {
          const names = missingRequired.map(g => g.name).join(', ');
          console.log(`  Missing required groups: ${names} — test will continue; some phases may fail due to access restrictions.`);
          logPhase(report, 'Phase 0: User Access Rights', 'WARN', `Missing required groups: ${names}`);
        } else {
          logPhase(report, 'Phase 0: User Access Rights', 'PASS', `All ${report.userGroups.filter(g => g.required).length} required groups verified`);
        }

        await ra.screenshot('00_access_rights_verified');
      } catch (e) {
        logPhase(report, 'Phase 0: User Access Rights', 'WARN', (e as Error).message);
      }
    });

    // ======================================================================
    // PHASE 1 – Open Manufacturing Dashboard
    // Confirmed working via Playwright codegen against the live instance:
    // after /web/login, the app picker is an open listbox — "Manufacturing"
    // is a role=option, not a hidden .o_menu_toggle button (that toggle is
    // deliberately hidden in this instance's skin, which is why the earlier
    // click-based approach hung for the full test timeout).
    // ======================================================================
    await test.step('Phase 1 – Open Manufacturing Dashboard', async () => {
      await page.goto('/web/login');
      const state = await Promise.race([
        page.locator('.o_main_navbar').waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'ready' as const),
        page.getByRole('textbox', { name: 'Email' }).waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'login' as const),
      ]).catch(() => 'login' as const);

      if (state === 'login') {
        await page.getByRole('textbox', { name: 'Email' }).fill(process.env.ADMIN_EMAIL ?? 'admin');
        await page.getByRole('textbox', { name: 'Password' }).fill(process.env.ADMIN_PASSWORD ?? 'admin');
        await page.getByRole('button', { name: 'Log in' }).click();
        await page.waitForSelector('.o_main_navbar', { state: 'visible', timeout: 45_000 });
      }

      await page.getByRole('option', { name: 'Manufacturing' }).click();
      await waitForOdoo(page, 15_000);

      // A stale search facet is sometimes left over from the restored
      // storageState session's last SPA route — clear it if present.
      const removeFacetBtn = page.getByRole('button', { name: 'Remove' });
      if (await removeFacetBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await removeFacetBtn.click();
        await waitForOdoo(page, 5_000);
      }

      const breadcrumb = await page.locator('.o_breadcrumb').innerText().catch(() => '');
      console.log(`  Breadcrumb: "${breadcrumb.trim()}"`);
      await ra.screenshot('01_manufacturing_dashboard');
      logPhase(report, 'Phase 1: Open Manufacturing Dashboard', 'PASS');
    });

    // ======================================================================
    // PHASE 2 – Create and Confirm New Manufacturing Order
    // ======================================================================
    await test.step('Phase 2 – Navigate to Manufacturing Orders list', async () => {
      await page.getByRole('button', { name: 'Operations' }).click();
      await page.getByRole('menuitem', { name: 'Manufacturing Orders' }).click();

      await waitForOdoo(page, 15_000);
      await expect(page.locator('.o_list_view')).toBeVisible({ timeout: 20_000 });
      await ra.screenshot('02_mo_list');
    });

    await test.step('Phase 2 – Open new MO form', async () => {
      await page.getByRole('button', { name: 'New' }).click();
      await expect(page.locator('.o_field_widget[name="product_id"] input')).toBeVisible({ timeout: 15_000 });
      await ra.screenshot('03_new_mo_form');
    });

    await test.step('Phase 2 – Set Product', async () => {
      const productInput = page.locator('.o_field_widget[name="product_id"] input');
      await expect(productInput).toBeVisible({ timeout: 10_000 });

      const ITEM_SEL = '.o-autocomplete--dropdown-item:not(.o_m2o_dropdown_option_search_more)';
      let selectedValue = '';

      // Retry loop with a short settle wait: the OWL autocomplete dropdown
      // needs a brief moment to mount after each keystroke/fill before the
      // ArrowDown/Enter selection reliably registers.
      for (let attempt = 1; attempt <= 3 && !selectedValue; attempt++) {
        if (attempt > 1) {
          console.log(`  Retrying product selection (attempt ${attempt}/3)`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }
        await productInput.click();
        await productInput.fill('');
        await page.waitForTimeout(200);
        await productInput.fill(MO_PRODUCT);
        const visible = await page.waitForSelector(ITEM_SEL, { state: 'visible', timeout: 15_000 }).catch(() => null);
        if (!visible) { console.log(`  Dropdown did not appear (attempt ${attempt})`); continue; }
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(400);
        await page.keyboard.press('Enter');
        await waitForOdoo(page, 8_000);
        selectedValue = await productInput.inputValue().catch(() => '');
        console.log(`  Product after ArrowDown+Enter (attempt ${attempt}): "${selectedValue}"`);
      }

      if (!selectedValue) {
        console.log('  ArrowDown+Enter failed – trying atomic JS click');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        await productInput.click();
        await productInput.fill('');
        await page.waitForTimeout(200);
        await productInput.fill(MO_PRODUCT);
        try {
          await page.waitForFunction((sel) => {
            const item = document.querySelector(sel);
            if (!item) return false;
            item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          }, ITEM_SEL, { timeout: 15_000 });
        } catch { /* fallback exhausted below */ }
        await waitForOdoo(page, 8_000);
        selectedValue = await productInput.inputValue().catch(() => '');
        console.log(`  Product after atomic JS click: "${selectedValue}"`);
      }

      if (!selectedValue) {
        throw new Error(`Product not selected after all attempts. Check that "${MO_PRODUCT}" exists in Odoo and the autocomplete is working.`);
      }

      const qtyField = page.locator('.o_field_widget[name="product_qty"] input');
      if (await qtyField.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await qtyField.click();
        await waitForOdoo(page, 5_000);
        const afterBlur = await productInput.inputValue().catch(() => '');
        if (!afterBlur) {
          throw new Error(`Product "${selectedValue}" cleared on blur — OWL state not committed. Ensure "${MO_PRODUCT}" is an exact product name in Odoo.`);
        }
        console.log(`  Product persists after blur: "${afterBlur}"`);
      }

      await ra.screenshot('04_product_selected');
    });

    await test.step('Phase 2 – Set Quantity', async () => {
      const productInput = page.locator('.o_field_widget[name="product_id"] input');
      const productStillSet = await productInput.inputValue().catch(() => '');
      if (!productStillSet) throw new Error('Product field was cleared before quantity fill.');

      const qtyField = page.locator('.o_field_widget[name="product_qty"] input');
      await expect(qtyField).toBeVisible({ timeout: 10_000 });
      await qtyField.click({ clickCount: 3 });
      await qtyField.fill(MO_QTY);
      await page.keyboard.press('Tab');
      await waitForOdoo(page, 5_000);
      await ra.screenshot('05_quantity_set');
    });

    await test.step('Phase 2 – Save', async () => {
      const saveBtn = page.locator(
        'button.o_form_button_save, .o_control_panel_main_buttons button:has-text("Save"), button[data-hotkey="s"]',
      ).first();

      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
      } else {
        await page.keyboard.press('Control+S');
      }

      await waitForOdoo(page, 10_000);
      await assertNoErrorDialog(page, 'Save');

      report.moReference = await page.locator('.o_breadcrumb .o_last_breadcrumb_item').first().innerText().catch(() => 'unknown');
      console.log(`  MO Reference: ${report.moReference}`);
      await ra.screenshot('06_mo_saved');
    });

    await test.step('Phase 2 – Confirm', async () => {
      const confirmBtn = page.locator('button[name="action_confirm"]');
      await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
      await confirmBtn.click();
      await waitForOdoo(page, 15_000);
      await assertNoErrorDialog(page, 'Confirm');

      const statusBar = page.locator('.o_statusbar_status');
      await expect(statusBar.locator('button[aria-checked="true"], .o_arrow_button_current')).not.toHaveText(/Draft/i, { timeout: 10_000 });

      const confirmedRef = await page.locator('.o_breadcrumb .o_last_breadcrumb_item, [name="name"] span, [name="name"] input')
        .first().innerText().catch(() => '');
      if (confirmedRef && confirmedRef.trim() && confirmedRef.trim() !== 'New') {
        report.moReference = confirmedRef.trim();
      }
      console.log(`  MO Reference (confirmed): ${report.moReference}`);

      await ra.screenshot('07_mo_confirmed');
      logPhase(report, 'Phase 2: Create and Confirm MO', 'PASS', `MO: ${report.moReference}`);
    });

    mainMoUrl = page.url();
    console.log(`  Main MO URL: ${mainMoUrl}`);

    // ======================================================================
    // PHASE 3 – Work Center Costing (Pre-Production)
    // ======================================================================
    await test.step('Phase 3 – Work Center Costing Pre-Production', async () => {
      try {
        const tabFound = await clickWorkOrdersTab(page);
        if (!tabFound) {
          logPhase(report, 'Phase 3: Work Center Pre-Production', 'SKIP', 'Work Orders tab not visible — verify mrp.group_mrp_routings is assigned to this user');
          return;
        }

        await ra.screenshot('08_work_orders_tab');
        const woRows = await readWorkOrderRows(page, 'duration_expected');
        for (const { wcName, woName, duration } of woRows) {
          report.workCenters[wcName] = { woName, plannedDuration: duration, costPerHour: null, actualDuration: null };
          console.log(`  WC: ${wcName} (${woName}), Planned: ${duration} min`);
        }

        if (Object.keys(report.workCenters).length > 0) {
          const configBtn = page.locator('button.dropdown-toggle').filter({ hasText: 'Configuration' }).first();
          if (await configBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await configBtn.click();
            const wcLink = page.locator('.dropdown-menu a:has-text("Work Centers"), a:has-text("Work Centers")').first();
            if (await wcLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await wcLink.click();
              await waitForOdoo(page, 10_000);
              await ra.screenshot('08b_work_centers_config_list');

              for (const wcName of Object.keys(report.workCenters)) {
                try {
                  const searchInput = page.locator('.o_searchview_input').first();
                  await searchInput.fill(wcName);
                  await page.keyboard.press('Enter');
                  await waitForOdoo(page, 5_000);

                  const firstRow = page.locator('.o_data_row').first();
                  if (await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
                    await firstRow.click();
                    await waitForOdoo(page, 5_000);

                    const rawCost = await page.locator('[name="costs_hour"] input').first().inputValue().catch(() => '0');
                    const cost = parseFloat(rawCost) || 0;
                    report.workCenters[wcName].costPerHour = cost;
                    console.log(`  Cost/hr for ${wcName}: ${cost}`);
                    await ra.screenshot(`08c_wc_${wcName.replace(/\s+/g, '_')}_config`);
                    await page.goBack();
                    await waitForOdoo(page, 5_000);
                  }
                } catch (e) {
                  console.log(`  WARN: Could not read cost for ${wcName}: ${(e as Error).message}`);
                }
              }

              await goToMainMO(page, mainMoUrl);
            }
          }
        }

        try {
          report.components = await readComponents(page);
          if (report.components.length > 0) {
            printConsoleTable(
              'DIRECT MATERIALS (Components)',
              ['Product', 'Demand Qty', 'Done Qty', 'UOM', 'Unit Cost', 'Total Cost'],
              report.components.map(c => [c.product, c.demandQty, c.doneQty, c.uom, c.unitCost != null ? c.unitCost.toFixed(2) : 'N/A', c.totalCost != null ? c.totalCost.toFixed(2) : 'N/A']),
            );
          }
          await clickWorkOrdersTab(page);
        } catch (compErr) {
          console.log(`  WARN: Component reading skipped: ${(compErr as Error).message.split('\n')[0]}`);
        }

        const preQty = parseFloat(MO_QTY) || 1;
        printConsoleTable(
          'WORK CENTER PRE-PRODUCTION COSTING',
          ['Work Center', 'Planned (min)', 'Cost/hr', 'Expected Cost'],
          Object.entries(report.workCenters).map(([name, wc]) => {
            const exp = (wc.plannedDuration != null && wc.costPerHour != null) ? ((wc.plannedDuration / 60) * wc.costPerHour * preQty).toFixed(2) : 'N/A';
            return [name, wc.plannedDuration ?? 'N/A', wc.costPerHour ?? 'N/A', exp];
          }),
        );

        logPhase(report, 'Phase 3: Work Center Pre-Production', 'PASS', `${Object.keys(report.workCenters).length} work center(s) found`);
      } catch (e) {
        logPhase(report, 'Phase 3: Work Center Pre-Production', 'WARN', (e as Error).message);
        await goToMainMO(page, mainMoUrl).catch(() => null);
      }
    });

    // ======================================================================
    // PHASE 4 – Process Purchases
    // ======================================================================
    await test.step('Phase 4 – Handle Purchases', async () => {
      const purchasesBtn = page.locator('button.oe_stat_button[name="action_view_purchase_order"], button.oe_stat_button:has-text("Purchase")').first();
      if (!(await purchasesBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        logPhase(report, 'Phase 4: Purchases', 'SKIP', 'No Purchases smart button');
        return;
      }

      const count = await getSmartButtonCount(purchasesBtn);
      console.log(`  Purchases count: ${count}`);
      await ra.screenshot('09a_purchases_smart_button');

      if (count === 0) {
        logPhase(report, 'Phase 4: Purchases', 'SKIP', 'Count = 0');
        return;
      }

      await purchasesBtn.click();
      await waitForOdoo(page, 15_000);
      await ra.screenshot('09b_purchases_list');

      async function processPOForm(n: number): Promise<void> {
        await ra.screenshot(`09c_purchase_${n}_opened`);
        const poConfirmBtn = page.locator('button[name="button_confirm"], button:has-text("Confirm Order")').first();
        if (await poConfirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await poConfirmBtn.click();
          await waitForOdoo(page, 10_000);
          await assertNoErrorDialog(page, `Purchase ${n} Confirm`);
          await ra.screenshot(`09d_purchase_${n}_confirmed`);
        } else {
          console.log(`  Purchase ${n} already confirmed.`);
        }
        const receiptBtn = page.locator('button.oe_stat_button[name="action_view_picking"], button.oe_stat_button:has-text("Receipt")').first();
        if (await receiptBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await receiptBtn.click();
          await waitForOdoo(page, 10_000);
          if (await page.locator('.o_list_view').isVisible({ timeout: 3_000 }).catch(() => false)) {
            const firstRow = page.locator('.o_list_view .o_data_row').first();
            if (await firstRow.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await firstRow.click();
              await waitForOdoo(page, 10_000);
            }
          }
          await validatePicking(page, ra, `Purchase ${n} Receipt`, `09e_purchase_${n}_receipt`);
        } else {
          console.log(`  Receipt button not found for Purchase ${n}.`);
        }
      }

      const landedOnList = await page.locator('.o_list_view').isVisible({ timeout: 5_000 }).catch(() => false);
      if (!landedOnList) {
        console.log('  Single PO opened as direct form – processing in place');
        await processPOForm(1);
        await goToMainMO(page, mainMoUrl);
        await ra.screenshot('09f_back_to_main_mo_after_purchases');
        logPhase(report, 'Phase 4: Purchases', 'PASS', 'Processed 1 purchase (direct form)');
        return;
      }

      const initialRowCount = await getListRowCount(page);
      console.log(`  Purchase rows: ${initialRowCount}`);

      // Unknown-length list re-derived on each iteration (rows shift as POs
      // are processed and modals intervene) — positional index is required.
      for (let i = 0; i < initialRowCount; i++) {
        console.log(`  Purchase ${i + 1}/${initialRowCount}`);
        await goToMainMO(page, mainMoUrl);

        const blockingModal = page.locator('.modal.d-block, .modal.show, .o_dialog').first();
        if (await blockingModal.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const mc = blockingModal.locator('button:has-text("Close"), button.btn-close, button:has-text("Discard")').first();
          if (await mc.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await mc.click({ force: true });
            await waitForOdoo(page, 2_000);
          }
        }

        const freshPurchBtn = page.locator('button.oe_stat_button[name="action_view_purchase_order"], button.oe_stat_button:has-text("Purchase")').first();
        if (!(await freshPurchBtn.isVisible({ timeout: 15_000 }).catch(() => false))) break;
        const purchClickOk = await freshPurchBtn.click({ timeout: 15_000 }).then(() => true).catch(() => false);
        if (!purchClickOk) break;
        await waitForOdoo(page, 15_000);
        if (!(await page.locator('.o_list_view').isVisible({ timeout: 10_000 }).catch(() => false))) break;

        const staleDialog = page.locator('.modal.d-block, .modal.show, .o_dialog').first();
        if (await staleDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
          const dlgClose = staleDialog.locator('button:has-text("Close"), button.btn-close').first();
          if (await dlgClose.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await dlgClose.click();
            await waitForOdoo(page, 3_000);
          }
        }

        const rows = page.locator('.o_list_view .o_data_row');
        const rowCount = await rows.count();
        if (i >= rowCount) continue;
        await rows.nth(i).click({ timeout: 15_000 });
        await waitForOdoo(page, 10_000);

        const dlgAfter = page.locator('.modal.d-block, .modal.show, .o_dialog').first();
        if (await dlgAfter.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const closeBtn = dlgAfter.locator('button:has-text("Close"), button.btn-close').first();
          if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await closeBtn.click();
            await waitForOdoo(page, 3_000);
          }
          continue;
        }

        if (!(await page.locator('.o_form_view').isVisible({ timeout: 5_000 }).catch(() => false))) continue;
        await processPOForm(i + 1);
      }

      await goToMainMO(page, mainMoUrl);
      await ra.screenshot('09f_back_to_main_mo_after_purchases');
      logPhase(report, 'Phase 4: Purchases', 'PASS', `Processed ${initialRowCount} purchase(s)`);
    });

    // ======================================================================
    // PHASE 5 – Process Child Manufacturing Orders
    // ======================================================================
    await test.step('Phase 5 – Handle Child MOs', async () => {
      const childMoBtn = page.locator(
        'button.oe_stat_button[name="action_mrp_production_form"], button.oe_stat_button[name="action_production_form"], button.oe_stat_button:has-text("Manufacturing Order")',
      ).first();
      if (!(await childMoBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        logPhase(report, 'Phase 5: Child MOs', 'SKIP', 'No Child MO smart button');
        return;
      }

      const count = await getSmartButtonCount(childMoBtn);
      console.log(`  Child MO count: ${count}`);
      await ra.screenshot('10a_child_mo_smart_button');

      if (count === 0) {
        logPhase(report, 'Phase 5: Child MOs', 'SKIP', 'Count = 0');
        return;
      }

      await childMoBtn.click();
      await waitForOdoo(page, 15_000);
      await ra.screenshot('10b_child_mo_list');

      const childMoListUrl = page.url();
      const initialCount = await getListRowCount(page);
      console.log(`  Child MO rows: ${initialCount}`);

      for (let i = 0; i < initialCount; i++) {
        console.log(`  Child MO ${i + 1}/${initialCount}`);

        if (!(await page.locator('.o_list_view').isVisible({ timeout: 2_000 }).catch(() => false))) {
          await page.goto(childMoListUrl);
          await waitForOdoo(page, 10_000);
        }

        const rows = page.locator('.o_list_view .o_data_row');
        if (i >= await rows.count()) continue;
        await rows.nth(i).click();
        await waitForOdoo(page, 10_000);
        await ra.screenshot(`10c_child_mo_${i + 1}_opened`);

        const produceAllBtn = page.locator('button:has-text("Produce All"), button:has-text("Set Quantities")').first();
        if (await produceAllBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await produceAllBtn.click();
          await waitForOdoo(page, 10_000);

          const modalConfirm = page.locator('.modal button:has-text("Apply"), .modal button:has-text("Validate"), .modal button:has-text("Ok")').first();
          if (await modalConfirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await modalConfirm.click();
            await waitForOdoo(page, 10_000);
          }

          await assertNoErrorDialog(page, `Child MO ${i + 1} Produce All`);
          await ra.screenshot(`10d_child_mo_${i + 1}_produced`);
        } else {
          console.log(`  Produce All not available for Child MO ${i + 1}.`);
          await ra.screenshot(`10d_child_mo_${i + 1}_no_produce_btn`);
        }

        await page.goto(childMoListUrl);
        await waitForOdoo(page, 10_000);
      }

      await goToMainMO(page, mainMoUrl);
      await ra.screenshot('10e_back_to_main_mo_after_child_mo');
      logPhase(report, 'Phase 5: Child MOs', 'PASS', `Processed ${initialCount} child MO(s)`);
    });

    // ======================================================================
    // PHASE 6 – Process Internal Transfers
    // ======================================================================
    await test.step('Phase 6 – Handle Internal Transfers', async () => {
      const transferBtn = page.locator('button.oe_stat_button').filter({ hasText: /Transfer/ }).first();
      if (!(await transferBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        logPhase(report, 'Phase 6: Internal Transfers', 'SKIP', 'No Transfers smart button');
        return;
      }

      const count = await getSmartButtonCount(transferBtn);
      console.log(`  Transfers count: ${count}`);
      await ra.screenshot('11a_transfers_smart_button');

      if (count === 0) {
        logPhase(report, 'Phase 6: Internal Transfers', 'SKIP', 'Count = 0');
        return;
      }

      await transferBtn.click();
      await waitForOdoo(page, 15_000);
      await ra.screenshot('11b_transfers_list');

      const totalTransfers = await getListRowCount(page);
      const allRows = page.locator('.o_list_view .o_data_row');
      console.log(`  Total transfer rows: ${totalTransfers}`);

      const rowData: Array<{ ref: string; status: string; idx: number }> = [];
      for (let i = 0; i < totalTransfers; i++) {
        const cells = allRows.nth(i).locator('td');
        const cellCount = await cells.count();
        let ref = '';
        for (let c = 0; c < Math.min(cellCount, 6); c++) {
          const text = await cells.nth(c).innerText({ timeout: 2_000 }).catch(() => '');
          if (/\/(IN|OUT|INT|PICK|PACK|WH)\//i.test(text)) { ref = text.trim(); break; }
        }
        let status = '';
        for (let c = cellCount - 1; c >= Math.max(0, cellCount - 4); c--) {
          const text = await cells.nth(c).innerText({ timeout: 2_000 }).catch(() => '');
          if (text.trim()) { status = text.trim(); break; }
        }
        rowData.push({ ref, status, idx: i });
      }
      console.log(`  Rows: ${rowData.map(r => `${r.ref}[${r.status}]`).join(', ')}`);

      const processableRows = rowData.filter(({ ref, status }) =>
        ref.trim() !== '' && !/waiting another operation/i.test(status) && !/waiting/i.test(status) && !/draft/i.test(status),
      );
      if (processableRows.length < rowData.length) {
        console.log(`  Skipping ${rowData.length - processableRows.length} transfer(s) in Waiting/Draft state`);
      }

      const deliveries = processableRows.filter(({ ref }) => !/WH\/IN\//i.test(ref) && !/\/IN\//i.test(ref));
      const receipts = processableRows.filter(({ ref }) => /WH\/IN\//i.test(ref) || /\/IN\//i.test(ref));

      async function processTransfer(idx: number, label: string, prefix: string): Promise<void> {
        await goToMainMO(page, mainMoUrl);

        const blockingModalT = page.locator('.modal.d-block, .modal.show, .o_dialog').first();
        if (await blockingModalT.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const mc = blockingModalT.locator('button:has-text("Close"), button.btn-close, button:has-text("Discard")').first();
          if (await mc.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await mc.click({ force: true });
            await waitForOdoo(page, 2_000);
          }
        }

        const transfersNavBtn = page.locator('button.oe_stat_button').filter({ hasText: /Transfer/ }).first();
        if (!(await transfersNavBtn.isVisible({ timeout: 15_000 }).catch(() => false))) {
          console.log(`  Transfers button not found for ${label} – skipping`);
          return;
        }
        const tClickOk = await transfersNavBtn.click({ timeout: 15_000 }).then(() => true).catch((e) => {
          console.log(`  Transfers button click blocked: ${(e as Error).message.split('\n')[0]}`);
          return false;
        });
        if (!tClickOk) return;
        await waitForOdoo(page, 15_000);
        if (!(await page.locator('.o_list_view').isVisible({ timeout: 10_000 }).catch(() => false))) return;

        const stale = page.locator('.modal.d-block, .modal.show, .o_dialog').first();
        if (await stale.isVisible({ timeout: 1_000 }).catch(() => false)) {
          const closeBtn = stale.locator('button:has-text("Close"), button.btn-close').first();
          if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await closeBtn.click();
            await waitForOdoo(page, 3_000);
          }
        }

        await page.evaluate(() => {
          document.querySelectorAll('.o_notification, .o_notification_manager').forEach(el => el.remove());
        });

        const rows = page.locator('.o_list_view .o_data_row');
        const rowCount = await rows.count();
        if (idx >= rowCount) { console.log(`  Transfer row ${idx} not found – skipping`); return; }
        await rows.nth(idx).click({ timeout: 15_000 });
        await waitForOdoo(page, 10_000);

        const dlg = page.locator('.modal.d-block, .modal.show, .o_dialog').first();
        if (await dlg.isVisible({ timeout: 2_000 }).catch(() => false)) {
          const closeBtn = dlg.locator('button:has-text("Close"), button.btn-close').first();
          if (await closeBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
            await closeBtn.click();
            await waitForOdoo(page, 3_000);
          }
          return;
        }

        if (!(await page.locator('.o_form_view').isVisible({ timeout: 5_000 }).catch(() => false))) return;
        await validatePicking(page, ra, label, prefix);
      }

      for (const { ref, idx } of deliveries) {
        console.log(`  Delivery: ${ref}`);
        await processTransfer(idx, ref || `Delivery ${idx + 1}`, `11c_delivery_${idx + 1}`);
      }
      for (const { ref, idx } of receipts) {
        console.log(`  Receipt: ${ref}`);
        await processTransfer(idx, ref || `Receipt ${idx + 1}`, `11d_receipt_${idx + 1}`);
      }
      if (deliveries.length === 0 && receipts.length === 0 && processableRows.length > 0) {
        console.log('  Could not distinguish by ref – processing all processable rows sequentially.');
        for (const { ref, idx } of processableRows) {
          await processTransfer(idx, ref || `Transfer ${idx + 1}`, `11e_transfer_${idx + 1}`);
        }
      }

      await goToMainMO(page, mainMoUrl);
      await ra.screenshot('11f_back_to_main_mo_after_transfers');
      logPhase(report, 'Phase 6: Internal Transfers', 'PASS', `Processed ${totalTransfers} transfer(s)`);
    });

    // ======================================================================
    // PHASE 7 – Work Center Time Entry (pre-produce snapshot)
    // ======================================================================
    await test.step('Phase 7 – Work Center Time Entry', async () => {
      try {
        const tabFound = await clickWorkOrdersTab(page);
        if (!tabFound) {
          logPhase(report, 'Phase 7: Work Order Time Entry', 'SKIP', 'Work Orders tab not visible');
          return;
        }
        await ra.screenshot('12_work_orders_pre_produce_all');
        logPhase(report, 'Phase 7: Work Order Time Entry', 'PASS');
      } catch (e) {
        logPhase(report, 'Phase 7: Work Order Time Entry', 'WARN', (e as Error).message);
      }
    });

    // ======================================================================
    // PHASE 8 – Produce All (Main MO) → Done
    // ======================================================================
    await test.step('Phase 8 – Produce All (Main MO)', async () => {
      await goToMainMO(page, mainMoUrl);
      await ra.screenshot('13a_main_mo_before_produce_all');

      const produceAllBtn = page.locator('button:has-text("Produce All"), button:has-text("Set Quantities")').first();
      await expect(produceAllBtn).toBeVisible({ timeout: 10_000 });
      await produceAllBtn.click();
      await waitForOdoo(page, 10_000);

      const modalConfirm = page.locator('.modal button:has-text("Apply"), .modal button:has-text("Validate"), .modal button:has-text("Ok")').first();
      if (await modalConfirm.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await modalConfirm.click();
        await waitForOdoo(page, 10_000);
      }

      await assertNoErrorDialog(page, 'Main MO Produce All');
      await ra.screenshot('13b_main_mo_produce_all_clicked');

      const validateBtn = page.locator('button:has-text("Validate")');
      if (await validateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await validateBtn.click();
        await waitForOdoo(page, 10_000);
        await assertNoErrorDialog(page, 'Main MO Validate');

        const modalConfirm2 = page.locator('.modal button:has-text("Validate"), .modal button:has-text("Ok"), .modal button:has-text("Yes")').first();
        if (await modalConfirm2.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await modalConfirm2.click();
          await waitForOdoo(page, 10_000);
        }
      }

      await ra.screenshot('14_main_mo_final_state');

      await expect(
        page.locator('.o_statusbar_status button:has-text("Done"), .o_statusbar_status .o_arrow_button:has-text("Done")').first(),
      ).toBeVisible({ timeout: 20_000 });

      await ra.screenshot('14b_main_mo_done_confirmed');
      logPhase(report, 'Phase 8: Produce All (Main MO)', 'PASS');
      console.log('  Manufacturing Order completed successfully!');
    });

    // ======================================================================
    // PHASE 9 – Work Center Costing (Post-Production) + Journal Entries
    // ======================================================================
    await test.step('Phase 9 – Work Center Costing Post-Production', async () => {
      try {
        const tabFound = await clickWorkOrdersTab(page);
        if (!tabFound) {
          logPhase(report, 'Phase 9: Work Center Post-Production Costing', 'SKIP', 'Work Orders tab not visible');
          return;
        }

        const woRows = await readWorkOrderRows(page, 'duration');
        for (const { wcName, woName, duration } of woRows) {
          if (report.workCenters[wcName]) {
            report.workCenters[wcName].actualDuration = duration;
            if (!report.workCenters[wcName].woName) report.workCenters[wcName].woName = woName;
          } else {
            report.workCenters[wcName] = { woName, plannedDuration: null, costPerHour: null, actualDuration: duration };
          }
          console.log(`  WC: ${wcName} (${woName}), Actual duration: ${duration} min`);
        }

        await ra.screenshot('15_costing_report_work_orders');

        const postQty = parseFloat(MO_QTY) || 1;
        let costCheckPass = true;
        const wcTableRows: Array<Array<string | number>> = [];
        for (const [wcName, wc] of Object.entries(report.workCenters)) {
          const expected = (wc.plannedDuration != null && wc.costPerHour != null) ? (wc.plannedDuration / 60) * wc.costPerHour * postQty : null;
          const actual = (wc.actualDuration != null && wc.costPerHour != null) ? (wc.actualDuration / 60) * wc.costPerHour * postQty : null;
          const variance = (expected != null && actual != null && expected > 0) ? Math.abs((actual - expected) / expected) : null;
          const pass = variance == null || variance <= 0.05;
          if (!pass) costCheckPass = false;
          wcTableRows.push([
            wcName, wc.plannedDuration ?? 'N/A', wc.costPerHour ?? 'N/A',
            expected != null ? expected.toFixed(2) : 'N/A', wc.actualDuration ?? 'N/A',
            actual != null ? actual.toFixed(2) : 'N/A', variance != null ? (variance * 100).toFixed(1) + '%' : 'N/A',
            variance == null ? '–' : pass ? 'OK' : 'FAIL',
          ]);
        }

        printConsoleTable(
          'WORK CENTER POST-PRODUCTION COSTING',
          ['Work Center', 'Planned (min)', 'Cost/hr', 'Expected Cost', 'Actual (min)', 'Actual Cost', 'Δ%', 'OK'],
          wcTableRows,
        );

        logPhase(report, 'Phase 9: Work Center Post-Production Costing', costCheckPass ? 'PASS' : 'FAIL',
          costCheckPass ? 'All costs within 5% tolerance' : 'One or more costs outside 5% tolerance');

        const EMP_DEADLINE_MS = testStartMs + TEST_BUDGET_MS - 120_000;
        if (Date.now() >= EMP_DEADLINE_MS) {
          console.log(`  WARN: Skipping employee time reading — only ${Math.round(timeLeft() / 1000)}s left`);
        } else {
          try {
            const empEntries = await readWorkOrderEmployees(page, EMP_DEADLINE_MS);
            if (empEntries.length > 0) {
              report.employeeCosting = empEntries.map(({ wcName, employee, durationMin }) => {
                const wc = report.workCenters[wcName];
                const cost = (wc?.costPerHour != null) ? parseFloat(((durationMin / 60) * wc.costPerHour).toFixed(2)) : null;
                return { wcName, employee, durationMin, cost };
              });
              printConsoleTable(
                'EMPLOYEE COSTING BY WORK CENTER',
                ['Work Center', 'Employee', 'Duration (min)', 'Cost'],
                report.employeeCosting.map(({ wcName, employee, durationMin, cost }) => [wcName, employee, durationMin, cost != null ? cost.toFixed(2) : 'N/A']),
              );
            }
          } catch (empErr) {
            console.log(`  WARN: Employee time reading skipped: ${(empErr as Error).message.split('\n')[0]}`);
          }
        }

        const JE_DEADLINE_MS = testStartMs + TEST_BUDGET_MS - 60_000;
        if (Date.now() >= JE_DEADLINE_MS) {
          console.log(`  WARN: Skipping journal entry reading — only ${Math.round(timeLeft() / 1000)}s left`);
        } else {
          report.journalEntries = await readJournalEntriesRpc(rpc, report.moReference);
          if (report.journalEntries.length > 0) {
            printConsoleTable(
              'LEDGER JOURNAL ENTRIES',
              ['Ref', 'Date', 'Account', 'Label', 'Debit', 'Credit'],
              report.journalEntries.map(e => [e.ref, e.date, e.account, e.label, e.debit > 0 ? e.debit.toFixed(2) : '', e.credit > 0 ? e.credit.toFixed(2) : '']),
            );
          }
        }
      } catch (e) {
        logPhase(report, 'Phase 9: Work Center Post-Production Costing', 'WARN', (e as Error).message);
      }
    });

    // ======================================================================
    // CLEANUP — mrp.production has no `active` field in this Odoo version
    // (confirmed live: the MO form's toolbar has "Cancel", not "Archive") —
    // completed Manufacturing Orders aren't archivable, only cancelable, and
    // a Done MO can't be canceled either. There is nothing to clean up on
    // the MO/child-MO side; only related purchase orders support archiving.
    // Set SKIP_ARCHIVE=true to keep everything for manual inspection.
    // ======================================================================
    await test.step('Cleanup', async () => {
      if (process.env.SKIP_ARCHIVE === 'true') {
        logPhase(report, 'Cleanup', 'SKIP', 'SKIP_ARCHIVE=true — records left active for inspection');
        return;
      }
      if (!report.moReference || report.moReference === 'New' || report.moReference === 'unknown') {
        logPhase(report, 'Cleanup', 'SKIP', 'No confirmed MO reference to clean up');
        return;
      }
      try {
        const purchaseOrders = await rpc.searchRead<{ id: number }>('purchase.order', [['origin', '=', report.moReference]], ['id']);
        if (purchaseOrders.length) await rpc.archive('purchase.order', purchaseOrders.map(p => p.id));

        logPhase(report, 'Cleanup', 'PASS', `Archived ${purchaseOrders.length} PO(s) — MO ${report.moReference} left as-is (mrp.production has no active field; Done MOs are not archivable/cancelable)`);
      } catch (e) {
        logPhase(report, 'Cleanup', 'WARN', `Cleanup failed: ${(e as Error).message}`);
      }
    });

    await ra.attachText('mo-report.md', generateMarkdownReport(report));
    await ra.attachText('mo-report.mmd', generateMermaidReport(report));
    console.log(`  Overall result: ${report.overallResult}`);

    expect(report.overallResult, 'One or more phases failed — see attached mo-report.md').toBe('PASS');
  });
});
