import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { ReceiptPayload, CommunicationStatus } from '@/lib/types';

// Status progression: higher-ranked statuses don't regress
const STATUS_RANK: Record<CommunicationStatus, number> = {
  queued:    0,
  sent:      1,
  delivered: 2,
  opened:    3,
  clicked:   4,
  converted: 5,
  failed:    1, // Failed can arrive after sent
};

// Map status → timestamp column
const STATUS_TIMESTAMP: Partial<Record<CommunicationStatus, string>> = {
  delivered: 'delivered_at',
  opened:    'opened_at',
  clicked:   'clicked_at',
  converted: 'converted_at',
  failed:    'failed_at',
};

// Map status → campaign stat column
const STATUS_STAT: Partial<Record<CommunicationStatus, string>> = {
  delivered: 'stat_delivered',
  opened:    'stat_opened',
  clicked:   'stat_clicked',
  converted: 'stat_converted',
  failed:    'stat_failed',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ReceiptPayload;
    const { communicationId, status, timestamp } = body;

    if (!communicationId || !status) {
      return NextResponse.json({ error: 'communicationId and status required' }, { status: 400 });
    }

    // Load existing communication
    const comm = await queryOne<{
      id: string;
      campaign_id: string;
      status: CommunicationStatus;
    }>(
      'SELECT id, campaign_id, status FROM communications WHERE id = $1',
      [communicationId]
    );

    if (!comm) {
      // Idempotent — receipt for unknown communication is silently ignored
      return NextResponse.json({ ok: true, note: 'Communication not found — ignored' });
    }

    const currentRank = STATUS_RANK[comm.status] ?? 0;
    const incomingRank = STATUS_RANK[status] ?? 0;

    // Don't regress status (e.g. don't mark "delivered" → "sent" if we already have "clicked")
    if (incomingRank <= currentRank && status !== 'failed') {
      return NextResponse.json({ ok: true, note: 'Status not advanced — ignored' });
    }

    // Update communication status + timestamp
    const tsCol = STATUS_TIMESTAMP[status];
    if (tsCol) {
      await queryOne(
        `UPDATE communications SET status = $2, ${tsCol} = $3 WHERE id = $1`,
        [communicationId, status, timestamp || new Date().toISOString()]
      );
    } else {
      await queryOne(
        `UPDATE communications SET status = $2 WHERE id = $1`,
        [communicationId, status]
      );
    }

    // Increment campaign aggregate stat
    const statCol = STATUS_STAT[status];
    if (statCol) {
      await queryOne(
        `UPDATE campaigns SET ${statCol} = ${statCol} + 1 WHERE id = $1`,
        [comm.campaign_id]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/receipts]', err);
    return NextResponse.json({ error: 'Failed to process receipt' }, { status: 500 });
  }
}
