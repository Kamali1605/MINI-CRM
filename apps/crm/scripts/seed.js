/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Seed script — generates realistic shoppers + order history for a
 * fictional fashion/lifestyle brand called "Aura".
 */
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randomDate(from, to) {
  return new Date(from.getTime() + Math.random() * (to.getTime() - from.getTime()));
}

// ── data fixtures ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav','Aisha','Priya','Rohan','Sanya','Kabir','Meera','Arjun','Nisha','Vivek',
  'Pooja','Dev','Tanya','Rahul','Ananya','Karan','Simran','Nikhil','Kavya','Aman',
  'Riya','Siddharth','Diya','Aditya','Neha','Vikram','Aditi','Manish','Shreya','Raj',
  'Ishaan','Pallavi','Arnav','Swati','Yash','Radha','Shivam','Komal','Akash','Trisha',
];

const LAST_NAMES = [
  'Sharma','Patel','Singh','Kumar','Mehta','Joshi','Gupta','Rao','Iyer','Nair',
  'Reddy','Malhotra','Kapoor','Bose','Agarwal','Verma','Saxena','Chandra','Shah','Das',
];

const CITIES = [
  'Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad',
  'Jaipur','Surat','Lucknow','Chandigarh','Kochi','Indore','Nagpur',
];

const TAGS_POOL = [
  'vip','repeat-buyer','discount-seeker','new','at-risk','loyal',
  'high-aov','social-follower','referral','early-adopter',
];

const CATEGORIES = ['apparel','footwear','accessories','skincare','home-decor','bags'];

const PRODUCT_MAP = {
  apparel:    [['Linen Kurta', 1299], ['Casual Tee', 699], ['Ethnic Dress', 2499], ['Denim Jacket', 3499], ['Palazzo Set', 1899]],
  footwear:   [['Canvas Sneakers', 1999], ['Kolhapuri Flats', 1299], ['Block Heels', 2799], ['Loafers', 2499]],
  accessories:[['Silk Scarf', 899], ['Wooden Earrings', 499], ['Beaded Necklace', 799], ['Leather Belt', 1099]],
  skincare:   [['Rose Water Toner', 599], ['Vitamin C Serum', 1299], ['Clay Mask', 799], ['SPF Moisturiser', 999]],
  'home-decor':[['Jute Planter', 449], ['Handloom Runner', 999], ['Ceramic Vase', 1499], ['Macrame Wall Art', 1799]],
  bags:       [['Canvas Tote', 899], ['Potli Bag', 1499], ['Laptop Sling', 2299], ['Wicker Basket Bag', 1999]],
};

// ── generator ─────────────────────────────────────────────────────────────────

