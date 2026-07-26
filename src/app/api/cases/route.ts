import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

const DEMO_CASES = [
  {
    id: "1",
    firNumber: "FIR/2026/00001",
    title: "Mobile Phone Theft",
    category: "Theft",
    status: "Under Investigation",
    priority: "High",
    district: "Bengaluru Urban",
    station: {
      name: "Cubbon Park Police Station",
      district: "Bengaluru Urban",
    },
    incidentDate: "2026-07-20T10:30:00Z",
    registeredAt: "2026-07-20T12:15:00Z",
    severity: 7,
    accusedCount: 2,
    victimsCount: 1,
    evidenceCount: 5,
  },
  {
    id: "2",
    firNumber: "FIR/2026/00002",
    title: "UPI Fraud",
    category: "Cybercrime",
    status: "Open",
    priority: "Critical",
    district: "Mysuru",
    station: {
      name: "Cyber Crime Police Station",
      district: "Mysuru",
    },
    incidentDate: "2026-07-18T09:00:00Z",
    registeredAt: "2026-07-18T09:45:00Z",
    severity: 9,
    accusedCount: 1,
    victimsCount: 3,
    evidenceCount: 8,
  },
  {
    id: "3",
    firNumber: "FIR/2026/00003",
    title: "Chain Snatching",
    category: "Robbery",
    status: "Closed",
    priority: "Medium",
    district: "Mangaluru",
    station: {
      name: "Mangaluru North PS",
      district: "Mangaluru",
    },
    incidentDate: "2026-07-10T18:20:00Z",
    registeredAt: "2026-07-10T19:00:00Z",
    severity: 5,
    accusedCount: 1,
    victimsCount: 1,
    evidenceCount: 4,
  },
  {
    id: "4",
    firNumber: "FIR/2026/00004",
    title: "Financial Scam",
    category: "Fraud",
    status: "Charge Sheet Filed",
    priority: "High",
    district: "Hubballi-Dharwad",
    station: {
      name: "Economic Offences Wing",
      district: "Hubballi-Dharwad",
    },
    incidentDate: "2026-06-30T15:00:00Z",
    registeredAt: "2026-06-30T16:30:00Z",
    severity: 8,
    accusedCount: 4,
    victimsCount: 6,
    evidenceCount: 15,
  },
];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const page = Math.max(
      1,
      parseInt(sp.get("page") || "1", 10)
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        parseInt(sp.get("limit") || "20", 10)
      )
    );

    const q = sp.get("q")?.trim() || "";
    const category = sp.get("category")?.trim() || undefined;
    const status = sp.get("status")?.trim() || undefined;
    const district = sp.get("district")?.trim() || undefined;
    const priority = sp.get("priority")?.trim() || undefined;

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
        orderBy: {
          registeredAt: "desc",
        },
        include: {
          station: {
            select: {
              name: true,
              district: true,
            },
          },
          _count: {
            select: {
              accused: true,
              victims: true,
              evidence: true,
            },
          },
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

    return NextResponse.json({
      data,
      total,
      page,
      limit,
    });

  } catch (err) {
    console.error("[cases] Falling back to demo mode", err);

    return NextResponse.json({
      data: DEMO_CASES,
      total: DEMO_CASES.length,
      page: 1,
      limit: DEMO_CASES.length,
      demoMode: true,
    });
  }
}
