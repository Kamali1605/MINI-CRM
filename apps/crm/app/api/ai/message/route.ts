import { NextRequest, NextResponse } from 'next/server';
import { generateCampaignMessage } from '@/lib/ai/segment-ai';

export async function POST(req: NextRequest) {
  try {
    const { segmentDescription, channel, campaignGoal } = await req.json() as {
      segmentDescription: string;
      channel: string;
      campaignGoal?: string;
    };

    if (!segmentDescription || !channel) {
      return NextResponse.json({ error: 'segmentDescription and channel are required' }, { status: 400 });
    }

    const message = await generateCampaignMessage({ segmentDescription, channel, campaignGoal });
    return NextResponse.json({ message });
  } catch (err) {
    console.error('[POST /api/ai/message]', err);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
