import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredSessions } from '@/lib/upload-session'
import { cleanupExpiredTransfers } from '@/lib/cleanup'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Unified Cron Job: Cleans up expired transfers and upload sessions.
 * Complies with Vercel Hobby Tier limit of 1 cron job.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    // Use CRON_SECRET or fallback to NEXTAUTH_SECRET for local testing
    const expectedToken = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET

    if (authHeader !== `Bearer ${expectedToken}`) {
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
