import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { chatWithAI, generateChatTitle } from '@/lib/ai/chat-ai';
import { ChatSession, ChatMessage } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// GET /api/ai/chat — list sessions
export async function GET() {
  try {
    const sessions = await query<ChatSession>(
      `SELECT id, title, created_at, updated_at,
              jsonb_array_length(messages) AS message_count
       FROM chat_sessions
       ORDER BY updated_at DESC
       LIMIT 20`
    );
    return NextResponse.json({ data: sessions });
  } catch (err) {
    console.error('[GET /api/ai/chat]', err);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST /api/ai/chat — send message (creates session if needed)
export async function POST(req: NextRequest) {
  try {
    const { sessionId, message } = await req.json() as {
      sessionId?: string;
      message: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    let session: ChatSession | null = null;
    let isNew = false;

    // Load or create session
    if (sessionId) {
      session = await queryOne<ChatSession>(
        'SELECT * FROM chat_sessions WHERE id = $1',
        [sessionId]
      );
    }

    if (!session) {
      isNew = true;
      const newId = uuidv4();
      session = await queryOne<ChatSession>(
        `INSERT INTO chat_sessions (id, messages) VALUES ($1, $2) RETURNING *`,
        [newId, JSON.stringify([])]
      );
    }

    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const history = typeof session.messages === 'string'
      ? JSON.parse(session.messages)
      : session.messages;

    // Call AI
    const aiResponse = await chatWithAI(history as ChatMessage[], message);

    // Build new messages
    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const assistantMsg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: aiResponse.message,
      timestamp: new Date().toISOString(),
      action: aiResponse.action as ChatMessage['action'],
    };

    const updatedMessages = [...history, userMsg, assistantMsg];

    // Generate title from first message if new session
    let title = session.title;
    if (isNew && !title) {
      title = await generateChatTitle(message).catch(() => 'New conversation');
    }

    // Persist
    await queryOne(
      `UPDATE chat_sessions
       SET messages = $2, title = $3, updated_at = now()
       WHERE id = $1`,
      [session.id, JSON.stringify(updatedMessages), title]
    );

    return NextResponse.json({
      sessionId: session.id,
      title,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      action: aiResponse.action,
    });
  } catch (err) {
    console.error('[POST /api/ai/chat]', err);
    return NextResponse.json({ error: 'Failed to process chat message' }, { status: 500 });
  }
}
