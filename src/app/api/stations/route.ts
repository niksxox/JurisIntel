import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const stations = await db.station.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        district: true,
        address: true,
        phone: true,
        latitude: true,
        longitude: true,
        activeCases: true,
        totalCases: true,
        createdAt: true,
      },
    });
    return NextResponse.json(stations);
  } catch (err) {
    console.error('[stations]', err);
    return NextResponse.json({ error: 'Failed to load stations' }, { status: 500 });
  }
}
