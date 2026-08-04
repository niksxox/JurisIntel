// Prisma client singleton with graceful degradation.
// In demo mode (DEMO_MODE=true), API routes never reach Prisma.
// This module is kept for future live-mode support.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  try {
    return new PrismaClient({
      log: process.env.NODE_ENV !== 'production' ? ['error'] : [],
    })
  } catch (err) {
    console.warn('[db] Prisma client initialization failed (expected in Demo Mode):', err)
    // Return a proxy that throws a clear error if actually used
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        return (..._args: unknown[]) => {
          throw new Error(`[db] Prisma not available (DEMO_MODE). Attempted to call: ${String(prop)}`)
        }
      }
    })
  }
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
