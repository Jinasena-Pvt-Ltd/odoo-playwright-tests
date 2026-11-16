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
        // A dev server that has just restarted (the reason the session is gone) can
        // take more than a minute to answer the first login, so try twice.
        for (let attempt = 1; ; attempt++) {
          await page.goto(`${baseURL}/web/login`);
          await page.getByRole('textbox', { name: 'Email' }).fill(creds.email);
          await page.getByRole('textbox', { name: 'Password' }).fill(creds.password);
          await page.getByRole('button', { name: 'Log in' }).click();
          const loggedIn = await page
            .waitForSelector('.o_main_navbar, .o_home_menu, .o_action_manager', { state: 'visible', timeout: 60_000 })
            .then(() => true, () => false);
          if (loggedIn) break;
          if (attempt === 2) throw new Error('Login did not reach the Odoo web client after two attempts');
        }
      }
    }
    await use();

    // Close the pages here, each with a time limit: closing the context waits for every
    // page and has hung for the full test timeout after long flows. A page that does not
    // close within 15 s is named in the output and crashed so the context can close.
    for (const p of context.pages()) {
      const url = p.url();
      const closed = await Promise.race([
        p.close({ runBeforeUnload: false }).then(() => true, () => true),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 15_000)),
      ]);
      if (!closed) {
        console.warn(`[teardown] page did not close within 15 s, crashing it: ${url}`);
        await context.newCDPSession(p).then((cdp) => cdp.send('Page.crash')).catch(() => undefined);
      }
    }
  }, { auto: true }],
});

export { expect } from '@playwright/test';
