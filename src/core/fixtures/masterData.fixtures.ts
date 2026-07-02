import { test as base, request } from '@playwright/test';
import { createOdooRPC } from '../api/OdooRPC';
import { RUN_TAG, uniqueName } from '../utils/RandomDataGenerator';
import { today, addDays } from '../utils/DateHelper';
import type { OdooId } from '../api/OdooModels';

export interface HrMasterData {
  runTag: string;
  departmentId: OdooId;
  departmentName: string;
  jobId: OdooId;
  jobName: string;
  employeeId: OdooId;
  employeeName: string;
  contractId: OdooId;
  contractName: string;
  wage: number;
}

export interface AttendanceMasterData {
  runTag: string;
  employeeId: OdooId;
  employeeName: string;
  attendanceIds: OdooId[];  // 2 pre-created records
}

export interface LeaveMasterData {
  runTag: string;
  employeeId: OdooId;
  employeeName: string;
  leaveTypeId: OdooId;
  leaveTypeName: string;
  leaveValidationType: string;  // 'no_validation' | 'time_off' | 'set' | 'both'
  allocationId: OdooId;         // 0 if no allocation needed/created
  allocatedDays: number;        // 0 if no allocation
}

export interface PayrollMasterData {
  runTag: string;
  employeeId: OdooId;
  employeeName: string;
  contractId: OdooId;
  contractName: string;
  wage: number;
  structureId: OdooId;     // 0 if payroll not installed or no structure found
  structureName: string;
}

export type MasterDataWorkerFixtures = {
  hrMasterData: HrMasterData;
  attendanceMasterData: AttendanceMasterData;
  leaveMasterData: LeaveMasterData;
  payrollMasterData: PayrollMasterData;
};

// Set SKIP_ARCHIVE=true in .env to keep records visible in Odoo after the run (useful for debugging)
const SKIP_ARCHIVE = process.env.SKIP_ARCHIVE === 'true';

