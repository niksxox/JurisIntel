import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockCaseDistricts } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET() {
  if (DEMO_MODE) {
    return demoResponse(mockCaseDistricts());
  }

  try {
    const rows = await db.case.groupBy({
      by: ['district'],
      _count: { _all: true },
      orderBy: { district: 'asc' },
    });
    const data = rows.map((r) => r.district).filter(Boolean);
    return apiResponse(data);
  } catch (err) {
    console.error('[cases/districts]', err);
    return demoResponse(mockCaseDistricts());
  }
}
