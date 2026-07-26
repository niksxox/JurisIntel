import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockFinancialTimeline } from '@/lib/mockApiResponses';

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  if (DEMO_MODE) { return NextResponse.json(mockFinancialTimeline()); }
  try {
    const txns = await db.financialTransaction.findMany({
      select: { date: true, amount: true, flagged: true },
      orderBy: { date: 'asc' },
    });

    const map = new Map<string, { count: number; amount: number; flagged: number }>();
    for (const t of txns) {
      const k = monthKey(t.date);
      const cur = map.get(k) || { count: 0, amount: 0, flagged: 0 };
      cur.count += 1;
      cur.amount += t.amount;
      if (t.flagged) cur.flagged += 1;
      map.set(k, cur);
    }

    const data = Array.from(map.entries())
      .map(([month, v]) => ({
        month,
        count: v.count,
        amount: Number(v.amount.toFixed(2)),
        flagged: v.flagged,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json(data);
  } catch (err) {
    console.error('[financial/timeline]', err);
    return NextResponse.json(mockFinancialTimeline());
  }
}
