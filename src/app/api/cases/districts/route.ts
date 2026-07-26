import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rows = await db.case.groupBy({
      by: ['district'],
      _count: { _all: true },
      orderBy: { district: 'asc' },
    });
    const data = rows.map((r) => r.district).filter(Boolean);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[cases/districts]', err);
    return NextResponse.json({ error: 'Failed to load districts' }, { status: 500 });
  }
}
