import { test as setup, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const baseURL = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';

interface UserCreds {
  email: string;
  password: string;
  storageFile: string;
}

const users: UserCreds[] = [
  {
    email: process.env.ADMIN_EMAIL ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin',
    storageFile: 'auth-storage/admin.json',
  },
  {
    email: process.env.MANAGER_EMAIL ?? '',
    password: process.env.MANAGER_PASSWORD ?? '',
    storageFile: 'auth-storage/manager.json',
  },
  {
    email: process.env.EMPLOYEE_EMAIL ?? '',
    password: process.env.EMPLOYEE_PASSWORD ?? '',
    storageFile: 'auth-storage/employee.json',
  },
];

// Ensure auth-storage directory exists
const authDir = path.resolve('auth-storage');
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

for (const user of users) {
  if (!user.email || !user.password) continue;

  setup(`authenticate: ${user.storageFile}`, async ({ page }) => {
    // Go directly to the Odoo backend login page.
    // The website "Sign in" link also redirects here, so this is equivalent
    // but faster and avoids the website module entirely.
    await page.goto(`${baseURL}/web/login`);

    // The standard Odoo login form labels its inputs "Email" and "Password"
    // (accessible name from the <label> element), confirmed via codegen.
    await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
    await page.getByRole('textbox', { name: 'Password' }).fill(user.password);
    await page.getByRole('button', { name: 'Log in' }).click();

    // After login Odoo redirects to /odoo or /web — wait for backend navbar.
    // Use a 60s timeout: SaaS instances can be slow to warm up after inactivity.
    await page.waitForSelector('.o_main_navbar, .o_home_menu, .o_action_manager', {
      state: 'visible',
      timeout: 60_000,
    });

    await page.context().storageState({ path: user.storageFile });
  });
}
