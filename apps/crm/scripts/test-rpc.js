const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false } }
);

async function test() {
  // Test SELECT
  const r1 = await client.rpc('exec_raw_sql', { sql: 'SELECT COUNT(*) as count FROM customers' });
  console.log('SELECT:', JSON.stringify(r1.data), r1.error?.message || 'OK');

  // Test INSERT with RETURNING
  const r2 = await client.rpc('exec_raw_sql', {
    sql: "INSERT INTO chat_sessions (id, messages) VALUES ('test-rpc-123', '[]') ON CONFLICT DO NOTHING RETURNING id"
  });
  console.log('INSERT RETURNING:', JSON.stringify(r2.data), r2.error?.message || 'OK');

  // Test UPDATE
  const r3 = await client.rpc('exec_raw_sql', {
    sql: "UPDATE chat_sessions SET title = 'Test' WHERE id = 'test-rpc-123' RETURNING id, title"
  });
  console.log('UPDATE RETURNING:', JSON.stringify(r3.data), r3.error?.message || 'OK');

  // Cleanup
  await client.rpc('exec_raw_sql', { sql: "DELETE FROM chat_sessions WHERE id = 'test-rpc-123'" });
  console.log('All tests passed!');
}

test().catch(console.error);
