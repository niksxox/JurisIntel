import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const DESCRIPTIONS: Record<string, string> = {
  structuring:
    'Multiple smaller transactions below reporting thresholds — likely designed to evade detection.',
  'rapid-movement':
    'Funds moved quickly between accounts within a short window — classic layering behavior.',
  'high-risk-jurisdiction':
    'Counterparty located in a high-risk jurisdiction with weak AML controls.',
  'unusual-pattern':
    'Transaction pattern inconsistent with customer profile or historical behavior.',
};

export async function GET() {
  try {
    const flagged = await db.financialTransaction.findMany({
      where: { flagged: true, flagReason: { not: null } },
      select: { flagReason: true, amount: true },
    });

    const map = new Map<string, { count: number; totalAmount: number }>();
    for (const t of flagged) {
      const reason = t.flagReason || 'unknown';
      const cur = map.get(reason) || { count: 0, totalAmount: 0 };
      cur.count += 1;
      cur.totalAmount += t.amount;
      map.set(reason, cur);
    }

    const data = Array.from(map.entries())
      .map(([pattern, v]) => ({
        pattern,
        count: v.count,
        totalAmount: Number(v.totalAmount.toFixed(2)),
        description: DESCRIPTIONS[pattern] || 'Flagged transaction pattern requiring review.',
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json(data);
  } catch (err) {
    console.error('[financial/suspicious-patterns]', err);
    return NextResponse.json({ error: 'Failed to load suspicious patterns' }, { status: 500 });
  }
}
