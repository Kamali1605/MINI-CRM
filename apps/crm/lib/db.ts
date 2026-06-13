/**
 * Database layer using Supabase JS client.
 * Works on Vercel serverless without connection issues.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !key) {
      throw new Error(`Supabase config missing. URL: ${!!url}, KEY: ${!!key}`);
    }

    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
    });
  }
  return _client;
}

/**
 * Execute a raw SQL query via Supabase's REST API.
 * Uses pg_query RPC for arbitrary SQL, falling back to pg for local dev.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  // Replace $1, $2... with actual values for Supabase RPC
  let sql = text;
  if (params && params.length > 0) {
    params.forEach((p, i) => {
      const placeholder = `\\$${i + 1}`;
      const value = typeof p === 'string'
        ? `'${p.replace(/'/g, "''")}'`
        : p === null ? 'NULL'
        : String(p);
      sql = sql.replace(new RegExp(placeholder, 'g'), value);
    });
  }

  const client = getClient();
  const { data, error } = await client.rpc('exec_raw_sql', { sql });

  if (error) {
    console.error('[db] RPC error, trying pg fallback:', error.message);
    return queryPg<T>(text, params);
  }

  return (data as T[]) ?? [];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// ── pg fallback for local dev ────────────────────────────────────────────────
import { Pool } from 'pg';
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    const cs = process.env.DATABASE_URL;
    if (!cs) throw new Error('DATABASE_URL not set');
    _pool = new Pool({
      connectionString: cs,
      ssl: { rejectUnauthorized: false },
      max: 3,
      connectionTimeoutMillis: 10000,
    });
    _pool.on('error', () => { _pool = null; });
  }
  return _pool;
}

async function queryPg<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const db = getPool();
  const result = await db.query(text, params);
  return result.rows as T[];
}
