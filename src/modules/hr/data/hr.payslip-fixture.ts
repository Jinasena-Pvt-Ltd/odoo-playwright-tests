import type { Page } from "@playwright/test";
import { uniqueName } from "../../../core/utils/RandomDataGenerator";

/** Odoo call_kw over the browser's own session (logging in over RPC would end it on this database). */
export function browserCall(page: Page) {
  return async (model: string, method: string, args: unknown[], kwargs: object = {}) => {
    const body = await (
      await page.request.post(`/web/dataset/call_kw/${model}/${method}`, {
        data: { jsonrpc: "2.0", method: "call", params: { model, method, args, kwargs } },
      })
    ).json();
    if (body.error) throw new Error(`${model}.${method}: ${body.error.data?.message ?? body.error.message}`);
    return body.result;
  };
}

export type BrowserCall = ReturnType<typeof browserCall>;

/** A fresh draft payslip, so a tour that computes or edits one never depends on what earlier runs left. */
export async function createDraftPayslip(page: Page, call: BrowserCall): Promise<number> {
  // The UI runs in the user's current company; a payslip in another company cannot be opened there.
  const info = await (
    await page.request.post("/web/session/get_session_info", { data: { jsonrpc: "2.0", method: "call", params: {} } })
  ).json();
  const current = info.result.user_companies.current_company;
  const companyId: number = Array.isArray(current) ? current[0] : current;
  const [contract] = await call("hr.contract", "search_read", [[["state", "=", "open"], ["company_id", "=", companyId]]], {
    fields: ["id", "employee_id", "structure_type_id", "company_id"],
    limit: 1,
  });
  if (!contract) throw new Error(`No running contract in company ${companyId} to create a payslip for`);
  const [struct] = await call("hr.payroll.structure", "search_read", [[["type_id", "=", contract.structure_type_id[0]]]], {
    fields: ["id"],
    limit: 1,
  });
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  return call("hr.payslip", "create", [
    {
      name: uniqueName("Tour"),
      // Same company as the contract: records of another company are not readable in the UI.
      company_id: contract.company_id[0],
      employee_id: contract.employee_id[0],
      contract_id: contract.id,
      struct_id: struct.id,
      date_from: `2035-${month}-01`,
      date_to: `2035-${month}-28`,
    },
  ]);
}

/** Cancel (if needed) and delete a payslip created by createDraftPayslip. */
export async function dropPayslip(call: BrowserCall, id: number): Promise<void> {
  await call("hr.payslip", "action_payslip_cancel", [[id]]).catch(() => {});
  await call("hr.payslip", "unlink", [[id]]).catch(() => {});
}

/** A fresh expense report in the Submitted state, ready for a manager to approve. */
export async function createSubmittedExpenseSheet(page: Page, call: BrowserCall): Promise<number> {
  const info = await (
    await page.request.post("/web/session/get_session_info", { data: { jsonrpc: "2.0", method: "call", params: {} } })
  ).json();
  const [employee] = await call("hr.employee", "search_read", [[["user_id", "=", info.result.uid]]], { fields: ["id"], limit: 1 });
  // Company-less product, so it can be used from whichever company the UI is in.
  const [product] = await call("product.product", "search_read", [[["can_be_expensed", "=", true], ["company_id", "=", false]]], {
    fields: ["id"],
    limit: 1,
  });
  if (!employee || !product) throw new Error("Need an employee linked to the login user and an expensable product");
  const expense = await call("hr.expense", "create", [
    { name: uniqueName("Tour"), employee_id: employee.id, product_id: product.id, total_amount: 100 },
  ]);
  const action = await call("hr.expense", "action_submit_expenses", [[expense]]);
  await call("hr.expense.sheet", "action_submit_sheet", [[action.res_id]]);
  return action.res_id;
}

