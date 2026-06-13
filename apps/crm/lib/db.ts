/**
 * Database layer — Supabase JS client via exec_raw_sql RPC.
 * Works on Vercel serverless without connection pool issues.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    if (!url || !key) throw new Error('Supabase config missing');
    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

/** Substitute $1..$N placeholders with literal values */
function interpolate(text: string, params?: unknown[]): string {
  let sql = text.trim();
  if (!params || params.length === 0) return sql;

  // Replace from highest index to lowest to avoid $1 matching $10
  for (let i = params.length; i >= 1; i--) {
    const p = params[i - 1];
    let val: string;
    if (p === null || p === undefined) {
      val = 'NULL';
    } else if (typeof p === 'string') {
      val = `'${p.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
    } else if (Array.isArray(p)) {
      const items = p.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
      val = `ARRAY[${items}]::text[]`;
    } else if (typeof p === 'boolean') {
      val = p ? 'true' : 'false';
    } else {
      val = String(p);
    }
    sql = sql.split(`$${i}`).join(val);
  }
  return sql;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const sql = interpolate(text, params);
  const client = getSupabase();
  const { data, error } = await client.rpc('exec_raw_sql', { sql });

  if (error) {
    console.error('[db] RPC error:', error.message, '\nSQL:', sql.slice(0, 200));
    throw new Error(error.message);
  }

  if (!data) return [];

  // DML returns { affected: N } — treat as empty array (caller uses queryOne for RETURNING)
  if (typeof data === 'object' && !Array.isArray(data) && 'affected' in (data as object)) {
    return [];
  }

  const rows = typeof data === 'string' ? JSON.parse(data) : data;
  return (Array.isArray(rows) ? rows : []) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
