import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockCaseDetail } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (DEMO_MODE) {
    return demoResponse(mockCaseDetail(id) || {});
  }

  try {
    const caseRecord = await db.case.findUnique({
      where: { id },
      include: {
        station: { select: { name: true, district: true, phone: true, address: true } },
        accused: true,
        victims: true,
        evidence: true,
        networkEdgesFrom: {
          include: {
            toCase: { select: { id: true, firNumber: true, title: true, category: true, district: true } },
          },
        },
      },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const edges = caseRecord.networkEdgesFrom.map((e) => ({
      id: e.id,
      relationType: e.relationType,
      strength: e.strength,
      relatedCase: e.toCase,
    }));

    return apiResponse({
      ...caseRecord,
      networkEdgesFrom: edges,
    });
  } catch (err) {
    console.error('[cases/[id]]', err);
    return demoResponse(mockCaseDetail(id) || {});
  }
}