export const test = base.extend<{}, MasterDataWorkerFixtures>({
  hrMasterData: [
    async ({}, use) => {
      const reqCtx = await request.newContext();
      const rpc = createOdooRPC(reqCtx);

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║        HR MASTER DATA — SETUP            ║');
      console.log(`║  Run Tag: ${RUN_TAG.padEnd(30)}║`);
      console.log('╚══════════════════════════════════════════╝');

      await rpc.authenticate(
        process.env.ADMIN_EMAIL ?? 'admin',
        process.env.ADMIN_PASSWORD ?? 'admin',
      );
      console.log('  ✔ Authenticated as admin');

      const created: Array<{ model: string; id: OdooId; name: string }> = [];

      const departmentName = uniqueName('Test Department');
      const departmentId = await rpc.create<{ name: string }>('hr.department', { name: departmentName });
      created.push({ model: 'hr.department', id: departmentId, name: departmentName });
      console.log(`  ✔ Department created  → id=${departmentId}  "${departmentName}"`);

      const jobName = uniqueName('Test Job Position');
      const jobId = await rpc.create<{ name: string; department_id: OdooId }>('hr.job', {
        name: jobName,
        department_id: departmentId,
      });
      created.push({ model: 'hr.job', id: jobId, name: jobName });
      console.log(`  ✔ Job Position created → id=${jobId}  "${jobName}"`);

      const employeeName = uniqueName('Test Employee');
      const employeeId = await rpc.create<{
        name: string;
        department_id: OdooId;
        job_id: OdooId;
        work_email: string;
      }>('hr.employee', {
        name: employeeName,
        department_id: departmentId,
        job_id: jobId,
        work_email: `test.${RUN_TAG.toLowerCase()}@example.com`,
      });
      created.push({ model: 'hr.employee', id: employeeId, name: employeeName });
      console.log(`  ✔ Employee created     → id=${employeeId}  "${employeeName}"`);

      const wage = 5000;
      const contractName = uniqueName('Test Contract');
      const contractId = await rpc.create<{
        name: string;
        employee_id: OdooId;
        wage: number;
        date_start: string;
      }>('hr.contract', {
        name: contractName,
        employee_id: employeeId,
        wage,
        date_start: today(),
      });
      created.push({ model: 'hr.contract', id: contractId, name: contractName });
      console.log(`  ✔ Contract created     → id=${contractId}  "${contractName}"  wage=${wage}`);

      if (SKIP_ARCHIVE) {
        console.log('\n  ℹ SKIP_ARCHIVE=true — records will NOT be archived after the run');
      }
      console.log('  ─────────────────────────────────────────');

      await use({
        runTag: RUN_TAG,
        departmentId,
        departmentName,
        jobId,
        jobName,
        employeeId,
        employeeName,
        contractId,
        contractName,
        wage,
      });

      // ── Teardown ──────────────────────────────────────────────────────────────
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║        HR MASTER DATA — TEARDOWN         ║');
      console.log('╚══════════════════════════════════════════╝');

      if (SKIP_ARCHIVE) {
        console.log('  ℹ SKIP_ARCHIVE=true — skipping archive. Records remain active in Odoo.');
        console.log(`  ℹ Search for "[TEST]" or run tag "${RUN_TAG}" to find them.\n`);
      } else {
        for (const record of [...created].reverse()) {
          await rpc.archive(record.model, [record.id])
            .then(() => console.log(`  ✔ Archived ${record.model} id=${record.id} "${record.name}"`))
            .catch((err: Error) => console.warn(`  ✘ Could not archive ${record.model}#${record.id}: ${err.message}`));
        }
        console.log('');
      }

      await reqCtx.dispose();
    },
    { scope: 'worker' },
  ],

  attendanceMasterData: [
    async ({}, use) => {
      const reqCtx = await request.newContext();
      const rpc = createOdooRPC(reqCtx);

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║     ATTENDANCE MASTER DATA — SETUP       ║');
      console.log(`║  Run Tag: ${RUN_TAG.padEnd(30)}║`);
      console.log('╚══════════════════════════════════════════╝');

      await rpc.authenticate(
        process.env.ADMIN_EMAIL ?? 'admin',
        process.env.ADMIN_PASSWORD ?? 'admin',
      );
      console.log('  ✔ Authenticated as admin');

      const employeeName = uniqueName('Attendance Employee');
      const employeeId = await rpc.create<{ name: string; work_email: string }>('hr.employee', {
        name: employeeName,
        work_email: `attendance.${RUN_TAG.toLowerCase()}@example.com`,
      });
      console.log(`  ✔ Employee created     → id=${employeeId}  "${employeeName}"`);

      const todayStr = today();
      const yesterdayStr = addDays(todayStr, -1);

      const attendanceIds: OdooId[] = [];

      const att1Id = await rpc.create<{ employee_id: OdooId; check_in: string; check_out: string }>(
        'hr.attendance',
        {
          employee_id: employeeId,
          check_in: `${yesterdayStr} 09:00:00`,
          check_out: `${yesterdayStr} 17:00:00`,
        },
      );
      attendanceIds.push(att1Id);
      console.log(`  ✔ Attendance 1 created → id=${att1Id}  (yesterday 09:00–17:00 = 8h)`);

      const att2Id = await rpc.create<{ employee_id: OdooId; check_in: string; check_out: string }>(
        'hr.attendance',
        {
          employee_id: employeeId,
          check_in: `${todayStr} 09:00:00`,
          check_out: `${todayStr} 13:00:00`,
        },
      );
      attendanceIds.push(att2Id);
      console.log(`  ✔ Attendance 2 created → id=${att2Id}  (today 09:00–13:00 = 4h)`);
      console.log('  ─────────────────────────────────────────');

      await use({ runTag: RUN_TAG, employeeId, employeeName, attendanceIds });

      // ── Teardown ──────────────────────────────────────────────────────────────
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║     ATTENDANCE MASTER DATA — TEARDOWN    ║');
      console.log('╚══════════════════════════════════════════╝');

      if (!SKIP_ARCHIVE) {
        for (const attId of [...attendanceIds].reverse()) {
          // hr.attendance may not have active field — try archive, fall back to unlink
          await rpc.archive('hr.attendance', [attId])
            .then(() => console.log(`  ✔ Archived hr.attendance id=${attId}`))
            .catch(async () => {
              await rpc.unlink('hr.attendance', [attId])
                .then(() => console.log(`  ✔ Unlinked hr.attendance id=${attId}`))
                .catch((err: Error) => console.warn(`  ✘ Could not remove hr.attendance#${attId}: ${err.message}`));
            });
        }
        await rpc.archive('hr.employee', [employeeId])
          .then(() => console.log(`  ✔ Archived hr.employee id=${employeeId}`))
          .catch((err: Error) => console.warn(`  ✘ Could not archive hr.employee#${employeeId}: ${err.message}`));
      } else {
        console.log(`  ℹ SKIP_ARCHIVE=true — records remain active. Tag: "${RUN_TAG}"\n`);
      }

      await reqCtx.dispose();
    },
    { scope: 'worker' },
  ],

  leaveMasterData: [
    async ({}, use) => {
      const reqCtx = await request.newContext();
      const rpc = createOdooRPC(reqCtx);

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║       LEAVE MASTER DATA — SETUP          ║');
      console.log(`║  Run Tag: ${RUN_TAG.padEnd(30)}║`);
      console.log('╚══════════════════════════════════════════╝');

      await rpc.authenticate(
        process.env.ADMIN_EMAIL ?? 'admin',
        process.env.ADMIN_PASSWORD ?? 'admin',
      );
      console.log('  ✔ Authenticated as admin');

      const employeeName = uniqueName('Leave Employee');
      const employeeId = await rpc.create<{ name: string; work_email: string }>('hr.employee', {
        name: employeeName,
        work_email: `leave.${RUN_TAG.toLowerCase()}@example.com`,
      });
      console.log(`  ✔ Employee created     → id=${employeeId}  "${employeeName}"`);

      // Find any active leave type for use in tests
      let leaveTypeId: OdooId = 0;
      let leaveTypeName = '';
      let leaveValidationType = '';
      let createdLeaveType = false;
      let allocationId: OdooId = 0;
      let allocatedDays = 0;

      const types = await rpc.searchRead<{ id: OdooId; name: string; leave_validation_type: string }>(
        'hr.leave.type',
        [['active', '=', true]],
        ['name', 'leave_validation_type'],
        { limit: 1 },
      );

      if (types.length > 0) {
        leaveTypeId = types[0].id;
        leaveTypeName = types[0].name;
        leaveValidationType = types[0].leave_validation_type;
      } else {
        // Create a minimal leave type
        const ltName = uniqueName('Test Leave Type');
        leaveTypeId = await rpc.create<{ name: string; leave_validation_type: string }>(
          'hr.leave.type',
          { name: ltName, leave_validation_type: 'time_off' },
        );
        leaveTypeName = ltName;
        leaveValidationType = 'time_off';
        createdLeaveType = true;
      }
      console.log(`  ✔ Leave type resolved  → id=${leaveTypeId}  "${leaveTypeName}"  (${leaveValidationType})`);
      console.log('  ─────────────────────────────────────────');

      await use({
        runTag: RUN_TAG,
        employeeId,
        employeeName,
        leaveTypeId,
        leaveTypeName,
        leaveValidationType,
        allocationId,
        allocatedDays,
      });

      // ── Teardown ──────────────────────────────────────────────────────────────
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║       LEAVE MASTER DATA — TEARDOWN       ║');
      console.log('╚══════════════════════════════════════════╝');

      if (!SKIP_ARCHIVE) {
        if (allocationId > 0) {
          await rpc.callMethod('hr.leave.allocation', 'action_refuse', [[allocationId]])
            .catch(() => {});
          await rpc.archive('hr.leave.allocation', [allocationId])
            .then(() => console.log(`  ✔ Archived hr.leave.allocation id=${allocationId}`))
            .catch((err: Error) => console.warn(`  ✘ ${err.message}`));
        }
        await rpc.archive('hr.employee', [employeeId])
          .then(() => console.log(`  ✔ Archived hr.employee id=${employeeId}`))
          .catch((err: Error) => console.warn(`  ✘ Could not archive hr.employee#${employeeId}: ${err.message}`));
        if (createdLeaveType) {
          await rpc.archive('hr.leave.type', [leaveTypeId])
            .then(() => console.log(`  ✔ Archived hr.leave.type id=${leaveTypeId}`))
            .catch((err: Error) => console.warn(`  ✘ ${err.message}`));
        }
      } else {
        console.log(`  ℹ SKIP_ARCHIVE=true — records remain active. Tag: "${RUN_TAG}"\n`);
      }

      await reqCtx.dispose();
    },
    { scope: 'worker' },
  ],
  payrollMasterData: [
    async ({}, use) => {
      const reqCtx = await request.newContext();
      const rpc = createOdooRPC(reqCtx);

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║     PAYROLL MASTER DATA — SETUP          ║');
      console.log(`║  Run Tag: ${RUN_TAG.padEnd(30)}║`);
      console.log('╚══════════════════════════════════════════╝');

      await rpc.authenticate(
        process.env.ADMIN_EMAIL ?? 'admin',
        process.env.ADMIN_PASSWORD ?? 'admin',
      );
      console.log('  ✔ Authenticated as admin');

      // Check if hr.payslip model exists (payroll module installed?)
      const modelCheck = await rpc.searchRead<{ id: OdooId }>(
        'ir.model',
        [['model', '=', 'hr.payslip']],
        ['id'],
        { limit: 1 },
      );
      const payrollInstalled = modelCheck.length > 0;

      const employeeName = uniqueName('Payroll Employee');
      const employeeId = await rpc.create<{ name: string; work_email: string }>('hr.employee', {
        name: employeeName,
        work_email: `payroll.${RUN_TAG.toLowerCase()}@example.com`,
      });
      console.log(`  ✔ Employee created     → id=${employeeId}  "${employeeName}"`);

      const wage = 5000;
      const contractName = uniqueName('Payroll Contract');
      const contractId = await rpc.create<{
        name: string;
        employee_id: OdooId;
        wage: number;
        date_start: string;
        state: string;
      }>('hr.contract', {
        name: contractName,
        employee_id: employeeId,
        wage,
        date_start: addDays(today(), -90),  // 3 months back — covers any previous-month payslip period
        state: 'open',
      });
      console.log(`  ✔ Contract created     → id=${contractId}  "${contractName}"  wage=${wage}`);

      let structureId: OdooId = 0;
      let structureName = '';

      if (payrollInstalled) {
        const structs = await rpc.searchRead<{ id: OdooId; name: string }>(
          'hr.payroll.structure',
          [['active', '=', true]],
          ['name'],
          { limit: 1 },
        );
        if (structs.length > 0) {
          structureId = structs[0].id;
          structureName = structs[0].name;
          console.log(`  ✔ Salary structure     → id=${structureId}  "${structureName}"`);
        } else {
          console.log('  ⚠ No active salary structure found — payslip tests will skip');
        }
      } else {
        console.log('  ℹ hr.payslip model not found — payroll module not installed');
      }
      console.log('  ─────────────────────────────────────────');

      await use({
        runTag: RUN_TAG,
        employeeId,
        employeeName,
        contractId,
        contractName,
        wage,
        structureId,
        structureName,
      });

      // ── Teardown ──────────────────────────────────────────────────────────────
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║     PAYROLL MASTER DATA — TEARDOWN       ║');
      console.log('╚══════════════════════════════════════════╝');

      if (!SKIP_ARCHIVE) {
        if (payrollInstalled) {
          const orphanSlips = await rpc.searchRead<{ id: OdooId; state: string }>(
            'hr.payslip',
            [['employee_id', '=', employeeId]],
            ['id', 'state'],
          );
          for (const slip of orphanSlips) {
            if (slip.state !== 'cancel') {
              await rpc.callMethod('hr.payslip', 'action_payslip_cancel', [[slip.id]]).catch(() => {});
            }
            await rpc.unlink('hr.payslip', [slip.id])
              .then(() => console.log(`  ✔ Unlinked hr.payslip id=${slip.id}`))
              .catch(async () => {
                await rpc.archive('hr.payslip', [slip.id]).catch(() => {});
              });
          }
        }
        await rpc.write('hr.contract', [contractId], { state: 'cancel' }).catch(() => {});
        await rpc.archive('hr.contract', [contractId])
          .then(() => console.log(`  ✔ Archived hr.contract id=${contractId}`))
          .catch((err: Error) => console.warn(`  ✘ ${err.message}`));
        await rpc.archive('hr.employee', [employeeId])
          .then(() => console.log(`  ✔ Archived hr.employee id=${employeeId}`))
          .catch((err: Error) => console.warn(`  ✘ ${err.message}`));
      } else {
        console.log(`  ℹ SKIP_ARCHIVE=true — records remain active. Tag: "${RUN_TAG}"\n`);
      }

      await reqCtx.dispose();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
