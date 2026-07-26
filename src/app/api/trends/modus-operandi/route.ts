import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockModusOperandi } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockModusOperandi()); }
  try {
    const rows = await db.case.groupBy({
      by: ['modusOperandi'],
      _count: { _all: true },
      orderBy: { _count: { modusOperandi: 'desc' } },
      take: 8,
    });
    const data = rows.map((r) => ({ modusOperandi: r.modusOperandi, count: r._count._all }));
    return apiResponse(data);
  } catch (err) {
    console.error('[trends/modus-operandi]', err);
    return demoResponse(mockModusOperandi());
  }
}