function generateCustomers(n) {
  const customers = [];
  const usedEmails = new Set();

  for (let i = 0; i < n; i++) {
    const first = pick(FIRST_NAMES);
    const last  = pick(LAST_NAMES);
    let email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(rand(1,999))}@example.com`;
    while (usedEmails.has(email)) {
      email = `${first.toLowerCase()}.${last.toLowerCase()}${Math.floor(rand(1,9999))}@example.com`;
    }
    usedEmails.add(email);

    const phone = `+91${Math.floor(7000000000 + Math.random() * 2999999999)}`;
    const city  = pick(CITIES);
    const numTags = Math.floor(rand(0, 3));
    const shuffled = [...TAGS_POOL].sort(() => Math.random() - 0.5);
    const tags = shuffled.slice(0, numTags);

    customers.push({ id: uuidv4(), name: `${first} ${last}`, email, phone, city, tags });
  }
  return customers;
}

function generateOrders(customers) {
  const orders = [];

  for (const customer of customers) {
    // Each customer gets 1–8 orders
    const numOrders = Math.floor(rand(1, 9));
    for (let i = 0; i < numOrders; i++) {
      const orderId   = uuidv4();
      const category  = pick(CATEGORIES);
      const products  = PRODUCT_MAP[category];
      const numItems  = Math.floor(rand(1, 4));
      const items     = [];
      let total       = 0;

      for (let j = 0; j < numItems; j++) {
        const [name, price] = pick(products);
        const qty = Math.floor(rand(1, 3));
        items.push({ name, price, qty });
        total += price * qty;
      }

      // Apply occasional discount
      if (Math.random() < 0.2) total = Math.round(total * 0.8);

      const orderedAt = randomDate(daysAgo(365), new Date());
      orders.push({ id: orderId, customerId: customer.id, total, category, items, orderedAt });
    }
  }

  return orders;
}

// ── insert ────────────────────────────────────────────────────────────────────

async function insertCustomers(client, customers) {
  // Insert in batches of 50 to avoid Supabase statement timeout
  const BATCH = 50;
  for (let i = 0; i < customers.length; i += BATCH) {
    const batch = customers.slice(i, i + BATCH);
    for (const c of batch) {
      await client.query(
        `INSERT INTO customers (id, name, email, phone, city, tags)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING`,
        [c.id, c.name, c.email, c.phone, c.city, c.tags]
      );
    }
    console.log(`  customers: ${Math.min(i + BATCH, customers.length)}/${customers.length}`);
  }
}

async function insertOrders(client, orders) {
  // Bulk insert in batches of 100 rows per query
  const BATCH = 100;
  for (let i = 0; i < orders.length; i += BATCH) {
    const batch = orders.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let p = 1;
    for (const o of batch) {
      values.push(`($${p},$${p+1},$${p+2},$${p+3},$${p+4},$${p+5})`);
      params.push(o.id, o.customerId, o.total, o.category, JSON.stringify(o.items), o.orderedAt);
      p += 6;
    }
    await client.query(
      `INSERT INTO orders (id, customer_id, total, category, items, ordered_at) VALUES ${values.join(',')}`,
      params
    );
    if (i % 500 === 0) console.log(`  orders: ${Math.min(i + BATCH, orders.length)}/${orders.length}`);
  }
}

async function updateCustomerStats(client) {
  await client.query(`
    UPDATE customers c
    SET
      total_spent   = agg.total_spent,
      order_count   = agg.order_count,
      last_order_at = agg.last_order_at
    FROM (
      SELECT
        customer_id,
        SUM(total)  AS total_spent,
        COUNT(*)    AS order_count,
        MAX(ordered_at) AS last_order_at
      FROM orders
      GROUP BY customer_id
    ) agg
    WHERE c.id = agg.customer_id
  `);
}

// ── seed built-in segments ────────────────────────────────────────────────────

async function seedSegments(client) {
  const segments = [
    {
      id: uuidv4(),
      name: 'VIP Shoppers',
      description: 'Customers who spent over ₹10,000 and ordered at least 3 times',
      filter_rules: JSON.stringify({
        combinator: 'AND',
        rules: [
          { field: 'total_spent', operator: 'gt', value: 10000 },
          { field: 'order_count', operator: 'gte', value: 3 },
        ],
      }),
    },
    {
      id: uuidv4(),
      name: 'Win-Back — Lapsed 60 Days',
      description: 'Customers who haven\'t ordered in 60+ days',
      filter_rules: JSON.stringify({
        combinator: 'AND',
        rules: [
          { field: 'days_since_last_order', operator: 'gte', value: 60 },
          { field: 'order_count', operator: 'gte', value: 1 },
        ],
      }),
    },
    {
      id: uuidv4(),
      name: 'New Customers — First 30 Days',
      description: 'Customers who made their first purchase within the last 30 days',
      filter_rules: JSON.stringify({
        combinator: 'AND',
        rules: [
          { field: 'days_since_first_order', operator: 'lte', value: 30 },
        ],
      }),
    },
    {
      id: uuidv4(),
      name: 'Footwear Enthusiasts',
      description: 'Customers who have bought from the footwear category',
      filter_rules: JSON.stringify({
        combinator: 'AND',
        rules: [
          { field: 'category_purchased', operator: 'includes', value: 'footwear' },
        ],
      }),
    },
    {
      id: uuidv4(),
      name: 'High-Value Mumbai Shoppers',
      description: 'Mumbai-based customers with total spend over ₹5,000',
      filter_rules: JSON.stringify({
        combinator: 'AND',
        rules: [
          { field: 'city', operator: 'eq', value: 'Mumbai' },
          { field: 'total_spent', operator: 'gt', value: 5000 },
        ],
      }),
    },
  ];

  for (const s of segments) {
    await client.query(
      `INSERT INTO segments (id, name, description, filter_rules)
       VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO NOTHING`,
      [s.id, s.name, s.description, s.filter_rules]
    );
  }
  console.log(`Seeded ${segments.length} segments.`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  try {
    // Idempotency guard — skip if already seeded
    const existing = await client.query('SELECT COUNT(*) FROM customers');
    const count = parseInt(existing.rows[0].count, 10);
    if (count >= 200) {
      console.log(`Database already has ${count} customers — skipping seed.`);
      console.log('Run with --force to re-seed: node scripts/seed.js --force');
      if (!process.argv.includes('--force')) {
        await client.release();
        await pool.end();
        return;
      }
      console.log('--force flag detected, re-seeding...');
      await client.query('TRUNCATE communications, campaigns, segments, orders, customers RESTART IDENTITY CASCADE');
    }

    const NUM_CUSTOMERS = 200;
    console.log(`Seeding ${NUM_CUSTOMERS} customers...`);

    const customers = generateCustomers(NUM_CUSTOMERS);
    const orders    = generateOrders(customers);

    console.log(`  → ${orders.length} orders`);

    await client.query('BEGIN');
    await insertCustomers(client, customers);
    await insertOrders(client, orders);
    await updateCustomerStats(client);
    await seedSegments(client);
    await client.query('COMMIT');

    console.log('Seed complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
