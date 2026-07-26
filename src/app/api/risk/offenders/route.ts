import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockRiskOffenders } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockRiskOffenders()); }
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

    return apiResponse(data);
  } catch (err) {
    console.error('[risk/offenders]', err);
    return demoResponse(mockRiskOffenders());
  }
}
