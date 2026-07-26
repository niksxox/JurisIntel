import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockStatsByCategory } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json(mockStatsByCategory());
  }
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
    return NextResponse.json(mockStatsByCategory());
  }
}
