import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockEarlyWarnings } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockEarlyWarnings()); }
  try {
    // Use the latest case registeredAt as the reference "now" so the warnings
    // are relative to the actual data (seeded data ends in 2024).
    const latestCase = await db.case.findFirst({
      orderBy: { registeredAt: 'desc' },
      select: { registeredAt: true },
    });
    const now = latestCase ? new Date(latestCase.registeredAt) : new Date();
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setUTCMonth(now.getUTCMonth() - 3);

    // Recent cases with category + district + priority + registeredAt
    const recent = await db.case.findMany({
      where: { registeredAt: { gte: threeMonthsAgo } },
      select: {
        id: true,
        district: true,
        category: true,
        priority: true,
        severity: true,
        registeredAt: true,
      },
    });

    // Group by district + category to find spikes
    const spikeMap = new Map<string, { district: string; category: string; count: number; maxSeverity: number; latest: Date }>();
    for (const c of recent) {
      const key = `${c.district}|${c.category}`;
      const cur = spikeMap.get(key);
      if (cur) {
        cur.count += 1;
        if (c.severity > cur.maxSeverity) cur.maxSeverity = c.severity;
        if (c.registeredAt > cur.latest) cur.latest = c.registeredAt;
      } else {
        spikeMap.set(key, {
          district: c.district,
          category: c.category,
          count: 1,
          maxSeverity: c.severity,
          latest: c.registeredAt,
        });
      }
    }

    const warnings: {
      id: string;
      district: string;
      category: string;
      type: string;
      severity: string;
      confidence: number;
      description: string;
      date: string;
    }[] = [];

    let i = 0;
    for (const [, v] of spikeMap) {
      if (v.count >= 5) {
        i += 1;
        const severity =
          v.maxSeverity >= 8 ? 'critical' : v.maxSeverity >= 6 ? 'high' : 'medium';
        const confidence = Math.min(95, 60 + v.count * 4);
        warnings.push({
          id: `EW-${String(i).padStart(3, '0')}`,
          district: v.district,
          category: v.category,
          type: 'crime-spike',
          severity,
          confidence: Number(confidence.toFixed(1)),
          description: `${v.count} ${v.category} cases registered in ${v.district} in the last 3 months. Maximum observed severity: ${v.maxSeverity}/10. Recommend increased patrols and intelligence-led operations.`,
          date: v.latest.toISOString().slice(0, 10),
        });
      }
    }

    // Sort by confidence desc, take top 6
    warnings.sort((a, b) => b.confidence - a.confidence);
    const final = warnings.slice(0, 6);

    // If we don't have enough spike-based warnings, generate baseline ones
    if (final.length < 4) {
      // Find top high-risk offender districts
      const topOffenders = await db.accused.findMany({
        where: { riskScore: { gte: 70 } },
        take: 6,
        include: { case: { select: { district: true, category: true, registeredAt: true } } },
      });
      for (const o of topOffenders) {
        i += 1;
        if (final.length >= 6) break;
        final.push({
          id: `EW-${String(i).padStart(3, '0')}`,
          district: o.case.district,
          category: o.case.category,
          type: 'high-risk-offender',
          severity: o.riskScore >= 80 ? 'critical' : 'high',
          confidence: Number((50 + o.riskScore * 0.3).toFixed(1)),
          description: `High-risk offender (risk ${o.riskScore}/100, prior ${o.priorConvictions} convictions) active in ${o.case.district} area related to ${o.case.category} cases.`,
          date: (o.case.registeredAt as Date).toISOString().slice(0, 10),
        });
      }
    }

    return apiResponse(final);
  } catch (err) {
    console.error('[prediction/early-warnings]', err);
    return demoResponse(mockEarlyWarnings());
  }
}
