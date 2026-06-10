import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { Segment, FilterRuleGroup } from '@/lib/types';
import { buildSegmentCountQuery } from '@/lib/segments/filter-engine';
import { generateSegmentRules, generateSegmentMeta } from '@/lib/ai/segment-ai';
import { v4 as uuidv4 } from 'uuid';

export async function GET(_req: NextRequest) {
  try {
    const segments = await query<Segment>(
      `SELECT * FROM segments ORDER BY created_at DESC`
    );
    return NextResponse.json({ data: segments });
  } catch (err) {
    console.error('[GET /api/segments]', err);
    return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name?: string;
      description?: string;
      filter_rules?: FilterRuleGroup;
      ai_prompt?: string;
    };

    let filterRules = body.filter_rules;
    let name = body.name;
    let description = body.description;

    // AI-generated segment from natural language
    if (body.ai_prompt && !filterRules) {
      const [rules, meta] = await Promise.all([
        generateSegmentRules(body.ai_prompt),
        generateSegmentMeta(body.ai_prompt),
      ]);
      filterRules = rules;
      if (!name) name = meta.name;
      if (!description) description = meta.description;
    }

    if (!filterRules) {
      return NextResponse.json({ error: 'filter_rules or ai_prompt required' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    // Count matching customers
    const { sql: countSql, params: countParams } = buildSegmentCountQuery(filterRules);
    const countResult = await queryOne<{ count: string }>(countSql, countParams);
    const customerCount = parseInt(countResult?.count ?? '0', 10);

    // Check for duplicate segment (same name or identical rules)
    const existing = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM segments
       WHERE LOWER(name) = LOWER($1) OR filter_rules::text = $2
       LIMIT 1`,
      [name, JSON.stringify(filterRules)]
    );
    if (existing) {
      // Return existing segment instead of creating duplicate
      const seg = await queryOne(`SELECT * FROM segments WHERE id = $1`, [existing.id]);
      return NextResponse.json(seg, { status: 200 });
    }

    const id = uuidv4();
    const segment = await queryOne<Segment>(
      `INSERT INTO segments (id, name, description, filter_rules, ai_prompt, customer_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, name, description ?? null, JSON.stringify(filterRules), body.ai_prompt ?? null, customerCount]
    );

    return NextResponse.json(segment, { status: 201 });
  } catch (err) {
    console.error('[POST /api/segments]', err);
    return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 });
  }
}
