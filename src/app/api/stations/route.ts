import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockStations } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return NextResponse.json(mockStations()); }
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
    return NextResponse.json(mockStations());
  }
}
