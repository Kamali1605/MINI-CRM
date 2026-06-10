import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { Campaign } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(_req: NextRequest) {
  try {
    const campaigns = await query<Campaign>(
      `SELECT c.*, s.name AS segment_name
       FROM campaigns c
       LEFT JOIN segments s ON s.id = c.segment_id
       ORDER BY c.created_at DESC`
    );
    return NextResponse.json({ data: campaigns });
  } catch (err) {
    console.error('[GET /api/campaigns]', err);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string;
      segment_id?: string;
      channel: string;
      message_body: string;
      scheduled_at?: string;
    };

    const { name, segment_id, channel, message_body, scheduled_at } = body;

    if (!name || !channel || !message_body) {
      return NextResponse.json(
        { error: 'name, channel, and message_body are required' },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const campaign = await queryOne<Campaign>(
      `INSERT INTO campaigns (id, name, segment_id, channel, message_body, status, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING *`,
      [id, name, segment_id ?? null, channel, message_body, scheduled_at ?? null]
    );

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error('[POST /api/campaigns]', err);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
