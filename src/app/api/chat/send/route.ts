import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SYSTEM_PROMPT =
  'You are JURISINTEL, an AI intelligence assistant for the Karnataka State Police crime dashboard. ' +
  'You analyze crime data and help officers with insights. Be concise, professional, and use the provided database context to answer questions. ' +
  'When referencing data, cite specific numbers. If asked about something not in the data, say so. ' +
  'Format responses with markdown (bold, lists) for readability. ' +
  'Never invent case numbers or specific person names beyond what\'s provided.';

interface ContextSummary {
  asOf: string;
  totals: { total: number; open: number; closed: number; chargeSheeted: number; critical: number };
  topDistricts: { district: string; count: number }[];
  topCategories: { category: string; count: number }[];
  recentCases: {
    firNumber: string;
    title: string;
    category: string;
    district: string;
    status: string;
    priority: string;
  }[];
  wantedCount: number;
  filtered?: {
    field: 'district' | 'category';
    value: string;
    total: number;
    byStatus: { status: string; count: number }[];
  };
}

async function buildContext(message: string): Promise<ContextSummary> {
  const [
    total,
    open,
    closed,
    chargeSheeted,
    critical,
    wantedCount,
    topDistrictRows,
    topCategoryRows,
    recentCases,
  ] = await Promise.all([
    db.case.count(),
    db.case.count({ where: { status: 'open' } }),
    db.case.count({ where: { status: 'closed' } }),
    db.case.count({ where: { status: 'charge-sheeted' } }),
    db.case.count({ where: { priority: 'critical' } }),
    db.accused.count({ where: { isWanted: true } }),
    db.case.groupBy({
      by: ['district'],
      _count: { _all: true },
      orderBy: { _count: { district: 'desc' } },
      take: 5,
    }),
    db.case.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
      take: 5,
    }),
    db.case.findMany({
      orderBy: { registeredAt: 'desc' },
      take: 5,
      select: {
        firNumber: true,
        title: true,
        category: true,
        district: true,
        status: true,
        priority: true,
      },
    }),
  ]);

  const base: ContextSummary = {
    asOf: new Date().toISOString(),
    totals: { total, open, closed, chargeSheeted, critical },
    topDistricts: topDistrictRows.map((r) => ({ district: r.district, count: r._count._all })),
    topCategories: topCategoryRows.map((r) => ({ category: r.category, count: r._count._all })),
    recentCases,
    wantedCount,
  };

  // Detect district mentions
  const allDistricts = await db.district.findMany({ select: { name: true } });
  const msgLower = message.toLowerCase();
  const matchedDistrict = allDistricts.find((d) => msgLower.includes(d.name.toLowerCase()));
  if (matchedDistrict) {
    const [filteredTotal, filteredByStatus] = await Promise.all([
      db.case.count({ where: { district: matchedDistrict.name } }),
      db.case.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { district: matchedDistrict.name },
      }),
    ]);
    base.filtered = {
      field: 'district',
      value: matchedDistrict.name,
      total: filteredTotal,
      byStatus: filteredByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    };
    return base;
  }

  // Detect category mentions
  const allCategories = await db.case.groupBy({ by: ['category'] });
  const matchedCategory = allCategories.find((c) =>
    msgLower.includes(c.category.toLowerCase().replace('-', ' ').replace('-', ' '))
  );
  if (matchedCategory) {
    const [filteredTotal, filteredByStatus] = await Promise.all([
      db.case.count({ where: { category: matchedCategory.category } }),
      db.case.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { category: matchedCategory.category },
      }),
    ]);
    base.filtered = {
      field: 'category',
      value: matchedCategory.category,
      total: filteredTotal,
      byStatus: filteredByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    };
  }

  return base;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message: string = (body?.message || '').toString().trim();
    const sessionId: string | undefined = body?.sessionId ? String(body.sessionId) : undefined;
    const username: string | undefined = body?.username ? String(body.username) : undefined;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Resolve user
    let user = username ? await db.user.findUnique({ where: { username } }) : null;
    if (!user) {
      // Default to analyst1 (Priya Sharma), or first available user
      user = await db.user.findUnique({ where: { username: 'analyst1' } });
      if (!user) {
        user = await db.user.findFirst();
      }
      if (!user) {
        return NextResponse.json({ error: 'No users available in DB' }, { status: 500 });
      }
    }

    // Find or create chat session
    let session = sessionId ? await db.chatSession.findUnique({ where: { id: sessionId } }) : null;
    if (!session || session.userId !== user.id) {
      session = await db.chatSession.create({
        data: {
          userId: user.id,
          title: message.slice(0, 60),
        },
      });
    } else {
      await db.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() },
      });
    }

    // Save user message
    await db.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'user',
        content: message,
      },
    });

    // Build context summary from DB
    const contextSummary = await buildContext(message);

    const userMessageWithContext =
      `User question: ${message}\n\n` +
      `Current database context:\n${JSON.stringify(contextSummary, null, 2)}`;

    let reply = '';
    try {
      // Dynamically import to avoid bundling on client
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessageWithContext },
        ],
        thinking: { type: 'disabled' },
      });
      reply =
        completion.choices?.[0]?.message?.content?.toString().trim() ||
        'I was unable to generate a response. Please try again.';
    } catch (llmErr) {
      console.error('[chat/send] LLM error', llmErr);
      reply =
        `I'm having trouble connecting to the AI service right now. ` +
        `Here's what I can tell you from the local database: ` +
        `There are **${contextSummary.totals.total} total cases** (${contextSummary.totals.open} open, ` +
        `${contextSummary.totals.chargeSheeted} charge-sheeted, ${contextSummary.totals.critical} critical). ` +
        `Top district: ${contextSummary.topDistricts[0]?.district || 'N/A'}. ` +
        `${contextSummary.wantedCount} wanted offenders are currently listed. ` +
        `Please try again in a moment.`;
    }

    // Save assistant reply
    await db.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: reply,
        metadata: JSON.stringify({ contextSummary }),
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      reply,
      context: contextSummary,
    });
  } catch (err) {
    console.error('[chat/send]', err);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
