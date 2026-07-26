import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.case.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const data = rows
      .map((r) => ({
        category: r.category,
        count: r._count._all,
        percentage: total > 0 ? Number(((r._count._all / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[trends/by-crime-type]', err);
    return NextResponse.json({ error: 'Failed to load crime types' }, { status: 500 });
  }
}
