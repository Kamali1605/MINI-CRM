import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { Segment, Customer } from '@/lib/types';
import { buildSegmentQuery, buildSegmentCountQuery } from '@/lib/segments/filter-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const segment = await queryOne<Segment>(
      'SELECT * FROM segments WHERE id = $1',
      [id]
    );

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // Optionally include matching customers
    const { searchParams } = new URL(req.url);
    const includeCustomers = searchParams.get('include') === 'customers';

    if (includeCustomers) {
      const rules = typeof segment.filter_rules === 'string'
        ? JSON.parse(segment.filter_rules)
        : segment.filter_rules;

      const { sql, params: qParams } = buildSegmentQuery(rules);
      const customers = await query<Customer>(sql, qParams);
      return NextResponse.json({ segment, customers });
    }

    return NextResponse.json(segment);
  } catch (err) {
    console.error('[GET /api/segments/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { name, description, filter_rules } = body;

    let customerCount: number | undefined;

    if (filter_rules) {
      const { sql, params: countParams } = buildSegmentCountQuery(filter_rules);
      const result = await queryOne<{ count: string }>(sql, countParams);
      customerCount = parseInt(result?.count ?? '0', 10);
    }

    const segment = await queryOne<Segment>(
      `UPDATE segments SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         filter_rules = COALESCE($4, filter_rules),
         customer_count = COALESCE($5, customer_count),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, name, description, filter_rules ? JSON.stringify(filter_rules) : null, customerCount]
    );

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    return NextResponse.json(segment);
  } catch (err) {
    console.error('[PUT /api/segments/:id]', err);
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await query('DELETE FROM segments WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/segments/:id]', err);
    return NextResponse.json({ error: 'Failed to delete segment' }, { status: 500 });
  }
}
