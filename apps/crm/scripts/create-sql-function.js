const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  // Drop and recreate to handle both SELECT and DML (INSERT/UPDATE/DELETE)
  await pool.query(`
    CREATE OR REPLACE FUNCTION exec_raw_sql(sql text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      result json;
      row_count int;
    BEGIN
      -- Try as a SELECT first (returns rows)
      BEGIN
        EXECUTE 'SELECT COALESCE(json_agg(t), ''[]''::json) FROM (' || sql || ') t' INTO result;
        RETURN result;
      EXCEPTION WHEN syntax_error OR others THEN
        -- Not a SELECT — execute as DML and return affected rows
        EXECUTE sql;
        GET DIAGNOSTICS row_count = ROW_COUNT;
        RETURN json_build_object('affected', row_count);
      END;
    END;
    $$;
  `);
  console.log('exec_raw_sql function updated to handle SELECT + DML!');
  await pool.end();
}

run().catch(console.error);
