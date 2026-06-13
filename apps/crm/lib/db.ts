/**
 * Database layer.
 * Uses Supabase JS client on Vercel (handles connection pooling + SSL).
 * Falls back to pg for local development.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!url || !key) throw new Error(`Supabase config missing`);

    _supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  // Substitute $1..$N with actual values for Supabase RPC
  let sql = text.trim();
  if (params && params.length > 0) {
    params.forEach((p, i) => {
      const ph = `$${i + 1}`;
      let val: string;
      if (p === null || p === undefined) {
        val = 'NULL';
      } else if (typeof p === 'string') {
        val = `'${p.replace(/'/g, "''")}'`;
      } else if (Array.isArray(p)) {
        val = `ARRAY[${p.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
      } else {
        val = String(p);
      }
      // Replace all occurrences of this placeholder
      sql = sql.split(ph).join(val);
    });
  }

  const client = getSupabase();
  const { data, error } = await client.rpc('exec_raw_sql', { sql });

  if (error) {
    console.error('[db] Supabase RPC error:', error.message, '| SQL:', sql.slice(0, 100));
    throw new Error(error.message);
  }

  if (!data) return [];

  // exec_raw_sql returns a JSON array
  const rows = typeof data === 'string' ? JSON.parse(data) : data;
  return (Array.isArray(rows) ? rows : [rows]) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
