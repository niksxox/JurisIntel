import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockForecast } from '@/lib/mockApiResponses';

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockForecast()); }
  try {
    const cases = await db.case.findMany({
      where: { registeredAt: { gte: new Date('2021-01-01T00:00:00Z') } },
      select: { registeredAt: true },
      orderBy: { registeredAt: 'asc' },
    });

    // Build full monthly series 2021-01 .. current month
    const buckets = new Map<string, number>();
    for (const c of cases) {
      const k = monthKey(c.registeredAt);
      buckets.set(k, (buckets.get(k) || 0) + 1);
    }

    // Generate ordered month list from earliest (2021-01) to latest data month
    const startYear = 2021;
    const startMonth = 1;
    const now = new Date();
    const endYear = now.getUTCFullYear();
    const endMonth = now.getUTCMonth() + 1;
    const months: string[] = [];
    for (let y = startYear; y <= endYear; y++) {
      const m0 = y === startYear ? startMonth : 1;
      const m1 = y === endYear ? endMonth : 12;
      for (let m = m0; m <= m1; m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
    }

    const historical = months.map((m) => ({ month: m, count: buckets.get(m) || 0 }));

    // Take last 24 months of historical data for forecasting
    const series = historical.slice(-24);
    const counts = series.map((s) => s.count);

    // Exponential smoothing (alpha = 0.3)
    const alpha = 0.3;
    let s = counts.length > 0 ? counts[0] : 0;
    for (let i = 1; i < counts.length; i++) {
      s = alpha * counts[i] + (1 - alpha) * s;
    }

    // Forecast next 6 months (use last smoothed value as constant baseline,
    // but adjust using recent trend slope for slight growth/decline)
    const last6 = counts.slice(-6);
    const trendSlope =
      last6.length > 1
        ? (last6[last6.length - 1] - last6[0]) / (last6.length - 1)
        : 0;

    const lastMonth = months[months.length - 1];
    const [ly, lm] = lastMonth.split('-').map(Number);
    const forecast: { month: string; count: number; lower: number; upper: number }[] = [];
    let nextForecast = s;
    for (let i = 1; i <= 6; i++) {
      nextForecast = Math.max(0, nextForecast + trendSlope * 0.5);
      const rounded = Math.round(nextForecast);
      forecast.push({
        month: monthOf(ly, lm + i),
        count: rounded,
        lower: Math.max(0, Math.round(rounded * 0.8)),
        upper: Math.round(rounded * 1.2),
      });
    }

    return apiResponse({
      historical,
      forecast,
      method: 'exponential-smoothing',
      alpha,
    });
  } catch (err) {
    console.error('[prediction/forecast]', err);
    return demoResponse(mockForecast());
  }
}

function monthOf(year: number, monthOneBased: number): string {
  // Normalize overflow
  const y = year + Math.floor((monthOneBased - 1) / 12);
  const m = ((monthOneBased - 1) % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}
