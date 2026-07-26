import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockRiskFactors } from '@/lib/mockApiResponses';

function priorBucket(n: number): string {
  if (n === 0) return 'No prior';
  if (n <= 2) return '1-2 prior';
  return '3+ prior';
}

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockRiskFactors()); }
  try {
    const accused = await db.accused.findMany({
      select: { priorConvictions: true, occupation: true, riskScore: true },
    });

    const factorMap = new Map<string, { count: number; riskSum: number }>();

    // By prior-convictions bucket
    for (const a of accused) {
      const factor = priorBucket(a.priorConvictions);
      const cur = factorMap.get(factor) || { count: 0, riskSum: 0 };
      cur.count += 1;
      cur.riskSum += a.riskScore;
      factorMap.set(factor, cur);
    }

    // By occupation (top 6)
    const occMap = new Map<string, { count: number; riskSum: number }>();
    for (const a of accused) {
      if (!a.occupation) continue;
      const cur = occMap.get(a.occupation) || { count: 0, riskSum: 0 };
      cur.count += 1;
      cur.riskSum += a.riskScore;
      occMap.set(a.occupation, cur);
    }
    const topOcc = Array.from(occMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);

    const data = [
      ...Array.from(factorMap.entries()).map(([factor, v]) => ({
        factor,
        count: v.count,
        avgRisk: v.count > 0 ? Number((v.riskSum / v.count).toFixed(1)) : 0,
      })),
      ...topOcc.map(([factor, v]) => ({
        factor: `Occupation: ${factor}`,
        count: v.count,
        avgRisk: v.count > 0 ? Number((v.riskSum / v.count).toFixed(1)) : 0,
      })),
    ].sort((a, b) => b.avgRisk - a.avgRisk);

    return apiResponse(data);
  } catch (err) {
    console.error('[socio/risk-factors]', err);
    return demoResponse(mockRiskFactors());
  }
}
