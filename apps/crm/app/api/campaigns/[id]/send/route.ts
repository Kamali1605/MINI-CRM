import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { Campaign, Customer, Segment } from '@/lib/types';
import { buildSegmentQuery } from '@/lib/segments/filter-engine';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const CHANNEL_STUB_URL = process.env.CHANNEL_STUB_URL || 'http://localhost:3001';
const BATCH_SIZE = 50; // concurrent sends per batch

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;

  try {
    // 1. Load campaign
    const campaign = await queryOne<Campaign>(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: `Campaign is already "${campaign.status}" — cannot re-send` },
        { status: 409 }
      );
    }
    if (!campaign.segment_id) {
      return NextResponse.json({ error: 'Assign a segment before sending' }, { status: 400 });
    }

    // 2. Resolve segment → customers
    const segment = await queryOne<Segment>(
      'SELECT * FROM segments WHERE id = $1',
      [campaign.segment_id]
    );
    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    const rules = typeof segment.filter_rules === 'string'
      ? JSON.parse(segment.filter_rules)
      : segment.filter_rules;

    const { sql, params: queryParams } = buildSegmentQuery(rules);
    const customers = await query<Customer>(sql, queryParams);

    if (customers.length === 0) {
      return NextResponse.json({ error: 'Segment matches no customers' }, { status: 400 });
    }

    // 3. Mark campaign as sending + set stat_sent immediately
    await queryOne(
      `UPDATE campaigns
         SET status = 'sending', sent_at = now(), stat_sent = $2
       WHERE id = $1`,
      [campaignId, customers.length]
    );

    // 4. Build communication records in bulk, then fan-out to channel stub
    let successCount = 0;
    let failCount = 0;

    // Process in batches to avoid exhausting DB connections
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (customer) => {
          const commId = uuidv4();
          const personalised = campaign.message_body
            .replace(/\{\{name\}\}/gi, customer.name.split(' ')[0]);

          // Insert communication record
          await queryOne(
            `INSERT INTO communications
               (id, campaign_id, customer_id, channel, message_body, status, sent_at)
             VALUES ($1, $2, $3, $4, $5, 'sent', now())`,
            [commId, campaignId, customer.id, campaign.channel, personalised]
          );

          // Fire to channel stub — if unreachable, mark failed immediately
          try {
            await axios.post(
              `${CHANNEL_STUB_URL}/send`,
              {
                communicationId: commId,
                recipientId: customer.id,
                channel: campaign.channel,
                message: personalised,
                campaignId,
                recipientPhone: customer.phone,
                recipientEmail: customer.email,
              },
              { timeout: 5000 }
            );
            successCount++;
          } catch (stubErr) {
            failCount++;
            console.error(
              `[send] Stub unreachable for ${commId}: ${(stubErr as Error).message}`
            );
            await queryOne(
              `UPDATE communications SET status = 'failed', failed_at = now() WHERE id = $1`,
              [commId]
            );
          }
        })
      );
    }

    // 5. Apply immediate failure counts if any (stub unreachable)
    if (failCount > 0) {
      await queryOne(
        `UPDATE campaigns SET stat_failed = stat_failed + $2 WHERE id = $1`,
        [campaignId, failCount]
      );
    }

    // 6. Mark campaign sent
    await queryOne(
      `UPDATE campaigns SET status = 'sent' WHERE id = $1`,
      [campaignId]
    );

    // 7. Refresh segment customer count (may have changed since last save)
    await queryOne(
      `UPDATE segments SET customer_count = $2 WHERE id = $1`,
      [campaign.segment_id, customers.length]
    );

    const updated = await queryOne<Campaign>(
      `SELECT c.*, s.name AS segment_name
         FROM campaigns c
         LEFT JOIN segments s ON s.id = c.segment_id
       WHERE c.id = $1`,
      [campaignId]
    );

    return NextResponse.json({
      success: true,
      recipientCount: customers.length,
      dispatchedToStub: successCount,
      failedImmediately: failCount,
      campaign: updated,
    });

  } catch (err) {
    console.error('[POST /api/campaigns/:id/send]', err);

    // Safe rollback — only resets if still stuck in "sending"
    await queryOne(
      `UPDATE campaigns SET status = 'draft' WHERE id = $1 AND status = 'sending'`,
      [campaignId]
    ).catch(() => {});

    return NextResponse.json({ error: 'Failed to send campaign' }, { status: 500 });
  }
}
