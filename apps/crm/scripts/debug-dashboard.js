const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  try {
    const r1 = await pool.query('SELECT COUNT(*) FROM customers');
    console.log('customers:', r1.rows[0].count);

    const r2 = await pool.query(`
      SELECT
        AVG(CASE WHEN stat_sent > 0 THEN stat_delivered::float / stat_sent ELSE NULL END) * 100 AS avg_delivery,
        AVG(CASE WHEN stat_delivered > 0 THEN stat_opened::float / stat_delivered ELSE NULL END) * 100 AS avg_open
      FROM campaigns WHERE stat_sent > 0
    `);
    console.log('rate stats:', r2.rows[0]);

    const r3 = await pool.query(`SELECT DISTINCT ON (LOWER(name)) name, customer_count FROM segments WHERE customer_count > 0 ORDER BY LOWER(name), customer_count DESC LIMIT 5`);
    console.log('top segments:', r3.rows);

    const r4 = await pool.query(`
      SELECT channel, COUNT(*)::int AS total_sent,
        COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked','converted'))::int AS delivered
      FROM communications GROUP BY channel
    `);
    console.log('channel stats:', r4.rows);

    const r5 = await pool.query(`
      SELECT DATE_TRUNC('day', sent_at)::text AS date, COUNT(*)::int AS sent
      FROM communications WHERE sent_at IS NOT NULL AND sent_at >= now() - INTERVAL '14 days'
      GROUP BY 1 ORDER BY 1
    `);
    console.log('comms by day:', r5.rows);

    console.log('\nAll queries OK!');
  } catch (e) {
    console.error('FAILED:', e.message);
  }
  await pool.end();
}
run();
