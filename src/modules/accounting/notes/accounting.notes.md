# Accounting — Notes

Free-form domain notes for the accounting module: Odoo quirks, SaaS-specific
constraints, decisions, and anything future contributors on this branch
should know that doesn't belong in test code or CLAUDE.md.

## Custom finance reports audit

Two read-only discovery specs answer "which finance reports are customised, and are they hidden?":

- `tests/03-reporting/accounting.custom-reports-audit.spec.ts` (RPC only) scans menus, PDF/QWeb report actions and
  customised templates, `account.report`, actions and manual models, the Studio layer, non-Odoo modules, other
  mechanisms (saved filters, exports, spreadsheet dashboards, BI views, crons) and per-user hidden menus.
  Logic and the meaning of dimensions A-H: `data/custom-reports.scanner.ts`.
- `tests/03-reporting/accounting.custom-reports-menu-crawl.spec.ts` opens every app that owns a finance menu and
  compares what is on screen with the database.

Run both: `npm run audit:custom-reports` (needs `ODOO_BASE_URL` = bare origin, and `ODOO_DB`). Output goes to
`reports/custom-finance-reports-audit-<date>.{md,json}` and `reports/custom-finance-menu-crawl-<date>.{md,json}`.
Origin of a record comes from its external id: base / custom-module / studio / ui-created.
