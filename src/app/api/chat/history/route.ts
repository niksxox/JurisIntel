import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockChatHistory } from '@/lib/mockApiResponses';

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (DEMO_MODE) {
      return NextResponse.json(mockChatHistory(sessionId || ''));
    }

    const messages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      sessionId,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    console.error('[chat/history]', err);
    return NextResponse.json(mockChatHistory(''));
  }
}
