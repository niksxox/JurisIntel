import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockWantedList } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockWantedList()); }
  try {
    const wanted = await db.accused.findMany({
      where: { isWanted: true },
      orderBy: { riskScore: 'desc' },
      include: {
        case: {
          select: {
            id: true,
            firNumber: true,
            title: true,
            category: true,
            district: true,
            station: { select: { name: true } },
          },
        },
      },
    });

    const data = wanted.map((o) => ({
      id: o.id,
      name: o.name,
      age: o.age,
      gender: o.gender,
      occupation: o.occupation,
      address: o.address,
      district: o.district,
      priorConvictions: o.priorConvictions,
      riskScore: o.riskScore,
      status: o.status,
      photoUrl: o.photoUrl,
      case: o.case,
    }));

    return apiResponse(data);
  } catch (err) {
    console.error('[risk/wanted]', err);
    return demoResponse(mockWantedList());
  }
}
