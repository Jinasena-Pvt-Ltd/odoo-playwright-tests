/**
 * Step 3 — Reporting: which finance menus does the admin user ACTUALLY see on screen?
 *
 * Scope: the ACCOUNTING app only. The test opens the app from the home menu, opens every top-level dropdown (and the "+" overflow),
 * and records each visible entry. It then compares that with the finance menus the database holds
 * (ir.ui.menu, including inactive and group-restricted ones):
 *
 *   visible        the menu is on screen
 *   hidden         the menu exists but is NOT on screen  (reason: inactive / restricted by groups / ...)
 *   app-not-shown  the whole app tile is missing from the home menu for this user
 *   folder         a section header: counts as visible when any of its children is visible
 *
 * Output: reports/custom-finance-menu-crawl-<date>.json and .md (also attached to the test).
 * Run:    npx playwright test accounting.custom-reports-menu-crawl --project=admin --no-deps
 */
import { test, expect } from '../../../../core/fixtures/index';
import type { Page } from '@playwright/test';
import { CustomReportScanner } from '../../data/custom-reports.scanner';
import * as fs from 'fs';
import * as path from 'path';

type Seen = { xmlids: Set<string>; labels: Set<string>; tops: string[] };

test.describe('Finance menu crawl @module:accounting @step:reporting @audit', () => {
  test.use({ viewport: { width: 1800, height: 900 } });

  test('compare the menus on screen with the finance menus in the database', async ({ page, rpc }, testInfo) => {
    test.setTimeout(480_000);
    const index = await new CustomReportScanner(rpc, process.env.ODOO_BASE_URL ?? '').financeMenuIndex();
    const roots = [...new Set(index.map((m) => m.path.split('/')[0]))];

    // Log in once (the rpc fixture's API login can end the saved browser session).
    await page.goto('/web');
    const emailBox = page.getByRole('textbox', { name: 'Email' });
    if (await emailBox.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)) {
      await emailBox.fill(process.env.ADMIN_EMAIL ?? 'admin');
      await page.getByRole('textbox', { name: 'Password' }).fill(process.env.ADMIN_PASSWORD ?? 'admin');
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.waitForSelector('.o_main_navbar, .o_home_menu', { state: 'visible', timeout: 45_000 });
    }

    const crawl = async (p: Page): Promise<Seen> => {
      const seen: Seen = { xmlids: new Set(), labels: new Set(), tops: [] };
      const record = async () => {
        const items = await p.locator('.dropdown-menu:visible [data-menu-xmlid], .dropdown-menu:visible .dropdown-item').evaluateAll((els) =>
          els.map((e) => ({ xmlid: e.getAttribute('data-menu-xmlid') ?? '', label: (e.textContent ?? '').replace(/\s+/g, ' ').trim() })));
        for (const i of items) { if (i.xmlid) seen.xmlids.add(i.xmlid); if (i.label) seen.labels.add(i.label.toLowerCase()); }
      };
      // Read every top-level entry up front (the bar re-renders after clicks), then open only the dropdown ones.
      // A leaf top-level entry (a plain link) is recorded by its label and never clicked, so the page is not left.
      const topSel = '.o_menu_sections > .dropdown > .dropdown-toggle, .o_menu_sections > .o-dropdown > button, .o_menu_sections > a, .o_menu_sections > .o-dropdown > a';
      const tops = await p.locator(topSel).evaluateAll((els) => els.map((e) => ({
        label: (e.textContent ?? '').replace(/\s+/g, ' ').trim(), xmlid: e.getAttribute('data-menu-xmlid') ?? '',
        toggle: e.classList.contains('dropdown-toggle') || e.tagName === 'BUTTON',
      })));
      for (const t of tops) {
        if (!t.label) continue;
        seen.tops.push(t.label);
        seen.labels.add(t.label.toLowerCase());
        if (t.xmlid) seen.xmlids.add(t.xmlid);
        if (!t.toggle) continue;
        const btn = p.locator(topSel).filter({ hasText: t.label }).first();
        await btn.click({ timeout: 5_000 }).catch(() => {});
        await record();
        await p.keyboard.press('Escape');
      }
      // The "+" overflow keeps the entries that do not fit; open it too.
      const more = p.locator('.o_menu_sections_more button, .o_menu_sections .o_menu_sections_more').first();
      if (await more.isVisible().catch(() => false)) { await more.click().catch(() => {}); await record(); await p.keyboard.press('Escape'); }
      return seen;
    };

    const perApp = new Map<string, Seen | 'app-not-shown'>();
    for (const root of roots) {
      await page.goto('/web');
      const tile = page.getByRole('option', { name: root, exact: true }).first();
      // NB: isVisible() does not wait, so use waitFor() to give the home menu time to render.
      if (!(await tile.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true).catch(() => false))) { perApp.set(root, 'app-not-shown'); continue; }
      await tile.click();
      if (!(await page.locator('.o_menu_sections').waitFor({ state: 'visible', timeout: 25_000 }).then(() => true).catch(() => false))) { perApp.set(root, 'app-not-shown'); continue; }
      perApp.set(root, await crawl(page));
      if (root === 'Accounting') await testInfo.attach('accounting-menu.png', { body: await page.screenshot(), contentType: 'image/png' });
    }

    type Row = (typeof index)[number] & { app: string; status: 'visible' | 'hidden' | 'app-not-shown' | 'folder-visible' | 'folder-empty'; why: string };
    const rows: Row[] = index.map((m) => {
      const app = m.path.split('/')[0];
      const seen = perApp.get(app);
      if (seen === 'app-not-shown' || !seen) return { ...m, app, status: 'app-not-shown', why: 'the app tile is not on the home menu for this user' };
      const hit = (m.xmlid && seen.xmlids.has(m.xmlid)) || seen.labels.has(m.name.toLowerCase());
      const why = !m.active ? 'menu is inactive' : m.hiddenByGroups ? 'restricted to groups the admin is not in' : '';
      return { ...m, app, status: hit ? 'visible' : 'hidden', why };
    });
    // A folder (no action) is a section header: visible when any child under it is visible.
    for (const r of rows.filter((x) => !x.hasAction && x.status === 'hidden')) {
      const kids = rows.filter((x) => x !== r && x.path.startsWith(r.path + '/'));
      r.status = kids.some((k) => k.status === 'visible') ? 'folder-visible' : 'folder-empty';
      r.why = r.status === 'folder-empty' ? 'section without an action and no visible child' : 'section header (children are visible)';
    }

    const custom = rows.filter((r) => r.origin !== 'base');
    const customVisible = custom.filter((r) => r.status === 'visible' || r.status === 'folder-visible');
    const customHidden = custom.filter((r) => ['hidden', 'app-not-shown', 'folder-empty'].includes(r.status));
    const table = (list: Row[]) => ['| Menu | Origin | Status | Why |', '|---|---|---|---|', ...list.map((r) => `| ${r.path} | ${r.origin} | ${r.status} | ${r.why} |`)];
    const md = [
      '# Finance menu crawl', '',
      `- Apps crawled: ${roots.map((r) => `${r}${perApp.get(r) === 'app-not-shown' ? ' (NOT on the home menu)' : ''}`).join(', ')}`,
      `- Top-level menus of the Accounting app: ${(perApp.get('Accounting') as Seen | undefined)?.tops?.join(' | ') ?? 'n/a'}`,
      `- Finance-related menus found in the database: ${rows.length} (custom: ${custom.length})`,
      `- **Custom and VISIBLE: ${customVisible.length}**`, `- **Custom but NOT visible: ${customHidden.length}**`, '',
      '## Custom finance menus that are NOT visible', '', ...(customHidden.length ? table(customHidden) : ['None.']), '',
      '## Custom finance menus that are visible', '', ...table(customVisible), '',
      '## Standard finance menus that are not visible', '', ...table(rows.filter((r) => r.origin === 'base' && ['hidden', 'app-not-shown', 'folder-empty'].includes(r.status))),
    ].join('\n');

    const stamp = new Date().toISOString().slice(0, 10);
    fs.mkdirSync(path.resolve('reports'), { recursive: true });
    fs.writeFileSync(path.resolve('reports', `custom-finance-menu-crawl-${stamp}.md`), md);
    fs.writeFileSync(path.resolve('reports', `custom-finance-menu-crawl-${stamp}.json`), JSON.stringify({ roots, rows }, null, 2));
    await testInfo.attach('custom-finance-menu-crawl.md', { body: md, contentType: 'text/markdown' });

    console.log(`\n=== FINANCE MENU CRAWL ===\napps crawled: ${roots.join(', ')}`);
    console.log(`custom & visible: ${customVisible.length}, custom & NOT visible: ${customHidden.length}`);
    for (const r of customHidden.slice(0, 50)) console.log(`  NOT VISIBLE  ${r.path}  [${r.origin}]  ${r.status}: ${r.why}`);
    for (const r of customVisible.slice(0, 50)) console.log(`  VISIBLE      ${r.path}  [${r.origin}]`);

    expect((perApp.get('Accounting') as Seen | undefined)?.tops?.length ?? 0, 'the Accounting menu bar was read').toBeGreaterThan(3);
  });
});
