import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { DashboardStats } from '@/lib/types';

const safeInt   = (v: unknown) => parseInt(String(v ?? '0'), 10) || 0;
const safeFloat = (v: unknown) => {
  const n = parseFloat(String(v ?? '0'));
  return isNaN(n) ? 0 : Math.round(n * 10) / 10;
};

export async function GET() {
  try {
    const [
      customerCount,
      campaignCount,
      commCount,
      rateStats,
      recentCampaigns,
      topSegments,
      commsByDay,
      channelStats,
      conversionStats,
    ] = await Promise.all([

      queryOne<{ count: string }>('SELECT COUNT(*) FROM customers'),

      queryOne<{ count: string }>('SELECT COUNT(*) FROM campaigns'),

      queryOne<{ count: string }>('SELECT COUNT(*) FROM communications'),

      // No ROUND in SQL — do it in JS to avoid Supabase float overload issue
      queryOne<{ avg_delivery: string | null; avg_open: string | null; avg_click: string | null }>(`
        SELECT
          AVG(CASE WHEN stat_sent > 0
            THEN stat_delivered::float / stat_sent ELSE NULL END) * 100 AS avg_delivery,
          AVG(CASE WHEN stat_delivered > 0
            THEN stat_opened::float / stat_delivered ELSE NULL END) * 100 AS avg_open,
          AVG(CASE WHEN stat_opened > 0
            THEN stat_clicked::float / stat_opened ELSE NULL END) * 100 AS avg_click
        FROM campaigns WHERE stat_sent > 0
      `),

      query(`
        SELECT c.*, s.name AS segment_name
        FROM campaigns c
        LEFT JOIN segments s ON s.id = c.segment_id
        ORDER BY c.created_at DESC LIMIT 5
      `),

      query(`
        SELECT DISTINCT ON (LOWER(name)) name, customer_count
        FROM segments
        WHERE customer_count > 0
        ORDER BY LOWER(name), customer_count DESC
        LIMIT 5
      `),

      query(`
        SELECT
          DATE_TRUNC('day', sent_at)::text AS date,
          COUNT(*)::int AS sent,
          COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked','converted'))::int AS delivered,
          COUNT(*) FILTER (WHERE status IN ('opened','clicked','converted'))::int AS opened
        FROM communications
        WHERE sent_at IS NOT NULL
          AND sent_at >= now() - INTERVAL '14 days'
        GROUP BY 1 ORDER BY 1
      `),

      query(`
        SELECT
          channel,
          COUNT(*)::int                                                            AS total_sent,
          COUNT(*) FILTER (WHERE status IN ('delivered','opened','clicked','converted'))::int AS delivered,
          COUNT(*) FILTER (WHERE status IN ('opened','clicked','converted'))::int AS opened,
          COUNT(*) FILTER (WHERE status IN ('clicked','converted'))::int          AS clicked,
          COUNT(*) FILTER (WHERE status = 'converted')::int                       AS converted,
          COUNT(*) FILTER (WHERE status = 'failed')::int                          AS failed
        FROM communications
        GROUP BY channel
        ORDER BY total_sent DESC
      `),

      queryOne<{ total_converted: string; campaigns_with_conversions: string }>(`
        SELECT
          COALESCE(SUM(stat_converted), 0)::text                      AS total_converted,
          COUNT(*) FILTER (WHERE stat_converted > 0)::text            AS campaigns_with_conversions
        FROM campaigns
      `),
    ]);

    const stats = {
      totalCustomers:      safeInt(customerCount?.count),
      totalCampaigns:      safeInt(campaignCount?.count),
      totalCommunications: safeInt(commCount?.count),
      avgDeliveryRate:     safeFloat(rateStats?.avg_delivery),
      avgOpenRate:         safeFloat(rateStats?.avg_open),
      avgClickRate:        safeFloat(rateStats?.avg_click),
      recentCampaigns:     (recentCampaigns ?? []) as unknown as DashboardStats['recentCampaigns'],
      topSegments:         (topSegments ?? []) as DashboardStats['topSegments'],
      communicationsByDay: ((commsByDay ?? []) as Array<{
        date: string; sent: number; delivered: number; opened: number;
      }>).map((r) => ({
        date:      r.date,
        sent:      safeInt(r.sent),
        delivered: safeInt(r.delivered),
        opened:    safeInt(r.opened),
      })),
      channelStats: ((channelStats ?? []) as Array<Record<string, unknown>>).map((r) => {
        const sent = safeInt(r.total_sent);
        const del  = safeInt(r.delivered);
        const opn  = safeInt(r.opened);
        return {
          channel:       r.channel,
          total_sent:    sent,
          delivered:     del,
          opened:        opn,
          clicked:       safeInt(r.clicked),
          converted:     safeInt(r.converted),
          failed:        safeInt(r.failed),
          delivery_rate: sent > 0 ? Math.round((del / sent) * 1000) / 10 : 0,
          open_rate:     del  > 0 ? Math.round((opn / del)  * 1000) / 10 : 0,
        };
      }),
      totalConverted:           safeInt(conversionStats?.total_converted),
      campaignsWithConversions: safeInt(conversionStats?.campaigns_with_conversions),
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error('[GET /api/dashboard]', err);
    return NextResponse.json({
      totalCustomers: 0, totalCampaigns: 0, totalCommunications: 0,
      avgDeliveryRate: 0, avgOpenRate: 0, avgClickRate: 0,
      recentCampaigns: [], topSegments: [], communicationsByDay: [],
      channelStats: [], totalConverted: 0, campaignsWithConversions: 0,
    });
  }
}
