import { NextRequest, NextResponse } from 'next/server';
import { generateSegmentRules, generateSegmentMeta } from '@/lib/ai/segment-ai';
import { buildSegmentCountQuery } from '@/lib/segments/filter-engine';
import { queryOne } from '@/lib/db';

/**
 * POST { prompt: string }
 * → { filter_rules, name, description, estimated_count }
 *
 * Generates segment rules from natural language WITHOUT saving.
 * The UI can then confirm and POST to /api/segments.
 */
export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json() as { prompt: string };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const [filterRules, meta] = await Promise.all([
      generateSegmentRules(prompt),
      generateSegmentMeta(prompt),
    ]);

    // Get a live count estimate
    const { sql, params } = buildSegmentCountQuery(filterRules);
    const result = await queryOne<{ count: string }>(sql, params);
    const estimatedCount = parseInt(result?.count ?? '0', 10);

    return NextResponse.json({
      filter_rules: filterRules,
      name: meta.name,
      description: meta.description,
      estimated_count: estimatedCount,
    });
  } catch (err) {
    console.error('[POST /api/ai/segment]', err);
    return NextResponse.json({ error: 'Failed to generate segment' }, { status: 500 });
  }
}
