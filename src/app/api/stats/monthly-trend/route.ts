import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockStatsMonthlyTrend } from '@/lib/mockApiResponses';

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export async function GET(req: NextRequest) {
  if (DEMO_MODE) {
    return NextResponse.json(
      mockStatsMonthlyTrend(req.nextUrl.searchParams.get('category')?.trim() || undefined)
    );
  }
  try {
    const category = req.nextUrl.searchParams.get('category')?.trim() || undefined;

    // Fetch all relevant cases (filter category if provided). registeredAt 2021-01-01 to 2024-12-31.
    const cases = await db.case.findMany({
      where: {
        registeredAt: {
          gte: new Date('2021-01-01T00:00:00Z'),
          lte: new Date('2024-12-31T23:59:59Z'),
        },
        ...(category ? { category } : {}),
      },
      select: { registeredAt: true, category: true },
    });

    // Aggregate by month
    const buckets = new Map<string, { count: number; category?: string }>();
    for (const c of cases) {
      const k = monthKey(c.registeredAt);
      const existing = buckets.get(k);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(k, { count: 1, ...(category ? { category } : {}) });
      }
    }

    // Fill all months 2021-01 .. 2024-12, returning only those with data > 0
    const result: { month: string; count: number; category?: string }[] = [];
    for (let y = 2021; y <= 2024; y++) {
      for (let m = 1; m <= 12; m++) {
        const k = `${y}-${String(m).padStart(2, '0')}`;
        const b = buckets.get(k);
        if (b && b.count > 0) {
          result.push({ month: k, count: b.count, ...(category ? { category } : {}) });
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[stats/monthly-trend]', err);
    return NextResponse.json(
      mockStatsMonthlyTrend(req.nextUrl.searchParams.get('category')?.trim() || undefined)
    );
  }
}
