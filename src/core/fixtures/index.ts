import { mergeTests } from '@playwright/test';
import { test as baseTest } from './base.fixtures';
import { test as masterDataTest } from './masterData.fixtures';

export { expect } from '@playwright/test';

/** Merged test object that includes all fixtures: rpc + hrMasterData */
export const test = mergeTests(baseTest, masterDataTest);

// Re-export fixture types for use in test files
export type { HrMasterData, AttendanceMasterData, LeaveMasterData, PayrollMasterData, MasterDataWorkerFixtures } from './masterData.fixtures';
export type { BaseFixtures } from './base.fixtures';
