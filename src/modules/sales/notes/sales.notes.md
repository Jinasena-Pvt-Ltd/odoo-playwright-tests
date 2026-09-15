# Sales — Notes

Free-form domain notes for the sales module: Odoo quirks, SaaS-specific
constraints, decisions, and anything future contributors on this branch
should know that doesn't belong in test code or CLAUDE.md.

- Quotation order lines are added via the "Add a product" inline-list link;
  when no specific product name is required, the first item in the
  product_id dropdown is selected (works with a single-product catalog).
