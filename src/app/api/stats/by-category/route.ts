import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.case.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
    });
    const data = rows.map((r) => ({ category: r.category, count: r._count._all }));
    return NextResponse.json(data);
  } catch (err) {
    console.error('[stats/by-category]', err);
    return NextResponse.json({ error: 'Failed to load category stats' }, { status: 500 });
  }
}
