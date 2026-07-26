import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const username: string | undefined = body?.username ? String(body.username).trim() : undefined;
    const password: string | undefined = body?.password ? String(body.password) : undefined;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const hash = createHash('sha256').update(password).digest('hex');
    if (hash !== user.password) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Record login in audit log
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'login',
          entity: 'User',
          entityId: user.id,
          details: `User ${user.username} logged in`,
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });
    } catch (e) {
      console.error('[auth/login] audit log failed', e);
    }

    return NextResponse.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      district: user.district,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
