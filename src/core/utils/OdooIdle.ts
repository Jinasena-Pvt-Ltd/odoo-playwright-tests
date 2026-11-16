import type { Locator, Page } from '@playwright/test';

/**
 * Wait until the Odoo web client has finished loading.
 *
 * Odoo shows "Loading" in the bottom-right corner (.o_loading_indicator) while an RPC runs,
 * and blocks the screen (.o_blockUI) after 3 s. The corner box only appears once an RPC has
 * run for 250 ms, so short RPCs, which still re-render the view afterwards, never show it.
 * This therefore counts RPCs through the same bus events the indicator listens to
 * (RPC:REQUEST / RPC:RESPONSE on the web client env) and also treats a visible indicator or
 * block as busy. Idle = nothing in flight and nothing started or finished for `quiet` ms
 * (the time the view needs to render the response, or to start a follow-up RPC).
 * On pages without the web client (login, portal) only the indicator and block are checked.
 */
export async function waitForOdooIdle(
  page: Page,
  { timeout = 30_000, quiet = 250 }: { timeout?: number; quiet?: number } = {},
): Promise<void> {
  await page.waitForFunction(
    (quietMs) => {
      const w = window as any;
      if (!w.__pwOdooRpc) {
        const bus = w.odoo?.__WOWL_DEBUG__?.root?.env?.bus;
        if (bus) {
          const state = (w.__pwOdooRpc = { ids: new Set(), last: Date.now() });
          bus.addEventListener('RPC:REQUEST', (ev: any) => {
            if (ev.detail?.settings?.silent) return;
            state.ids.add(ev.detail?.data?.id);
            state.last = Date.now();
          });
          bus.addEventListener('RPC:RESPONSE', (ev: any) => {
            if (ev.detail?.settings?.silent) return;
            state.ids.delete(ev.detail?.data?.id);
            state.last = Date.now();
          });
        }
      }
      const rpc = w.__pwOdooRpc;
      if (rpc && (rpc.ids.size > 0 || Date.now() - rpc.last < quietMs)) return false;
      return !document.querySelector('.o_loading_indicator, .o_blockUI');
    },
    quiet,
    { timeout, polling: 50 },
  );
}

/**
 * locator.isVisible() once Odoo has finished loading. Use it instead of
 * locator.isVisible({ timeout }), which ignores the timeout and answers at once, so a button
 * or dialog that appears after the pending RPC returns is reported as missing. If Odoo is
 * still busy after `timeout` ms, the current state is returned.
 */
export async function isVisibleWhenIdle(locator: Locator, { timeout = 30_000 }: { timeout?: number } = {}): Promise<boolean> {
  await waitForOdooIdle(locator.page(), { timeout }).catch(() => undefined);
  return locator.isVisible();
}
