/**
 * Custom finance report scanner.
 *
 * Answers one question about an Odoo instance: "besides the standard (base) finance reports, which CUSTOM finance
 * reports exist — and is each one actually visible, or hidden / orphaned / restricted?"
 *
 * It never changes anything. Everything is read through RPC (`searchRead`) and grouped into dimensions, one per
 * mechanism a customisation can hide behind:
 *
 *   A  menus            ir.ui.menu            (inactive, restricted by groups, empty, custom origin)
 *   B  PDF/QWeb reports ir.actions.report     + QWeb views that customise a base report template
 *   C  report engine    account.report        (Enterprise accounting reports, variants, custom handlers)
 *   D  actions & models window / client / server actions, manual (Studio) models and report-style models
 *   E  Studio layer     everything created through Studio (studio_customization), x_studio_* fields
 *   F  module level     installed (and available) modules that are not from Odoo S.A.
 *   G  other mechanisms saved filters, export templates, spreadsheet dashboards, BI views, dashboard customisations, crons
 *   H  per-user hiding   menus hidden for chosen users by a custom module (res.users -> ir.ui.menu fields)
 *
 * ORIGIN of a record is decided from its external id (ir.model.data):
 *   base        -> defined by a module written by Odoo S.A.
 *   custom-module -> defined by an installed module from another author
 *   studio      -> created with Studio (module "studio_customization")
 *   ui-created  -> exported/created by hand (module "__export__") or no external id at all
 */
import type { OdooRPC } from '../../../core/api/OdooRPC';

// ── Configuration ─────────────────────────────────────────────────────────────

/**
 * SCOPE: the ACCOUNTING module only. A record is in scope when it lives in the Accounting menu tree, or works on an
 * accounting model (account.*, budgets), or is an accounting report / module. Reports of other apps (Sales, Purchase,
 * Payroll, Helpdesk, Inventory, Manufacturing, ...) are deliberately left out.
 */
export const FINANCE_MODEL_RE = /^(account\.|crossovered\.budget|x_.*(account|ledger|budget))/i;

/** Words that make a name accounting related (used for modules, dashboards, jobs and similar free-named records). */
export const FINANCE_NAME_RE =
  /account|ledger|balance|aged|statement|budget|analytic|tax|journal|trial|profit|loss|cash ?flow|invoice|payment|receivable|payable|asset|deprecia|reconcil|financ|cheque|check|vat|bank|cost|revenue/i;

/** Modules are in scope when their name or description is accounting related. */
export const ACCOUNTING_MODULE_RE = /account|financ|ledger|budget|cheque|asset|analytic|reconcil|bank|payroll.*account/i;

/** Top-level menu names that root the accounting area. */
export const FINANCE_ROOT_MENUS = ['Accounting', 'Invoicing'];

export type Origin = 'base' | 'custom-module' | 'studio' | 'ui-created';

export interface Finding {
  dimension: string;
  model: string;
  id: number;
  name: string;
  origin: Origin;
  module: string | null;
  flags: string[];
  detail: Record<string, unknown>;
}

export interface ScanResult {
  generatedAt: string;
  instance: string;
  dimensions: Record<string, { title: string; available: boolean; note?: string; findings: Finding[] }>;
  moduleOrigins: { standard: number; custom: string[] };
  summary: Record<string, number>;
}

type Row = Record<string, any>;

// ── RPC helpers ───────────────────────────────────────────────────────────────

