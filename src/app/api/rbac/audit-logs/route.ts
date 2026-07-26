import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockAuditLogs } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockAuditLogs()); }
  try {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { name: true, username: true } },
      },
    });

    const data = logs.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      details: l.details,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
      user: l.user ? { name: l.user.name, username: l.user.username } : null,
    }));

    return apiResponse(data);
  } catch (err) {
    console.error('[rbac/audit-logs]', err);
    return demoResponse(mockAuditLogs());
  }
}
