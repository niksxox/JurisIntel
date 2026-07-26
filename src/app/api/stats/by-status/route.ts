import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockStatsByStatus } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET() {
  if (DEMO_MODE) {
    return demoResponse(mockStatsByStatus());
  }
  try {
    const rows = await db.case.groupBy({
      by: ['status'],
      _count: { _all: true },
      orderBy: { _count: { status: 'desc' } },
    });
    const data = rows.map((r) => ({ status: r.status, count: r._count._all }));
    return apiResponse(data);
  } catch (err) {
    console.error('[stats/by-status]', err);
    return demoResponse(mockStatsByStatus());
  }
}
