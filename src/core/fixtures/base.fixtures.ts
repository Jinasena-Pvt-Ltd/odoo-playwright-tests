import { test as base, request } from '@playwright/test';
import * as dotenv from 'dotenv';
import { OdooRPC, createOdooRPC } from '../api/OdooRPC';

dotenv.config();

export type BaseFixtures = {
  rpc: OdooRPC;
  keepSessionAlive: void;
};

/** Credentials of the role whose saved login (storageState) the current project uses. */
function credsForStorage(storage: unknown): { email: string; password: string } | null {
  const file = typeof storage === 'string' ? storage : '';
  if (file.includes('manager')) return { email: process.env.MANAGER_EMAIL ?? '', password: process.env.MANAGER_PASSWORD ?? '' };
  if (file.includes('employee')) return { email: process.env.EMPLOYEE_EMAIL ?? '', password: process.env.EMPLOYEE_PASSWORD ?? '' };
  return { email: process.env.ADMIN_EMAIL ?? 'admin', password: process.env.ADMIN_PASSWORD ?? 'admin' };
}

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

  // The login saved by auth.setup.ts can expire during a long run (the last tests of a
  // full run start more than an hour after it was saved). Before every test, check the
  // session and log in again through the UI if it has expired.
  keepSessionAlive: [async ({ page, context }, use, testInfo) => {
    const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
    const info = await context.request
      .post(`${baseURL}/web/session/get_session_info`, { data: { jsonrpc: '2.0', method: 'call', params: {} } })
      .then((r) => r.json())
      .catch(() => null);
    const alive = !!info?.result?.uid;
    if (!alive) {
      const creds = credsForStorage(testInfo.project.use.storageState);
      if (creds?.email && creds.password) {
        await context.clearCookies();
        await page.goto(`${baseURL}/web/login`);
        await page.getByRole('textbox', { name: 'Email' }).fill(creds.email);
        await page.getByRole('textbox', { name: 'Password' }).fill(creds.password);
        await page.getByRole('button', { name: 'Log in' }).click();
        await page.waitForSelector('.o_main_navbar, .o_home_menu, .o_action_manager', { state: 'visible', timeout: 60_000 });
      }
    }
    await use();
  }, { auto: true }],
});

export { expect } from '@playwright/test';