/** Remove a sheet made by createSubmittedExpenseSheet (best effort: approved sheets may refuse). */
export async function dropExpenseSheet(call: BrowserCall, id: number): Promise<void> {
  await call("hr.expense.sheet", "action_reset_expense_sheets", [[id]]).catch(() => {});
  const [sheet] = await call("hr.expense.sheet", "read", [[id], ["expense_line_ids"]]).catch(() => []);
  await call("hr.expense.sheet", "unlink", [[id]]).catch(() => {});
  if (sheet?.expense_line_ids?.length) await call("hr.expense", "unlink", [sheet.expense_line_ids]).catch(() => {});
}

/** A fresh payslip batch in the Confirmed state (one computed payslip), ready for "Create Draft Entry". */
export async function createConfirmedBatch(page: Page, call: BrowserCall): Promise<{ batchId: number; slipId: number; name: string }> {
  const slipId = await createDraftPayslip(page, call);
  const [slip] = await call("hr.payslip", "read", [[slipId], ["date_from", "date_to"]]);
  const name = uniqueName("Tour");
  const batchId = await call("hr.payslip.run", "create", [{ name, date_start: slip.date_from, date_end: slip.date_to }]);
  await call("hr.payslip", "write", [[slipId], { payslip_run_id: batchId }]);
  await call("hr.payslip", "compute_sheet", [[slipId]]);
  return { batchId, slipId, name };
}

/** Remove a batch made by createConfirmedBatch (best effort: a confirmed batch may refuse). */
export async function dropBatch(call: BrowserCall, batchId: number, slipId: number): Promise<void> {
  await call("hr.payslip.run", "action_draft", [[batchId]]).catch(() => {});
  await dropPayslip(call, slipId);
  await call("hr.payslip.run", "unlink", [[batchId]]).catch(() => {});
}

/** A fresh time off request in To Approve, for an employee the login user approves. */
export async function createPendingLeave(
  page: Page,
  call: BrowserCall,
): Promise<{ id: number; name: string; employeeName: string }> {
  const info = await (
    await page.request.post("/web/session/get_session_info", { data: { jsonrpc: "2.0", method: "call", params: {} } })
  ).json();
  const current = info.result.user_companies.current_company;
  const companyId: number = Array.isArray(current) ? current[0] : current;
  // An employee in the UI's company whom the login user approves, so "Waiting For Me" lists the request.
  const [employee] = await call(
    "hr.employee",
    "search_read",
    [[["leave_manager_id", "=", info.result.uid], ["company_id", "=", companyId], ["user_id", "!=", info.result.uid]]],
    { fields: ["id", "name"], limit: 1 },
  );
  const [type] = await call(
    "hr.leave.type",
    "search_read",
    [[["leave_validation_type", "in", ["manager", "both"]], ["requires_allocation", "=", "no"]]],
    { fields: ["id", "leave_validation_type"], order: "leave_validation_type", limit: 1 },
  );
  if (!employee || !type) throw new Error("Need an employee the login user approves (in the current company) and a leave type that needs approval");
  // A random working day far ahead; if it collides with a request from an earlier run, try another.
  const name = uniqueName("Tour");
  for (let attempt = 0; ; attempt++) {
    const day = new Date(Date.UTC(2035, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)));
    while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
    const date = day.toISOString().slice(0, 10);
    try {
      const id = await call("hr.leave", "create", [
        { name, employee_id: employee.id, holiday_status_id: type.id, request_date_from: date, request_date_to: date },
      ]);
      return { id, name, employeeName: employee.name };
    } catch (e) {
      if (attempt >= 20 || !/overlap/i.test(String(e))) throw e;
    }
  }

}

/** A fresh payslip batch in the Done state, ready for "Mark as paid". */
export async function createDoneBatch(page: Page, call: BrowserCall): Promise<{ batchId: number; slipId: number; name: string }> {
  const batch = await createConfirmedBatch(page, call);
  await call("hr.payslip.run", "action_validate", [[batch.batchId]]);
  return batch;
}
