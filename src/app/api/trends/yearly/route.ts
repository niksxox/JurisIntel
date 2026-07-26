import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockYearlyTrend } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) {
    return NextResponse.json(mockYearlyTrend());
  }
  try {
    const cases = await db.case.findMany({
      select: { incidentDate: true },
    });
    const buckets = new Map<string, number>();
    for (const c of cases) {
      const y = String(c.incidentDate.getUTCFullYear());
      buckets.set(y, (buckets.get(y) || 0) + 1);
    }
    const data = Array.from(buckets.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));
    return NextResponse.json(data);
  } catch (err) {
    console.error('[trends/yearly]', err);
    return NextResponse.json(mockYearlyTrend());
  }
}
