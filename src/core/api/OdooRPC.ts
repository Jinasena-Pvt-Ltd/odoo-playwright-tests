import { APIRequestContext, APIResponse } from '@playwright/test';
import type { OdooDomain, OdooId, OdooRPCResponse } from './OdooModels';

export interface OdooRPCOptions {
  baseUrl: string;
  db: string;
}

export interface SearchReadOpts {
  limit?: number;
  offset?: number;
  order?: string;
}

let _requestId = 1;

export class OdooRPC {
  private sessionId: string | null = null;

  constructor(
    private readonly request: APIRequestContext,
    private readonly opts: OdooRPCOptions,
  ) {}

  // ── Authentication ──────────────────────────────────────────────────────────

  async authenticate(login: string, password: string): Promise<void> {
    const response = await this.request.post(`${this.opts.baseUrl}/web/session/authenticate`, {
      data: {
        jsonrpc: '2.0',
        method: 'call',
        id: _requestId++,
        params: {
          db: this.opts.db,
          login,
          password,
        },
      },
    });
    const body = await response.json() as OdooRPCResponse<{ uid: number; session_id: string }>;
    this.assertNoError(body);
    if (!body.result?.uid) {
      throw new Error(`Odoo authentication failed for user "${login}"`);
    }
    // Playwright's APIRequestContext stores cookies automatically; we just track the session_id
    this.sessionId = body.result.session_id;
  }

  // ── ORM helpers ─────────────────────────────────────────────────────────────

  async searchRead<T>(
    model: string,
    domain: OdooDomain,
    fields: string[],
    opts: SearchReadOpts = {},
  ): Promise<T[]> {
    // Uses the standard ORM search_read (not web_search_read) for cross-version compatibility.
    // web_search_read in Odoo 17 SaaS changed its signature to use 'specification' (dict) instead of 'fields' (list).
    return this.callKw<T[]>(model, 'search_read', [], {
      domain,
      fields,
      limit: opts.limit ?? 0,
      offset: opts.offset ?? 0,
      order: opts.order ?? '',
    });
  }

  async create<T extends object>(model: string, values: Partial<T>): Promise<OdooId> {
    return this.callKw<OdooId>(model, 'create', [values], {});
  }

  async write<T extends object>(model: string, ids: OdooId[], values: Partial<T>): Promise<boolean> {
    return this.callKw<boolean>(model, 'write', [ids, values], {});
  }

  async unlink(model: string, ids: OdooId[]): Promise<boolean> {
    return this.callKw<boolean>(model, 'unlink', [ids], {});
  }

  async archive(model: string, ids: OdooId[]): Promise<void> {
    await this.write(model, ids, { active: false } as Record<string, unknown>);
  }

  async callMethod<T = unknown>(
    model: string,
    method: string,
    args: unknown[] = [],
    kwargs: Record<string, unknown> = {},
  ): Promise<T> {
    return this.callKw<T>(model, method, args, kwargs);
  }

  async read<T>(model: string, ids: OdooId[], fields: string[]): Promise<T[]> {
    return this.callKw<T[]>(model, 'read', [ids], { fields });
  }

  // ── Settings helpers ─────────────────────────────────────────────────────────

  async getConfigParam(key: string): Promise<string | false> {
    const records = await this.searchRead<{ value: string }>(
      'ir.config_parameter',
      [['key', '=', key]],
      ['value'],
    );
    return records.length ? records[0].value : false;
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  private async callKw<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown>,
  ): Promise<T> {
    const response: APIResponse = await this.request.post(
      `${this.opts.baseUrl}/web/dataset/call_kw`,
      {
        data: {
          jsonrpc: '2.0',
          method: 'call',
          id: _requestId++,
          params: {
            model,
            method,
            args,
            kwargs,
          },
        },
      },
    );

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()} calling ${model}.${method}`);
    }

    const body = await response.json() as OdooRPCResponse<T>;
    this.assertNoError(body);
    return body.result as T;
  }

  private assertNoError(body: OdooRPCResponse): void {
    if (body.error) {
      const msg = body.error.data?.message ?? body.error.message;
      throw new Error(`Odoo RPC error: ${msg}`);
    }
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createOdooRPC(request: APIRequestContext): OdooRPC {
  const baseUrl = process.env.ODOO_BASE_URL ?? 'http://localhost:8069';
  const db = process.env.ODOO_DB ?? 'odoo17';
  return new OdooRPC(request, { baseUrl, db });
}
