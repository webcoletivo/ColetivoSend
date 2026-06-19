import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { cleanupExpiredSessions } from '@/lib/upload-session'
import { cleanupExpiredTransfers } from '@/lib/cleanup'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Unified Cron Job: Cleans up expired transfers and upload sessions.
 * Complies with Vercel Hobby Tier limit of 1 cron job.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''

    // Require a dedicated CRON_SECRET in production; only fall back to
    // NEXTAUTH_SECRET for local development to avoid exposing the master secret.
    const cronSecret = process.env.CRON_SECRET
    const expectedToken = cronSecret
      || (process.env.NODE_ENV !== 'production' ? process.env.NEXTAUTH_SECRET : undefined)

    if (!expectedToken) {
      console.error('[Cron] CRON_SECRET is not configured')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    if (!safeEqual(authHeader, `Bearer ${expectedToken}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron] Starting unified cleanup...')

    // 1. Cleanup expired upload sessions (chunks)
    const sessionCount = await cleanupExpiredSessions()

    // 2. Cleanup expired transfers (final files)
    const transferResult = await cleanupExpiredTransfers(50)

    console.log(`[Cron] Unified cleanup finished: ${sessionCount} sessions, ${transferResult.succeeded} transfers.`)

    return NextResponse.json({
      success: true,
      sessions: {
        cleaned: sessionCount
      },
      transfers: transferResult,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Cron] Unified cleanup error:', error)
    return NextResponse.json(
      { error: error.message || 'Cleanup failed' },
      { status: 500 }
    )
  }
}
