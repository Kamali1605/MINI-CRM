import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { ChatSession } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    const session = await queryOne<ChatSession>(
      'SELECT * FROM chat_sessions WHERE id = $1',
      [sessionId]
    );

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error('[GET /api/ai/chat/:sessionId]', err);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    await query('DELETE FROM chat_sessions WHERE id = $1', [sessionId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/ai/chat/:sessionId]', err);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
