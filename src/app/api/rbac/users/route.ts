import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEMO_MODE } from '@/lib/demoMode';
import { mockRbacUsers } from '@/lib/mockApiResponses';

export async function GET() {
  if (DEMO_MODE) { return NextResponse.json(mockRbacUsers()); }
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
    return NextResponse.json(users);
  } catch (err) {
    console.error('[rbac/users]', err);
    return NextResponse.json(mockRbacUsers());
  }
}
