import { test as base, request } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.ODOO_BASE_URL!;
const DB = process.env.ODOO_DB!;
const EMAIL = process.env.ADMIN_EMAIL!;
const PASS = process.env.ADMIN_PASSWORD!;

base('add active field to sale.order', async () => {
  const ctx = await request.newContext();
  let id = 1;
  const call = async (model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    const res = await ctx.post(`${BASE}/web/dataset/call_kw`, {
      data: { jsonrpc: '2.0', method: 'call', id: id++, params: { model, method, args, kwargs } },
    });
    const body = await res.json();
    if (body.error) throw new Error(JSON.stringify(body.error));
    return body.result;
  };

  await ctx.post(`${BASE}/web/session/authenticate`, {
    data: { jsonrpc: '2.0', method: 'call', id: id++, params: { db: DB, login: EMAIL, password: PASS } },
  });

  // 1. Confirm the field doesn't already exist (idempotency guard).
  const fields = await call('sale.order', 'fields_get', [], { attributes: ['string', 'type'] });
  if (fields.active) {
    console.log('active field already exists — nothing to do:', JSON.stringify(fields.active));
    return;
  }

  // 2. Look up the ir.model record for sale.order.
  const models = await call('ir.model', 'search_read', [], {
    domain: [['model', '=', 'sale.order']],
    fields: ['id', 'model'],
  });
  const modelId = models[0].id;
  console.log('sale.order ir.model id:', modelId);

  // 3. Create the field itself.
  const fieldId = await call('ir.model.fields', 'create', [{
    model_id: modelId,
    name: 'active',
    field_description: 'Active',
    ttype: 'boolean',
    state: 'manual',
  }]);
  console.log('created ir.model.fields id:', fieldId);

  // 4. Backfill every existing order to active=True — a fresh boolean column defaults to
  // False, which would make every existing Sales Order look archived/invisible in the
  // active-scoped list views the moment the field exists.
  const allIds = await call('sale.order', 'search', [[]]);
  console.log('existing sale.order count:', allIds.length);
  if (allIds.length > 0) {
    await call('sale.order', 'write', [allIds, { active: true }]);
    console.log('backfilled active=true on', allIds.length, 'records');
  }

  // 5. Set an ir.default so records created going forward also default to active=True
  // (a manually created boolean field has no Python-level default otherwise).
  await call('ir.default', 'set', ['sale.order', 'active', true, true, true, false, false]).catch(async (e: Error) => {
    console.log('ir.default.set (positional) failed, trying kwargs form:', e.message.slice(0, 200));
    await call('ir.default', 'set', ['sale.order', 'active', true], { user_id: false, company_id: false });
  });

  // 6. Verify.
  const fieldsAfter = await call('sale.order', 'fields_get', [], { attributes: ['string', 'type'] });
  console.log('active field now:', JSON.stringify(fieldsAfter.active));
  const sample = await call('sale.order', 'search_read', [], { domain: [], fields: ['id', 'name', 'active'], limit: 3 });
  console.log('sample records:', JSON.stringify(sample));
});
