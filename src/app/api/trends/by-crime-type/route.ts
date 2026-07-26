import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockByCrimeType } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET() {
  if (DEMO_MODE) {
    return demoResponse(mockByCrimeType());
  }
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
    return apiResponse(data);
  } catch (err) {
    console.error('[trends/by-crime-type]', err);
    return demoResponse(mockByCrimeType());
  }
}
