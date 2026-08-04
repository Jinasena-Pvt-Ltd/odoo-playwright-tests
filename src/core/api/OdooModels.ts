export type OdooId = number;
export type OdooDomainValue = string | number | boolean | null | (string | number | boolean | null)[];
export type OdooDomain = Array<string | OdooDomainValue[]>;

export interface OdooRecord {
  id: OdooId;
}

export interface OdooMany2One {
  id: OdooId;
  display_name: string;
}

// Generic shape returned by search_read
export interface OdooSearchReadResult<T> {
  records: T[];
  length: number;
}

// res.users
export interface OdooUser extends OdooRecord {
  name: string;
  login: string;
  email: string;
  active: boolean;
  groups_id: OdooId[];
}

// res.company
export interface OdooCompany extends OdooRecord {
  name: string;
  currency_id: [OdooId, string];
  country_id: [OdooId, string] | false;
}

// hr.department
export interface HrDepartment extends OdooRecord {
  name: string;
  complete_name: string;
  parent_id: [OdooId, string] | false;
  company_id: [OdooId, string];
  active: boolean;
}

// hr.job
export interface HrJob extends OdooRecord {
  name: string;
  department_id: [OdooId, string] | false;
  company_id: [OdooId, string];
  no_of_recruitment: number;
  active: boolean;
}

// hr.employee
export interface HrEmployee extends OdooRecord {
  name: string;
  job_id: [OdooId, string] | false;
  job_title: string;
  department_id: [OdooId, string] | false;
  parent_id: [OdooId, string] | false;
  work_email: string;
  work_phone: string;
  company_id: [OdooId, string];
  active: boolean;
}

// hr.contract
export interface HrContract extends OdooRecord {
  name: string;
  employee_id: [OdooId, string];
  job_id: [OdooId, string] | false;
  wage: number;
  date_start: string;
  date_end: string | false;
  state: 'draft' | 'open' | 'close' | 'cancel';
  active: boolean;
}

// hr.leave.type
export interface HrLeaveType extends OdooRecord {
  name: string;
  leave_validation_type: string;
  allocation_type: string;
  active: boolean;
}

// hr.leave (leave request)
export interface HrLeave extends OdooRecord {
  name: string;
  employee_id: [OdooId, string];
  holiday_status_id: [OdooId, string];
  date_from: string;
  date_to: string;
  number_of_days: number;
  state: 'draft' | 'confirm' | 'validate1' | 'validate' | 'refuse';
}

// hr.attendance
export interface HrAttendance extends OdooRecord {
  employee_id: [OdooId, string];
  check_in: string;           // "YYYY-MM-DD HH:MM:SS" UTC
  check_out: string | false;  // false = currently clocked in
  worked_hours: number;       // computed float
  active: boolean;
}

// hr.leave.allocation
export interface HrLeaveAllocation extends OdooRecord {
  employee_id: [OdooId, string];
  holiday_status_id: [OdooId, string];
  number_of_days: number;
  state: 'draft' | 'confirm' | 'validate1' | 'validate' | 'refuse';
  active: boolean;
}

// hr.payroll.structure (Odoo 17 — was hr.salary.structure in older versions)
export interface HrSalaryStructure extends OdooRecord {
  name: string;
  type_id: [OdooId, string];
  active: boolean;
}

// hr.payslip
export interface HrPayslip extends OdooRecord {
  name: string;
  employee_id: [OdooId, string];
  date_from: string;
  date_to: string;
  struct_id: [OdooId, string] | false;
  state: 'draft' | 'verify' | 'done' | 'cancel';
  net_wage: number;
  line_ids: OdooId[];
}

// hr.payslip.run
export interface HrPayslipRun extends OdooRecord {
  name: string;
  date_start: string;
  date_end: string;
  state: 'draft' | 'confirm' | 'close';
  slip_ids: OdooId[];
}

// RPC response envelope
export interface OdooRPCResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data: {
      name: string;
      debug: string;
      message: string;
      arguments: unknown[];
    };
  };
}

// call_kw result shapes
export interface SearchReadResult<T> {
  records: T[];
  length: number;
}
