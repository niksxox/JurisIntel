import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '20', 10)));
    const q = sp.get('q')?.trim() || '';
    const category = sp.get('category')?.trim() || undefined;
    const status = sp.get('status')?.trim() || undefined;
    const district = sp.get('district')?.trim() || undefined;
    const priority = sp.get('priority')?.trim() || undefined;

    const where: Prisma.CaseWhereInput = {};
    if (category) where.category = category;
    if (status) where.status = status;
    if (district) where.district = district;
    if (priority) where.priority = priority;
    if (q) {
      where.OR = [
        { firNumber: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const [total, rows] = await Promise.all([
      db.case.count({ where }),
      db.case.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { registeredAt: 'desc' },
        include: {
          station: { select: { name: true, district: true } },
          _count: { select: { accused: true, victims: true, evidence: true } },
        },
      }),
    ]);

    const data = rows.map((c) => ({
      id: c.id,
      firNumber: c.firNumber,
      title: c.title,
      category: c.category,
      status: c.status,
      priority: c.priority,
      district: c.district,
      station: c.station,
      incidentDate: c.incidentDate,
      registeredAt: c.registeredAt,
      severity: c.severity,
      accusedCount: c._count.accused,
      victimsCount: c._count.victims,
      evidenceCount: c._count.evidence,
    }));

    return NextResponse.json({ data, total, page, limit });
  } catch (err) {
    console.error('[cases]', err);
    return NextResponse.json({ error: 'Failed to load cases' }, { status: 500 });
  }
}
