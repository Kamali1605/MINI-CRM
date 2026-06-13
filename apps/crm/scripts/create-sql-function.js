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
      upper_sql text;
      wrapped text;
    BEGIN
      upper_sql := upper(trim(sql));
      
      -- Pure SELECT: wrap directly
      IF upper_sql LIKE 'SELECT%' OR upper_sql LIKE 'WITH%' THEN
        EXECUTE 'SELECT COALESCE(json_agg(t), ''[]''::json) FROM (' || sql || ') t' INTO result;
        RETURN result;
      END IF;
      
      -- INSERT/UPDATE/DELETE with RETURNING: use CTE wrapper
      IF (upper_sql LIKE 'INSERT%' OR upper_sql LIKE 'UPDATE%' OR upper_sql LIKE 'DELETE%')
         AND upper_sql LIKE '%RETURNING%' THEN
        wrapped := 'WITH _rows AS (' || sql || ') SELECT COALESCE(json_agg(_rows), ''[]''::json) FROM _rows';
        EXECUTE wrapped INTO result;
        RETURN result;
      END IF;
      
      -- DML without RETURNING: just execute
      EXECUTE sql;
      RETURN '[]'::json;
    END;
    $$;
  `);
  console.log('exec_raw_sql updated!');
  
  // Test it
  const { createClient } = require('@supabase/supabase-js');
  const { v4: uuidv4 } = require('uuid');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } }
  );
  
  const testId = uuidv4();
  
  // Test INSERT RETURNING
  const r1 = await client.rpc('exec_raw_sql', {
    sql: `INSERT INTO chat_sessions (id, messages) VALUES ('${testId}', '[]') RETURNING id, created_at`
  });
  console.log('INSERT RETURNING:', JSON.stringify(r1.data), r1.error?.message || 'OK');
  
  // Test UPDATE RETURNING
  const r2 = await client.rpc('exec_raw_sql', {
    sql: `UPDATE chat_sessions SET title = 'Test' WHERE id = '${testId}' RETURNING id, title`
  });
  console.log('UPDATE RETURNING:', JSON.stringify(r2.data), r2.error?.message || 'OK');
  
  // Test SELECT
  const r3 = await client.rpc('exec_raw_sql', {
    sql: `SELECT COUNT(*) as count FROM customers`
  });
  console.log('SELECT COUNT:', JSON.stringify(r3.data), r3.error?.message || 'OK');
  
  // Cleanup
  await client.rpc('exec_raw_sql', { sql: `DELETE FROM chat_sessions WHERE id = '${testId}'` });
  
  await pool.end();
  console.log('All tests done!');
}

run().catch(console.error);
