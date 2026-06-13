/**
 * Creates exec_raw_sql function in Supabase for the db.ts RPC approach.
 * Run once: node scripts/create-sql-function.js
 */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await pool.query(`
    CREATE OR REPLACE FUNCTION exec_raw_sql(sql text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result json;
    BEGIN
      EXECUTE 'SELECT json_agg(t) FROM (' || sql || ') t' INTO result;
      RETURN COALESCE(result, '[]'::json);
    END;
    $$;
  `);
  console.log('exec_raw_sql function created!');
  await pool.end();
}

run().catch(console.error);
