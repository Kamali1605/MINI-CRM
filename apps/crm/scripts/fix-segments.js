const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Minimal filter engine port to JS
function buildWhere(group, params) {
  const parts = [];
  for (const rule of group.rules) {
    if (rule.combinator) {
      const child = buildWhere(rule, params);
      parts.push(`(${child})`);
    } else {
      const { field, operator, value } = rule;
      const push = (v) => { params.push(v); return `$${params.length}`; };

      if (field === 'total_spent') {
        const ops = { gt:'>',gte:'>=',lt:'<',lte:'<=',eq:'=' };
        parts.push(`agg.total_spent ${ops[operator]||'='} ${push(Number(value))}`);
      } else if (field === 'order_count') {
        const ops = { gt:'>',gte:'>=',lt:'<',lte:'<=',eq:'=' };
        parts.push(`agg.order_count ${ops[operator]||'='} ${push(Number(value))}`);
      } else if (field === 'days_since_last_order') {
        const ops = { gt:'>',gte:'>=',lt:'<',lte:'<=',eq:'=' };
        parts.push(`EXTRACT(EPOCH FROM (now() - agg.last_order_at)) / 86400 ${ops[operator]||'>='} ${push(Number(value))}`);
      } else if (field === 'days_since_first_order') {
        const ops = { gt:'>',gte:'>=',lt:'<',lte:'<=',eq:'=' };
        parts.push(`EXTRACT(EPOCH FROM (now() - agg.first_order_at)) / 86400 ${ops[operator]||'>='} ${push(Number(value))}`);
      } else if (field === 'city') {
        if (operator === 'eq') parts.push(`LOWER(c.city) = LOWER(${push(String(value))})`);
        else if (operator === 'contains') parts.push(`LOWER(c.city) LIKE ${push('%'+String(value).toLowerCase()+'%')}`);
        else parts.push(`LOWER(c.city) != LOWER(${push(String(value))})`);
      } else if (field === 'tags') {
        if (operator === 'includes') parts.push(`${push(String(value))} = ANY(c.tags)`);
        else parts.push(`NOT (${push(String(value))} = ANY(c.tags))`);
      } else if (field === 'category_purchased') {
        if (operator === 'includes') parts.push(`${push(String(value))} = ANY(agg.categories)`);
        else parts.push(`(agg.categories IS NULL OR NOT (${push(String(value))} = ANY(agg.categories)))`);
      } else {
        parts.push('TRUE');
      }
    }
  }
  return parts.join(group.combinator === 'AND' ? ' AND ' : ' OR ') || 'TRUE';
}

async function fix() {
  const segs = await pool.query('SELECT id, name, filter_rules FROM segments');

  for (const seg of segs.rows) {
    const rules = typeof seg.filter_rules === 'string' ? JSON.parse(seg.filter_rules) : seg.filter_rules;
    const params = [];
    const where = rules.rules.length > 0 ? buildWhere(rules, params) : 'TRUE';

    const sql = `
      SELECT COUNT(*) FROM customers c
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS total_spent,
               MAX(ordered_at) AS last_order_at, MIN(ordered_at) AS first_order_at,
               ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) AS categories
        FROM orders o WHERE o.customer_id = c.id
      ) agg ON true
      WHERE ${where}
    `;

    const r = await pool.query(sql, params);
    const count = parseInt(r.rows[0].count, 10);
    await pool.query('UPDATE segments SET customer_count = $1 WHERE id = $2', [count, seg.id]);
    console.log(`  ${seg.name}: ${count} customers`);
  }

  await pool.end();
  console.log('Done!');
}

fix().catch(console.error);
