import { test as base, request } from '@playwright/test';
import * as dotenv from 'dotenv';
import { OdooRPC, createOdooRPC } from '../api/OdooRPC';

dotenv.config();

export type BaseFixtures = {
  rpc: OdooRPC;
};

export const test = base.extend<BaseFixtures>({
  rpc: async ({}, use) => {
    const requestContext = await request.newContext();
    const rpc = createOdooRPC(requestContext);
    await rpc.authenticate(
      process.env.ADMIN_EMAIL ?? 'admin',
      process.env.ADMIN_PASSWORD ?? 'admin',
    );
    await use(rpc);
    await requestContext.dispose();
  },
});

export { expect } from '@playwright/test';
