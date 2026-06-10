import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { Customer, Order } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const customer = await queryOne<Customer>(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const orders = await query<Order>(
      'SELECT * FROM orders WHERE customer_id = $1 ORDER BY ordered_at DESC',
      [id]
    );

    return NextResponse.json({ customer, orders });
  } catch (err) {
    console.error('[GET /api/customers/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
}
