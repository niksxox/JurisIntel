import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockFinancialOverview } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockFinancialOverview()); }
  try {
    const txns = await db.financialTransaction.findMany({
      select: { amount: true, flagged: true, bank: true },
    });

    const totalTransactions = txns.length;
    const totalAmount = txns.reduce((s, t) => s + t.amount, 0);
    const flagged = txns.filter((t) => t.flagged);
    const flaggedCount = flagged.length;
    const flaggedAmount = flagged.reduce((s, t) => s + t.amount, 0);

    const bankMap = new Map<string, { count: number; amount: number }>();
    for (const t of txns) {
      const cur = bankMap.get(t.bank) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += t.amount;
      bankMap.set(t.bank, cur);
    }
    const byBank = Array.from(bankMap.entries())
      .map(([bank, v]) => ({
        bank,
        count: v.count,
        amount: Number(v.amount.toFixed(2)),
      }))
      .sort((a, b) => b.amount - a.amount);

    return apiResponse({
      totalTransactions,
      totalAmount: Number(totalAmount.toFixed(2)),
      flaggedCount,
      flaggedAmount: Number(flaggedAmount.toFixed(2)),
      byBank,
    });
  } catch (err) {
    console.error('[financial/overview]', err);
    return demoResponse(mockFinancialOverview());
  }
}
