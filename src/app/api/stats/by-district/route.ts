import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const all = req.nextUrl.searchParams.get('all') === 'true';
    const rows = await db.case.groupBy({
      by: ['district'],
      _count: { _all: true },
      orderBy: { _count: { district: 'desc' } },
      ...(all ? {} : { take: 10 }),
    });
    const data = rows.map((r) => ({ district: r.district, count: r._count._all }));
    return NextResponse.json(data);
  } catch (err) {
    console.error('[stats/by-district]', err);
    return NextResponse.json({ error: 'Failed to load district stats' }, { status: 500 });
  }
}
