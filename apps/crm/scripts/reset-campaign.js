const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fix() {
  // Reset all non-sending campaigns that have bad stats (stuck drafts)
  const res = await pool.query(`
    UPDATE campaigns
    SET status = 'draft',
        stat_sent = 0, stat_delivered = 0, stat_opened = 0,
        stat_clicked = 0, stat_converted = 0, stat_failed = 0,
        sent_at = NULL
    WHERE status = 'draft' AND stat_sent > 0
    RETURNING id, name
  `);
  console.log('Reset campaigns:', res.rows);

  // Delete orphaned communications for those campaigns
  await pool.query(`
    DELETE FROM communications
    WHERE campaign_id IN (
      SELECT id FROM campaigns WHERE status = 'draft'
    )
  `);
  console.log('Cleaned up orphaned communications');
  await pool.end();
}

fix().catch(console.error);