/** searchRead that never throws: returns [] and the reason when the model/field is missing or forbidden. */
async function safe(
  rpc: OdooRPC,
  model: string,
  domain: any[],
  fields: string[],
  opts: { limit?: number; order?: string } = {},
): Promise<{ rows: Row[]; error?: string }> {
  try {
    return { rows: await rpc.searchRead<Row>(model, domain as any, fields, { limit: opts.limit ?? 0, order: opts.order ?? '' }) };
  } catch (e) {
    // A field that does not exist on this version would fail the whole call: retry with the minimum.
    if (fields.length > 2) {
      try {
        return { rows: await rpc.searchRead<Row>(model, domain as any, ['id', 'name'], { limit: opts.limit ?? 0 }) };
      } catch { /* fall through */ }
    }
    return { rows: [], error: (e as Error).message.replace(/^Odoo RPC error: /, '').slice(0, 160) };
  }
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export class CustomReportScanner {
  private standardModules = new Set<string>();
  private customModules = new Map<string, Row>();
  private originCache = new Map<string, { origin: Origin; module: string | null; xmlid: string | null }>();
  private adminGroupIds = new Set<number>();
  private groupNames = new Map<number, string>();

  constructor(private readonly rpc: OdooRPC, private readonly instance: string) {}

  // ── origin ──────────────────────────────────────────────────────────────────

  private async loadModules(): Promise<void> {
    const { rows } = await safe(this.rpc, 'ir.module.module', [['state', 'in', ['installed', 'to upgrade', 'to remove']]], ['name', 'author', 'shortdesc', 'summary', 'state', 'latest_version', 'application']);
    for (const m of rows) {
      const isOdoo = /odoo\s*s\.?\s*a\b/i.test(String(m.author ?? ''));
      if (isOdoo) this.standardModules.add(m.name);
      else this.customModules.set(m.name, m);
    }
  }

  private classify(module: string | null): Origin {
    if (module === 'studio_customization') return 'studio';
    if (module === null || module === '__export__') return 'ui-created';
    if (this.customModules.has(module)) return 'custom-module';
    return 'base';
  }

  /** External-id origin for a set of record ids of one model. */
  private async origins(model: string, ids: number[]): Promise<void> {
    const need = ids.filter((id) => !this.originCache.has(`${model}:${id}`));
    for (const part of chunk(need, 400)) {
      const { rows } = await safe(this.rpc, 'ir.model.data', [['model', '=', model], ['res_id', 'in', part]], ['module', 'name', 'res_id']);
      const seen = new Map<number, Row[]>();
      for (const r of rows) seen.set(r.res_id, [...(seen.get(r.res_id) ?? []), r]);
      for (const id of part) {
        const xs = seen.get(id) ?? [];
        // A record can have several external ids: a real module id wins over an __export__ one.
        const best = xs.find((x) => x.module !== '__export__') ?? xs[0];
        const module = best ? best.module : null;
        this.originCache.set(`${model}:${id}`, { origin: this.classify(module), module, xmlid: best ? `${best.module}.${best.name}` : null });
      }
    }
  }

  private originOf(model: string, id: number) {
    return this.originCache.get(`${model}:${id}`) ?? { origin: 'ui-created' as Origin, module: null, xmlid: null };
  }

  private finding(dimension: string, model: string, row: Row, flags: string[], detail: Record<string, unknown> = {}): Finding {
    const o = this.originOf(model, row.id);
    return {
      dimension, model, id: row.id, name: String(row.name ?? row.complete_name ?? row.display_name ?? row.id),
      origin: o.origin, module: o.module, flags: [...new Set(flags)], detail: { xmlid: o.xmlid, ...detail },
    };
  }

  private isCustom(model: string, id: number): boolean {
    return this.originOf(model, id).origin !== 'base';
  }

  // ── groups (who can see a menu / report) ────────────────────────────────────

  private async loadAdminGroups(): Promise<void> {
    const { rows } = await safe(this.rpc, 'res.users', [['id', '=', 2]], ['groups_id']);
    for (const g of rows[0]?.groups_id ?? []) this.adminGroupIds.add(g);
  }

  private async nameGroups(ids: number[]): Promise<void> {
    const need = [...new Set(ids)].filter((i) => !this.groupNames.has(i));
    for (const part of chunk(need, 400)) {
      const { rows } = await safe(this.rpc, 'res.groups', [['id', 'in', part]], ['full_name']);
      for (const r of rows) this.groupNames.set(r.id, r.full_name ?? r.name);
    }
  }

  private groupFlags(groupIds: number[] | undefined): { flags: string[]; names: string[] } {
    if (!groupIds || !groupIds.length) return { flags: [], names: [] };
    const names = groupIds.map((g) => this.groupNames.get(g) ?? String(g));
    const adminSees = groupIds.some((g) => this.adminGroupIds.has(g));
    return { flags: adminSees ? ['restricted-by-groups'] : ['hidden-from-admin-by-groups'], names };
  }

  // ── dimension A: menus ──────────────────────────────────────────────────────

  async scanMenus(): Promise<Finding[]> {
    const { rows: menus } = await safe(this.rpc, 'ir.ui.menu', [['active', 'in', [true, false]]],
      ['name', 'complete_name', 'active', 'parent_id', 'action', 'groups_id', 'sequence']);
    const byId = new Map(menus.map((m) => [m.id, m]));
    const rootOf = (m: Row): string => {
      let cur: Row | undefined = m;
      while (cur?.parent_id) cur = byId.get(cur.parent_id[0]);
      return String(cur?.name ?? '');
    };
    const hasChild = new Set(menus.filter((m) => m.parent_id).map((m) => m.parent_id[0]));

    // Resolve what each menu opens, so menus outside the finance roots but opening a finance model are caught too.
    const actionRefs = menus.filter((m) => m.action).map((m) => String(m.action).split(','));
    const winIds = actionRefs.filter(([t]) => t === 'ir.actions.act_window').map(([, id]) => Number(id));
    const repIds = actionRefs.filter(([t]) => t === 'ir.actions.report').map(([, id]) => Number(id));
    const cliIds = actionRefs.filter(([t]) => t === 'ir.actions.client').map(([, id]) => Number(id));
    const winModel = new Map<number, string>();
    for (const part of chunk(winIds, 400)) {
      const { rows } = await safe(this.rpc, 'ir.actions.act_window', [['id', 'in', part]], ['res_model', 'name']);
      for (const r of rows) winModel.set(r.id, r.res_model);
    }
    const cliTag = new Map<number, string>();
    for (const part of chunk(cliIds, 400)) {
      const { rows } = await safe(this.rpc, 'ir.actions.client', [['id', 'in', part]], ['tag', 'name']);
      for (const r of rows) cliTag.set(r.id, `${r.tag}`);
    }
    void repIds;

    // Scope: only menus that live under the Accounting (or Invoicing) root.
    const finance = menus.filter((m) => FINANCE_ROOT_MENUS.some((r) => rootOf(m).toLowerCase() === r.toLowerCase()));
    void cliTag;

    await this.origins('ir.ui.menu', finance.map((m) => m.id));
    await this.nameGroups(finance.flatMap((m) => m.groups_id ?? []));

    const out: Finding[] = [];
    for (const m of finance) {
      const flags: string[] = [];
      if (!m.active) flags.push('inactive');
      const g = this.groupFlags(m.groups_id);
      flags.push(...g.flags);
      const [t, id] = m.action ? String(m.action).split(',') : ['', ''];
      const model = t === 'ir.actions.act_window' ? winModel.get(Number(id)) ?? '' : '';
      if (!m.action && !hasChild.has(m.id)) flags.push('empty-no-action-no-children');
      if (this.isCustom('ir.ui.menu', m.id)) flags.push('custom-origin');
      // Only report standard menus when something is wrong with them; custom ones always.
      if (this.originOf('ir.ui.menu', m.id).origin === 'base' && !flags.some((f) => f !== 'custom-origin' && f !== 'restricted-by-groups')) continue;
      out.push(this.finding('A', 'ir.ui.menu', m, flags, {
        path: m.complete_name, root: rootOf(m), action: m.action || null, actionModel: model || null, groups: g.names,
      }));
    }
    return out;
  }

  /** Menus for the UI cross-check: every finance menu that should be reachable, with its DB state. */
  async financeMenuIndex(): Promise<Array<{ id: number; name: string; path: string; xmlid: string | null; active: boolean; hiddenByGroups: boolean; origin: Origin; hasAction: boolean }>> {
    await this.loadModules();
    await this.loadAdminGroups();
    const all = await this.scanMenus();
    return all.map((f) => ({
      id: f.id, name: f.name.split('/').pop() ?? f.name, path: String(f.detail.path ?? f.name), xmlid: (f.detail.xmlid as string | null) ?? null,
      active: !f.flags.includes('inactive'), hiddenByGroups: f.flags.includes('hidden-from-admin-by-groups'),
      origin: f.origin, hasAction: !!f.detail.action,
    }));
  }

  // ── dimension B: PDF / QWeb reports ─────────────────────────────────────────

  async scanReportActions(): Promise<Finding[]> {
    const { rows } = await safe(this.rpc, 'ir.actions.report', [], ['name', 'model', 'report_name', 'report_type', 'groups_id', 'binding_model_id', 'paperformat_id']);
    const fin = rows.filter((r) => FINANCE_MODEL_RE.test(String(r.model)));
    await this.origins('ir.actions.report', fin.map((r) => r.id));
    await this.nameGroups(fin.flatMap((r) => r.groups_id ?? []));
    const out: Finding[] = [];
    for (const r of fin) {
      const flags: string[] = [];
      const o = this.originOf('ir.actions.report', r.id);
      if (o.origin !== 'base') flags.push('custom-origin');
      const g = this.groupFlags(r.groups_id);
      flags.push(...g.flags);
      if (!r.binding_model_id) flags.push('not-bound-to-a-print-menu');
      if (o.origin === 'base' && !flags.includes('hidden-from-admin-by-groups')) continue;
      out.push(this.finding('B', 'ir.actions.report', r, flags, { model: r.model, reportName: r.report_name, type: r.report_type, groups: g.names }));
    }

    // QWeb views that customise a base report template (the report "looks" base but is not).
    const { rows: views } = await safe(this.rpc, 'ir.ui.view', [['type', '=', 'qweb'], ['active', 'in', [true, false]]], ['name', 'key', 'inherit_id', 'active', 'mode']);
    const parentKey = new Map(views.map((v) => [v.id, String(v.key ?? '')]));
    const inh = views.filter((v) => v.inherit_id && /^(account|account_reports|account_accountant|account_asset|account_budget|l10n_[a-z_]+)\./.test(parentKey.get(v.inherit_id[0]) ?? '') && /report|invoice|statement|document|ledger/i.test(parentKey.get(v.inherit_id[0]) ?? ''));
    await this.origins('ir.ui.view', inh.map((v) => v.id));
    for (const v of inh) {
      if (this.originOf('ir.ui.view', v.id).origin === 'base') continue;
      out.push(this.finding('B', 'ir.ui.view', v, ['customizes-base-report-template', ...(v.active ? [] : ['inactive'])], { key: v.key, extends: parentKey.get(v.inherit_id[0]) }));
    }
    return out;
  }

  // ── dimension C: account.report engine ──────────────────────────────────────

  async scanAccountReports(): Promise<{ available: boolean; note?: string; findings: Finding[] }> {
    const { rows, error } = await safe(this.rpc, 'account.report', [], ['name', 'root_report_id', 'country_id', 'availability_condition', 'custom_handler_model_name']);
    if (error) return { available: false, note: `account.report not available: ${error}`, findings: [] };
    await this.origins('account.report', rows.map((r) => r.id));
    const lines = await safe(this.rpc, 'account.report.line', [], ['report_id']);
    const lineCount = new Map<number, number>();
    for (const l of lines.rows) lineCount.set(l.report_id?.[0], (lineCount.get(l.report_id?.[0]) ?? 0) + 1);
    const out: Finding[] = [];
    for (const r of rows) {
      const o = this.originOf('account.report', r.id);
      const flags: string[] = [];
      if (o.origin !== 'base') flags.push('custom-origin');
      if (r.root_report_id) flags.push('variant-of-another-report');
      if (r.custom_handler_model_name) flags.push('has-custom-handler');
      if (r.availability_condition && r.availability_condition !== 'always') flags.push(`availability:${r.availability_condition}`);
      if (o.origin === 'base' && !String(r.custom_handler_model_name || '').startsWith('x_')) continue;
      out.push(this.finding('C', 'account.report', r, flags, {
        rootReport: r.root_report_id ? r.root_report_id[1] : null, country: r.country_id ? r.country_id[1] : null,
        handler: r.custom_handler_model_name || null, lines: lineCount.get(r.id) ?? 0,
      }));
    }
    return { available: true, note: `${rows.length} accounting reports in total; only non-base ones are listed`, findings: out };
  }

  // ── dimension D: actions & models ───────────────────────────────────────────

  async scanActionsAndModels(): Promise<Finding[]> {
    const out: Finding[] = [];
    const menuActions = new Set<string>();
    const { rows: menus } = await safe(this.rpc, 'ir.ui.menu', [['active', 'in', [true, false]], ['action', '!=', false]], ['action']);
    for (const m of menus) menuActions.add(String(m.action));

    const { rows: wins } = await safe(this.rpc, 'ir.actions.act_window', [], ['name', 'res_model', 'view_mode', 'groups_id']);
    const finWins = wins.filter((w) => FINANCE_MODEL_RE.test(String(w.res_model)));
    await this.origins('ir.actions.act_window', finWins.map((w) => w.id));
    for (const w of finWins) {
      const o = this.originOf('ir.actions.act_window', w.id);
      const flags: string[] = [];
      if (o.origin !== 'base') flags.push('custom-origin');
      if (!menuActions.has(`ir.actions.act_window,${w.id}`)) flags.push('no-menu-points-here');
      if (o.origin === 'base') continue;
      out.push(this.finding('D', 'ir.actions.act_window', w, flags, { resModel: w.res_model, viewMode: w.view_mode }));
    }

    const { rows: clients } = await safe(this.rpc, 'ir.actions.client', [], ['name', 'tag', 'params']);
    const finClients = clients.filter((c) => /account_report|accounting|financial/i.test(String(c.tag)));
    await this.origins('ir.actions.client', finClients.map((c) => c.id));
    for (const c of finClients) {
      const o = this.originOf('ir.actions.client', c.id);
      if (o.origin === 'base') continue;
      const flags = ['custom-origin'];
      if (!menuActions.has(`ir.actions.client,${c.id}`)) flags.push('no-menu-points-here');
      out.push(this.finding('D', 'ir.actions.client', c, flags, { tag: c.tag }));
    }

    const { rows: servers } = await safe(this.rpc, 'ir.actions.server', [], ['name', 'model_name', 'state', 'binding_model_id']);
    const finServers = servers.filter((s) => FINANCE_MODEL_RE.test(String(s.model_name)));
    await this.origins('ir.actions.server', finServers.map((s) => s.id));
    for (const s of finServers) {
      const o = this.originOf('ir.actions.server', s.id);
      if (o.origin === 'base') continue;
      out.push(this.finding('D', 'ir.actions.server', s, ['custom-origin'], { model: s.model_name, kind: s.state }));
    }

    // Manual (Studio / UI-created) models: a custom report can simply be a custom model + list/pivot view.
    const { rows: models } = await safe(this.rpc, 'ir.model', [['state', '=', 'manual']], ['name', 'model', 'info']);
    for (const m of models.filter((x) => /account|ledger|budget|financ|payment|invoice|tax|journal|asset|analytic|cheque|bank/i.test(`${x.name} ${x.model}`))) out.push({
      dimension: 'D', model: 'ir.model', id: m.id, name: `${m.name} (${m.model})`, origin: 'studio' as Origin, module: null,
      flags: ['manual-model', ...(FINANCE_NAME_RE.test(`${m.name} ${m.model}`) ? ['finance-keyword'] : [])], detail: { technicalName: m.model },
    });

    // Report-style models from non-Odoo modules (SQL views / reporting models: usually _auto = False).
    const { rows: rmodels } = await safe(this.rpc, 'ir.model', [['state', '=', 'base'], '|', '|', ['model', 'ilike', 'report'], ['model', 'ilike', 'analysis'], ['model', 'ilike', 'ledger']], ['name', 'model']);
    await this.origins('ir.model', rmodels.map((m) => m.id));
    for (const m of rmodels) {
      const o = this.originOf('ir.model', m.id);
      if (o.origin === 'base' || !/account|finance|ledger|budget|invoice|payment/i.test(`${m.model} ${m.name}`)) continue;
      out.push(this.finding('D', 'ir.model', m, ['report-style-model', 'custom-origin'], { technicalName: m.model }));
    }
    return out;
  }

  // ── dimension E: the Studio layer ───────────────────────────────────────────

  async scanStudio(): Promise<{ available: boolean; note?: string; findings: Finding[] }> {
    const studioInstalled = this.standardModules.has('web_studio');
    const { rows: data } = await safe(this.rpc, 'ir.model.data', [['module', '=', 'studio_customization']], ['model', 'res_id', 'name']);
    const byModel = new Map<string, number[]>();
    for (const d of data) byModel.set(d.model, [...(byModel.get(d.model) ?? []), d.res_id]);
    const out: Finding[] = [];
    const interesting = ['ir.ui.menu', 'ir.actions.act_window', 'ir.actions.report', 'ir.ui.view', 'ir.model', 'ir.actions.server', 'base.automation', 'ir.actions.client'];
    for (const model of interesting) {
      const ids = byModel.get(model) ?? [];
      for (const part of chunk(ids, 400)) {
        const extra = model === 'ir.ui.menu' || model === 'ir.ui.view' ? [['active', 'in', [true, false]]] : [];
        const { rows } = await safe(this.rpc, model, [['id', 'in', part], ...extra], ['name']);
        for (const r of rows) {
          const text = String(r.name ?? '');
          if (!FINANCE_NAME_RE.test(text)) continue;
          out.push({ dimension: 'E', model, id: r.id, name: text, origin: 'studio', module: 'studio_customization',
            flags: FINANCE_NAME_RE.test(text) ? ['studio', 'finance-keyword'] : ['studio'], detail: {} });
        }
      }
    }
    // x_studio_* fields on finance models.
    const { rows: fields } = await safe(this.rpc, 'ir.model.fields', [['name', '=like', 'x\\_%'], ['model', '=like', 'account%']], ['name', 'model', 'field_description', 'ttype', 'state']);
    const perModel = new Map<string, Row[]>();
    for (const f of fields) perModel.set(f.model, [...(perModel.get(f.model) ?? []), f]);
    for (const [model, fs] of perModel) out.push({
      dimension: 'E', model: 'ir.model.fields', id: 0, name: `${fs.length} custom field(s) on ${model}`, origin: 'studio', module: null,
      flags: ['custom-fields'], detail: { fields: fs.slice(0, 25).map((f) => `${f.name} (${f.ttype}) "${f.field_description}"`) },
    });
    const counts = [...byModel.entries()].map(([m, ids]) => `${m}: ${ids.length}`).join(', ');
    return { available: true, note: `web_studio ${studioInstalled ? 'installed' : 'not installed'}; studio_customization records -> ${counts || 'none'}`, findings: out };
  }

  // ── dimension F: module level ───────────────────────────────────────────────

  async scanModules(): Promise<Finding[]> {
    const out: Finding[] = [];
    for (const m of this.customModules.values()) {
      const { rows: data } = await safe(this.rpc, 'ir.model.data', [['module', '=', m.name], ['model', 'in', ['ir.ui.menu', 'ir.actions.report', 'ir.actions.act_window', 'ir.actions.client', 'account.report', 'ir.model', 'ir.ui.view']]], ['model', 'name']);
      const counts: Record<string, number> = {};
      for (const d of data) counts[d.model] = (counts[d.model] ?? 0) + 1;
      const finance = ACCOUNTING_MODULE_RE.test(`${m.name} ${m.shortdesc}`);
      const touchesAccounting = (counts['account.report'] ?? 0) > 0;
      if (!finance && !touchesAccounting) continue;
      out.push({ dimension: 'F', model: 'ir.module.module', id: m.id, name: `${m.name} — ${m.shortdesc}`, origin: 'custom-module', module: m.name,
        flags: ['custom-module', ...(finance ? ['finance-keyword'] : []), ...((counts['ir.ui.menu'] ?? 0) + (counts['ir.actions.report'] ?? 0) + (counts['account.report'] ?? 0) ? ['adds-menus-or-reports'] : [])],
        detail: { author: m.author, version: m.latest_version, state: m.state, provides: counts } });
    }
    // Custom modules that exist on the server but are NOT installed (a report that is "missing" because its module is off).
    const { rows: avail } = await safe(this.rpc, 'ir.module.module', [['state', 'in', ['uninstalled', 'uninstallable']]], ['name', 'author', 'shortdesc', 'summary', 'state']);
    for (const m of avail) {
      if (/odoo\s*s\.?\s*a\b/i.test(String(m.author ?? ''))) continue;
      if (/^l10n_/.test(m.name)) continue; // Odoo's own localisation packages (country accounting), not custom work
      if (!ACCOUNTING_MODULE_RE.test(`${m.name} ${m.shortdesc}`)) continue;
      out.push({ dimension: 'F', model: 'ir.module.module', id: m.id, name: `${m.name} — ${m.shortdesc} (not installed)`, origin: 'custom-module', module: m.name,
        flags: ['custom-module-not-installed', 'finance-keyword'],
        detail: { author: m.author, state: m.state } });
    }
    return out;
  }

  // ── dimension G: other mechanisms ───────────────────────────────────────────

  async scanOther(): Promise<{ notes: string[]; findings: Finding[] }> {
    const out: Finding[] = [];
    const notes: string[] = [];

    const { rows: filters, error: fe } = await safe(this.rpc, 'ir.filters', [['active', 'in', [true, false]]], ['name', 'model_id', 'user_id', 'is_default', 'domain', 'context', 'active']);
    if (fe) notes.push(`ir.filters: ${fe}`);
    await this.origins('ir.filters', filters.map((x) => x.id));
    for (const f of filters.filter((x) => FINANCE_MODEL_RE.test(String(x.model_id)) && this.originOf('ir.filters', x.id).origin !== 'base')) {
      out.push({ dimension: 'G', model: 'ir.filters', id: f.id, name: `${f.name} [${f.model_id}]`, origin: 'ui-created', module: null,
        flags: ['saved-filter', f.user_id ? 'private-to-user' : 'shared-with-everyone', ...(f.is_default ? ['default'] : []), ...(f.active ? [] : ['inactive'])],
        detail: { user: f.user_id ? f.user_id[1] : null, domain: String(f.domain).slice(0, 160) } });
    }

    const { rows: exps, error: ee } = await safe(this.rpc, 'ir.exports', [], ['name', 'resource']);
    if (ee) notes.push(`ir.exports: ${ee}`);
    for (const e of exps.filter((x) => FINANCE_MODEL_RE.test(String(x.resource)))) {
      out.push({ dimension: 'G', model: 'ir.exports', id: e.id, name: `${e.name} [${e.resource}]`, origin: 'ui-created', module: null, flags: ['export-template'], detail: {} });
    }

    const sd = await safe(this.rpc, 'spreadsheet.dashboard', [], ['name', 'dashboard_group_id']);
    if (sd.error) notes.push(`spreadsheet.dashboard not available (${sd.error})`);
    await this.origins('spreadsheet.dashboard', sd.rows.map((r) => r.id));
    for (const d of sd.rows) {
      const o = this.originOf('spreadsheet.dashboard', d.id);
      if (!FINANCE_NAME_RE.test(String(d.name))) continue;
      out.push(this.finding('G', 'spreadsheet.dashboard', d, [...(o.origin !== 'base' ? ['custom-origin'] : []), 'spreadsheet-dashboard'], { group: d.dashboard_group_id ? d.dashboard_group_id[1] : null }));
    }

    const docs = await safe(this.rpc, 'documents.document', [['handler', '=', 'spreadsheet']], ['name', 'folder_id']);
    if (!docs.error) for (const d of docs.rows.filter((x) => FINANCE_NAME_RE.test(String(x.name)))) {
      out.push({ dimension: 'G', model: 'documents.document', id: d.id, name: d.name, origin: 'ui-created', module: null, flags: ['spreadsheet-document'], detail: { folder: d.folder_id ? d.folder_id[1] : null } });
    }


    // BI View Editor (bi_view_editor): users build SQL-backed reporting models with their own menu and action.
    const bve = await safe(this.rpc, 'bve.view', [], ['name', 'model_name', 'state', 'action_id', 'group_ids']);
    if (bve.error) notes.push(`bve.view not available (${bve.error})`);
    else for (const b of bve.rows.filter((x) => FINANCE_NAME_RE.test(`${x.name} ${x.model_name}`))) {
      out.push({ dimension: 'G', model: 'bve.view', id: b.id, name: `${b.name} (${b.model_name})`, origin: 'ui-created', module: null,
        flags: ['bi-view-editor', ...(b.state === 'created' ? [] : [`state:${b.state}`]), ...(b.action_id ? [] : ['no-action'])],
        detail: { state: b.state, action: b.action_id ? b.action_id[1] : null } });
    }

    const crons = await safe(this.rpc, 'ir.cron', [['active', 'in', [true, false]]], ['name', 'model_id', 'active']);
    await this.origins('ir.cron', crons.rows.map((c) => c.id));
    for (const c of crons.rows) {
      const o = this.originOf('ir.cron', c.id);
      if (o.origin === 'base' || !(FINANCE_NAME_RE.test(String(c.name)) || FINANCE_MODEL_RE.test(String(c.model_id)))) continue;
      out.push(this.finding('G', 'ir.cron', c, ['scheduled-job', 'custom-origin', ...(c.active ? [] : ['inactive'])], { model: c.model_id ? c.model_id[1] : null }));
    }
    return { notes, findings: out };
  }


  // ── dimension H: menus hidden per user by a custom module ────────────────────

  /**
   * Some custom modules (e.g. "hide_menu_user") add a many2many from res.users to ir.ui.menu and hide those menus
   * for the chosen users. Such a menu is active, has no group restriction and exists in the database, yet the user
   * never sees it: the hardest kind of "hidden" to spot. Found generically: any res.users field pointing to menus.
   */
  async scanUserHiddenMenus(): Promise<{ note?: string; findings: Finding[] }> {
    const { rows: fields } = await safe(this.rpc, 'ir.model.fields', [['model', '=', 'res.users'], ['relation', '=', 'ir.ui.menu']], ['name', 'field_description', 'ttype', 'store']);
    if (!fields.length) return { note: 'No res.users field points to menus: no per-user menu hiding module in use', findings: [] };
    const hidden = new Map<number, Array<{ field: string; user: string; userId: number }>>();
    for (const f of fields) {
      const { rows: users } = await safe(this.rpc, 'res.users', [[f.name, '!=', false], ['active', 'in', [true, false]]], ['name', f.name]);
      for (const u of users) for (const mid of (u[f.name] as number[]) ?? []) {
        hidden.set(mid, [...(hidden.get(mid) ?? []), { field: f.name, user: u.name, userId: u.id }]);
      }
    }
    const ids = [...hidden.keys()];
    const out: Finding[] = [];
    await this.origins('ir.ui.menu', ids);
    for (const part of chunk(ids, 400)) {
      const { rows: menus } = await safe(this.rpc, 'ir.ui.menu', [['id', 'in', part], ['active', 'in', [true, false]]], ['name', 'complete_name', 'active', 'action']);
      for (const m of menus) {
        const text = `${m.complete_name}`;
        if (!/^(Accounting|Invoicing)\//i.test(text)) continue;
        const who = hidden.get(m.id) ?? [];
        out.push(this.finding('H', 'ir.ui.menu', m, ['hidden-for-users', ...(who.some((w) => w.userId === 2) ? ['hidden-for-admin'] : []), ...(m.active ? [] : ['inactive'])],
          { path: m.complete_name, hiddenFor: who.map((w) => w.user).slice(0, 12), users: who.length, via: [...new Set(who.map((w) => w.field))] }));
      }
    }
    return { note: `fields used: ${fields.map((f) => f.name).join(', ')}; ${ids.length} distinct menus hidden for at least one user`, findings: out };
  }

  // ── run everything ──────────────────────────────────────────────────────────

  async scan(): Promise<ScanResult> {
    await this.loadModules();
    await this.loadAdminGroups();

    const A = await this.scanMenus();
    const B = await this.scanReportActions();
    const C = await this.scanAccountReports();
    const D = await this.scanActionsAndModels();
    const E = await this.scanStudio();
    const F = await this.scanModules();
    const G = await this.scanOther();
    const H = await this.scanUserHiddenMenus();

    const dims: ScanResult['dimensions'] = {
      A: { title: 'Menus (ir.ui.menu): custom, inactive, restricted or empty', available: true, findings: A },
      B: { title: 'PDF/QWeb report actions and customised report templates', available: true, findings: B },
      C: { title: 'Accounting report engine (account.report)', available: C.available, note: C.note, findings: C.findings },
      D: { title: 'Window / client / server actions, manual models and report-style models', available: true, findings: D },
      E: { title: 'Studio layer', available: E.available, note: E.note, findings: E.findings },
      F: { title: 'Module level (non-Odoo modules, installed or not)', available: true, findings: F },
      G: { title: 'Other mechanisms (saved filters, exports, spreadsheet dashboards, BI views, view customisations, crons)', available: true, note: G.notes.join(' | ') || undefined, findings: G.findings },
      H: { title: 'Finance menus hidden per user by a custom module', available: true, note: H.note, findings: H.findings },
    };
    const summary: Record<string, number> = {};
    for (const [k, d] of Object.entries(dims)) summary[k] = d.findings.length;
    return {
      generatedAt: new Date().toISOString(), instance: this.instance, dimensions: dims,
      moduleOrigins: { standard: this.standardModules.size, custom: [...this.customModules.keys()].sort() }, summary,
    };
  }
}

// ── Markdown rendering ───────────────────────────────────────────────────────

export function headline(r: ScanResult): string[] {
  const all = Object.values(r.dimensions).flatMap((d) => d.findings);
  const count = (f: (x: Finding) => boolean) => all.filter(f).length;
  const names = (f: (x: Finding) => boolean, n = 12) => all.filter(f).slice(0, n).map((x) => x.name).join('; ');
  const customReports = all.filter((x) => x.dimension === 'C');
  const inactive = (x: Finding) => x.dimension === 'A' && x.flags.includes('inactive');
  return [
    '## Headline', '',
    `- **Custom accounting reports in the report engine (account.report): ${customReports.length}** - ${customReports.map((x) => `${x.name} [${x.origin}, ${x.detail.lines} lines]`).join('; ') || 'none'}`,
    `- Custom Accounting menus (any origin other than base): ${count((x) => x.dimension === 'A' && x.flags.includes('custom-origin'))}`,
    `- Menus that exist but are **inactive**: ${count(inactive)}${count(inactive) ? ' - ' + names(inactive) : ''}`,
    `- Menus **hidden from the admin by group restrictions**: ${count((x) => x.dimension === 'A' && x.flags.includes('hidden-from-admin-by-groups'))}`,
    `- Menus **hidden for chosen users by a custom module**: ${count((x) => x.dimension === 'H')}${count((x) => x.dimension === 'H') ? ' - ' + names((x) => x.dimension === 'H') : ''}`,
    `- Custom PDF/QWeb report actions: ${count((x) => x.dimension === 'B' && x.model === 'ir.actions.report')}; customised base report templates: ${count((x) => x.dimension === 'B' && x.model === 'ir.ui.view')}`,
    `- Studio layer: ${r.dimensions.E.note ?? ''}`,
    `- Non-Odoo modules installed: ${r.moduleOrigins.custom.length}; accounting-related ones: ${names((x) => x.dimension === 'F' && x.flags.includes('finance-keyword') && !x.flags.includes('custom-module-not-installed'), 30) || 'none'}`,
    `- Custom modules present but NOT installed: ${count((x) => x.dimension === 'F' && x.flags.includes('custom-module-not-installed'))}`,
    `- BI views / spreadsheet dashboards / saved filters: ${count((x) => x.flags.includes('bi-view-editor'))} / ${count((x) => x.flags.includes('spreadsheet-dashboard'))} / ${count((x) => x.flags.includes('saved-filter'))}`,
    '',
  ];
}

export function toMarkdown(r: ScanResult): string {
  const lines: string[] = [];
  lines.push(`# Custom finance reports audit (Accounting module only)`, ``, `- Instance: ${r.instance}`, `- Generated: ${r.generatedAt}`,
    `- Installed modules: ${r.moduleOrigins.standard} from Odoo S.A., **${r.moduleOrigins.custom.length} from other authors**`,
    `- Non-Odoo modules: ${r.moduleOrigins.custom.join(', ') || 'none'}`, ``,
    ``, ...headline(r), `| Dimension | Findings |`, `|---|---|`);
  for (const [k, d] of Object.entries(r.dimensions)) lines.push(`| ${k} — ${d.title} | ${d.available ? d.findings.length : 'n/a'} |`);
  lines.push('');
  for (const [k, d] of Object.entries(r.dimensions)) {
    lines.push(`## ${k} — ${d.title}`, '');
    if (d.note) lines.push(`_${d.note}_`, '');
    if (!d.findings.length) { lines.push('Nothing found.', ''); continue; }
    lines.push('| Name | Model | Origin | Flags | Detail |', '|---|---|---|---|---|');
    for (const f of d.findings) {
      const detail = Object.entries(f.detail).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length)).map(([a, b]) => `${a}=${typeof b === 'object' ? JSON.stringify(b) : b}`).join('; ');
      lines.push(`| ${f.name.replace(/\|/g, '/')} | ${f.model} | ${f.origin}${f.module ? ` (${f.module})` : ''} | ${f.flags.join(', ')} | ${detail.replace(/\|/g, '/').slice(0, 220)} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
