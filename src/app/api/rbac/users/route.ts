import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { demoResponse, apiResponse } from '@/lib/apiResponse';
import { mockRbacUsers } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return demoResponse(mockRbacUsers()); }
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        district: true,
        createdAt: true,
      },
    });
    return apiResponse(users);
  } catch (err) {
    console.error('[rbac/users]', err);
    return demoResponse(mockRbacUsers());
  }
}
