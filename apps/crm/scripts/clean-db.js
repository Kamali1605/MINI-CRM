/**
 * Clean up duplicate segments, orphaned communications, and reset stuck campaigns.
 */
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function clean() {
  console.log('Cleaning database...\n');

  // 1. Remove duplicate segments (keep the one with most customers)
  // First, update campaigns that reference duplicates to point to the keeper
  await pool.query(`
    UPDATE campaigns c
    SET segment_id = keeper.id
    FROM (
      SELECT DISTINCT ON (LOWER(name)) id, LOWER(name) AS lname
      FROM segments
      ORDER BY LOWER(name), customer_count DESC, created_at ASC
    ) keeper
    JOIN segments s ON LOWER(s.name) = keeper.lname AND s.id != keeper.id
    WHERE c.segment_id = s.id
  `);

  const dupResult = await pool.query(`
    DELETE FROM segments
    WHERE id NOT IN (
      SELECT DISTINCT ON (LOWER(name)) id
      FROM segments
      ORDER BY LOWER(name), customer_count DESC, created_at ASC
    )
    RETURNING name
  `);
  console.log(`Removed ${dupResult.rowCount} duplicate segments`);

  // 2. Reset stuck campaigns (sending for >10 minutes with no activity)
  const stuckResult = await pool.query(`
    UPDATE campaigns
    SET status = 'draft',
        stat_sent = 0, stat_delivered = 0, stat_opened = 0,
        stat_clicked = 0, stat_converted = 0, stat_failed = 0,
        sent_at = NULL
    WHERE status = 'sending'
      AND sent_at < now() - INTERVAL '10 minutes'
    RETURNING name
  `);
  console.log(`Reset ${stuckResult.rowCount} stuck campaigns`);

  // 3. Show current state
  const customers = await pool.query('SELECT COUNT(*) FROM customers');
  const segments  = await pool.query('SELECT COUNT(*) FROM segments');
  const campaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
  const comms     = await pool.query('SELECT COUNT(*) FROM communications');

  console.log('\nDatabase state:');
  console.log(`  Customers:      ${customers.rows[0].count}`);
  console.log(`  Segments:       ${segments.rows[0].count}`);
  console.log(`  Campaigns:      ${campaigns.rows[0].count}`);
  console.log(`  Communications: ${comms.rows[0].count}`);

  await pool.end();
  console.log('\nDone!');
}

clean().catch(console.error);
