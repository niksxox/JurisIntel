import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockStatsByDistrict } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET(req: NextRequest) {
  const all = req.nextUrl.searchParams.get('all') === 'true';
  if (DEMO_MODE) {
    return demoResponse(mockStatsByDistrict(all));
  }
  try {
    const rows = await db.case.groupBy({
      by: ['district'],
      _count: { _all: true },
      orderBy: { _count: { district: 'desc' } },
      ...(all ? {} : { take: 10 }),
    });
    const data = rows.map((r) => ({ district: r.district, count: r._count._all }));
    return apiResponse(data);
  } catch (err) {
    console.error('[stats/by-district]', err);
    return demoResponse(mockStatsByDistrict(all));
  }
}
