import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { Campaign, Communication } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const campaign = await queryOne<Campaign>(
      `SELECT c.*, s.name AS segment_name
       FROM campaigns c
       LEFT JOIN segments s ON s.id = c.segment_id
       WHERE c.id = $1`,
      [id]
    );

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const communications = await query<Communication>(
      `SELECT cm.*, cu.name AS customer_name, cu.email AS customer_email
       FROM communications cm
       JOIN customers cu ON cu.id = cm.customer_id
       WHERE cm.campaign_id = $1
       ORDER BY cm.created_at DESC
       LIMIT 100`,
      [id]
    );

    return NextResponse.json({ campaign, communications });
  } catch (err) {
    console.error('[GET /api/campaigns/:id]', err);
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const campaign = await queryOne<Campaign>(
      'SELECT status FROM campaigns WHERE id = $1',
      [id]
    );

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Cannot delete a campaign that is currently sending' }, { status: 409 });
    }

    await query('DELETE FROM campaigns WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/campaigns/:id]', err);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
