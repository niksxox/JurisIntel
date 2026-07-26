import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [
      totalCases,
      openCases,
      closedCases,
      criticalCases,
      activeStations,
      totalDistricts,
      repeatOffenders,
      closedChargeSheeted,
    ] = await Promise.all([
      db.case.count(),
      db.case.count({ where: { status: 'open' } }),
      db.case.count({ where: { status: { in: ['closed', 'charge-sheeted'] } } }),
      db.case.count({ where: { priority: 'critical' } }),
      db.station.count(),
      db.district.count(),
      db.accused.count({ where: { priorConvictions: { gt: 0 } } }),
      db.case.count({
        where: {
          status: 'charge-sheeted',
          accused: { some: { status: 'in-custody' } },
        },
      }),
    ]);

    // Conviction rate: (charge-sheeted + closed) / total * 100, capped at 100
    const disposedCases = await db.case.count({
      where: { status: { in: ['closed', 'charge-sheeted'] } },
    });
    const convictionRate =
      totalCases > 0
        ? Number((((closedChargeSheeted || disposedCases) / totalCases) * 100).toFixed(1))
        : 0;

    return NextResponse.json({
      totalCases,
      openCases,
      closedCases: disposedCases,
      convictionRate,
      repeatOffenders,
      criticalCases,
      activeStations,
      totalDistricts,
    });
  } catch (err) {
    console.error('[stats/overview]', err);
    return NextResponse.json(
      { error: 'Failed to load overview stats' },
      { status: 500 }
    );
  }
}
