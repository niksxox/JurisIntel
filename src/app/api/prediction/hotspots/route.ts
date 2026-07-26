import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockPredictionHotspots } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return NextResponse.json(mockPredictionHotspots()); }
  try {
    // Use the latest case registeredAt as the reference "now" — this makes
    // the prediction work correctly with the seeded data (which only goes
    // up to end of 2024) rather than the wall-clock now (2026).
    const latestCase = await db.case.findFirst({
      orderBy: { registeredAt: 'desc' },
      select: { registeredAt: true },
    });
    const now = latestCase ? new Date(latestCase.registeredAt) : new Date();

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setUTCMonth(now.getUTCMonth() - 6);

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setUTCMonth(now.getUTCMonth() - 12);

    // Recent 6-month cases by district
    const recentCases = await db.case.findMany({
      where: { registeredAt: { gte: sixMonthsAgo, lte: now } },
      select: { district: true, registeredAt: true },
    });

    // Previous 6 months (12..6 months ago) for trend slope
    const priorCases = await db.case.findMany({
      where: {
        registeredAt: { gte: twelveMonthsAgo, lt: sixMonthsAgo },
      },
      select: { district: true, registeredAt: true },
    });

    const recentMap = new Map<string, number>();
    for (const c of recentCases) recentMap.set(c.district, (recentMap.get(c.district) || 0) + 1);
    const priorMap = new Map<string, number>();
    for (const c of priorCases) priorMap.set(c.district, (priorMap.get(c.district) || 0) + 1);

    // Compute predictedCount using simple linear trend slope
    const allDistricts = new Set<string>([...recentMap.keys(), ...priorMap.keys()]);
    const predictions: {
      district: string;
      predictedCount: number;
      confidence: number;
      trend: 'rising' | 'stable' | 'falling';
    }[] = [];

    for (const district of allDistricts) {
      const recent = recentMap.get(district) || 0;
      const prior = priorMap.get(district) || 0;
      const slope = recent - prior; // positive = rising
      // Project next 6 months: recent_avg * 6 + slope * 6
      const monthlyAvg = recent / 6;
      const predicted = Math.max(0, Math.round(monthlyAvg * 6 + slope));
      const confidence = Math.min(95, 50 + Math.abs(slope) * 5 + (recent > 0 ? 10 : 0));
      const trend: 'rising' | 'stable' | 'falling' =
        slope > 1 ? 'rising' : slope < -1 ? 'falling' : 'stable';
      predictions.push({ district, predictedCount: predicted, confidence: Number(confidence.toFixed(1)), trend });
    }

    predictions.sort((a, b) => b.predictedCount - a.predictedCount);
    return NextResponse.json(predictions.slice(0, 5));
  } catch (err) {
    console.error('[prediction/hotspots]', err);
    return NextResponse.json(mockPredictionHotspots());
  }
}
