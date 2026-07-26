import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Aggregate by district: count, avg severity, top category
    const rows = await db.case.groupBy({
      by: ['district'],
      _count: { _all: true },
      _avg: { severity: true },
      orderBy: { _count: { district: 'desc' } },
      take: 8,
    });

    const topDistricts = rows.map((r) => r.district);

    // Fetch category breakdown per district
    const perDistrict = await db.case.groupBy({
      by: ['district', 'category'],
      _count: { _all: true },
      where: { district: { in: topDistricts } },
    });

    const topCatByDistrict = new Map<string, { category: string; count: number }>();
    for (const r of perDistrict) {
      const cur = topCatByDistrict.get(r.district);
      if (!cur || r._count._all > cur.count) {
        topCatByDistrict.set(r.district, { category: r.category, count: r._count._all });
      }
    }

    const data = rows.map((r) => ({
      district: r.district,
      count: r._count._all,
      severity_avg: r._avg.severity ? Number(r._avg.severity.toFixed(2)) : 0,
      topCategory: topCatByDistrict.get(r.district)?.category ?? null,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error('[trends/hotspots]', err);
    return NextResponse.json({ error: 'Failed to load hotspots' }, { status: 500 });
  }
}
