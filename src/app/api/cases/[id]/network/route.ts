import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockCaseNetwork } from '@/lib/mockApiResponses';
import { demoResponse, apiResponse } from '@/lib/apiResponse';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (DEMO_MODE) {
    return demoResponse(mockCaseNetwork(id) || { nodes: [], edges: [] });
  }

  try {
    const caseRecord = await db.case.findUnique({
      where: { id },
      select: {
        id: true,
        firNumber: true,
        title: true,
        district: true,
        category: true,
        severity: true,
        accused: { select: { id: true, name: true, district: true, riskScore: true, status: true } },
        victims: { select: { id: true, name: true, age: true, gender: true } },
      },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const nodes: { id: string; label: string; type: 'case' | 'accused' | 'victim'; district?: string; category?: string }[] = [
      {
        id: caseRecord.id,
        label: caseRecord.firNumber,
        type: 'case',
        district: caseRecord.district,
        category: caseRecord.category,
      },
    ];

    const edges: { source: string; target: string; strength: number; relationType: string }[] = [];

    for (const a of caseRecord.accused) {
      nodes.push({ id: a.id, label: a.name, type: 'accused', district: a.district });
      edges.push({
        source: a.id,
        target: caseRecord.id,
        strength: a.riskScore,
        relationType: 'accused-of',
      });
    }

    for (const v of caseRecord.victims) {
      nodes.push({ id: v.id, label: v.name, type: 'victim' });
      edges.push({
        source: caseRecord.id,
        target: v.id,
        strength: 100,
        relationType: 'victim-of',
      });
    }

    return apiResponse({ nodes, edges });
  } catch (err) {
    console.error('[cases/[id]/network]', err);
    return demoResponse(mockCaseNetwork(id) || { nodes: [], edges: [] });
  }
}
