import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockNetwork } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return NextResponse.json(mockNetwork()); }
  try {
    // Pick top 30 cases by severity (reasonable node size)
    const cases = await db.case.findMany({
      orderBy: { severity: 'desc' },
      take: 30,
      select: {
        id: true,
        firNumber: true,
        title: true,
        district: true,
        category: true,
        severity: true,
        accused: { select: { id: true, name: true, district: true, riskScore: true } },
      },
    });

    const caseIds = new Set(cases.map((c) => c.id));

    // Edges among the chosen cases
    const edgesRaw = await db.networkEdge.findMany({
      where: { caseId: { in: Array.from(caseIds) }, relatedCaseId: { in: Array.from(caseIds) } },
      select: { caseId: true, relatedCaseId: true, strength: true, relationType: true },
    });

    const nodes: { id: string; label: string; type: 'case' | 'accused'; district: string; category?: string }[] = [];
    const edges: { source: string; target: string; strength: number; relationType: string }[] = [];

    const seenAccused = new Set<string>();
    for (const c of cases) {
      nodes.push({
        id: c.id,
        label: c.firNumber,
        type: 'case',
        district: c.district,
        category: c.category,
      });
      for (const a of c.accused) {
        if (!seenAccused.has(a.id)) {
          seenAccused.add(a.id);
          nodes.push({
            id: a.id,
            label: a.name,
            type: 'accused',
            district: a.district,
          });
        }
        edges.push({
          source: a.id,
          target: c.id,
          strength: a.riskScore,
          relationType: 'member',
        });
      }
    }

    for (const e of edgesRaw) {
      edges.push({
        source: e.caseId,
        target: e.relatedCaseId,
        strength: e.strength,
        relationType: e.relationType,
      });
    }

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error('[network]', err);
    return NextResponse.json(mockNetwork());
  }
}
