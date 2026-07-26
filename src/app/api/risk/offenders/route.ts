import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const offenders = await db.accused.findMany({
      where: { riskScore: { gte: 60 } },
      orderBy: { riskScore: 'desc' },
      take: 20,
      include: {
        case: {
          select: {
            firNumber: true,
            category: true,
            district: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    const data = offenders.map((o) => ({
      id: o.id,
      name: o.name,
      age: o.age,
      gender: o.gender,
      occupation: o.occupation,
      district: o.district,
      priorConvictions: o.priorConvictions,
      riskScore: o.riskScore,
      status: o.status,
      isWanted: o.isWanted,
      case: o.case,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error('[risk/offenders]', err);
    return NextResponse.json({ error: 'Failed to load high-risk offenders' }, { status: 500 });
  }
}
