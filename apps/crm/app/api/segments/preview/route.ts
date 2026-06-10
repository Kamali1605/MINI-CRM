import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { FilterRuleGroup } from '@/lib/types';
import { buildSegmentCountQuery } from '@/lib/segments/filter-engine';

/**
 * Quick count preview without saving the segment.
 * POST { filter_rules: FilterRuleGroup } → { count: number }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { filter_rules: FilterRuleGroup };

    if (!body.filter_rules) {
      return NextResponse.json({ error: 'filter_rules required' }, { status: 400 });
    }

    const { sql, params } = buildSegmentCountQuery(body.filter_rules);
    const result = await queryOne<{ count: string }>(sql, params);
    const count = parseInt(result?.count ?? '0', 10);

    return NextResponse.json({ count });
  } catch (err) {
    console.error('[POST /api/segments/preview]', err);
    return NextResponse.json({ error: 'Failed to preview segment' }, { status: 500 });
  }
}
