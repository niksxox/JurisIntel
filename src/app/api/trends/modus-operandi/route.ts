import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.case.groupBy({
      by: ['modusOperandi'],
      _count: { _all: true },
      orderBy: { _count: { modusOperandi: 'desc' } },
      take: 8,
    });
    const data = rows.map((r) => ({ modusOperandi: r.modusOperandi, count: r._count._all }));
    return NextResponse.json(data);
  } catch (err) {
    console.error('[trends/modus-operandi]', err);
    return NextResponse.json({ error: 'Failed to load modus operandi' }, { status: 500 });
  }
}
