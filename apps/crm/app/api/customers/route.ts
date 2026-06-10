import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Customer } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page     = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50', 10), 200);
  const search   = searchParams.get('search') ?? '';
  const offset   = (page - 1) * pageSize;

  try {
    let whereClause = '';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      whereClause = `WHERE LOWER(c.name) LIKE $1 OR LOWER(c.email) LIKE $1`;
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM customers c ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count ?? '0', 10);

    // Build parameterized LIMIT / OFFSET using correct $ placeholders
    const limitPlaceholder  = `$${params.length + 1}`;
    const offsetPlaceholder = `$${params.length + 2}`;
    const dataParams = [...params, pageSize, offset];

    const customers = await query<Customer>(
      `SELECT * FROM customers c ${whereClause}
       ORDER BY c.total_spent DESC, c.created_at DESC
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      dataParams
    );

    return NextResponse.json({ data: customers, total, page, pageSize });
  } catch (err) {
    console.error('[GET /api/customers]', err);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
