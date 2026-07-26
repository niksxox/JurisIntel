import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.case.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    });
    const data = rows.map((r) => ({ status: r.status, count: r._count._all }));
    return NextResponse.json(data);
  } catch (err) {
    console.error('[stats/by-status]', err);
    return NextResponse.json({ error: 'Failed to load status stats' }, { status: 500 });
  }
}
