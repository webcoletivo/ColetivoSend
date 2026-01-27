import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredSessions } from '@/lib/upload-session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cron job to cleanup expired upload sessions
 * Should be called periodically (e.g., every hour)
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret for security
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET

        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[Cron] Starting upload session cleanup...')
        const cleanedCount = await cleanupExpiredSessions()
        console.log(`[Cron] Cleaned up ${cleanedCount} expired upload sessions`)

        return NextResponse.json({
            success: true,
            cleanedSessions: cleanedCount,
            timestamp: new Date().toISOString(),
        })
    } catch (error: any) {
        console.error('[Cron] Upload session cleanup error:', error)
        return NextResponse.json(
            { error: error.message || 'Cleanup failed' },
            { status: 500 }
        )
    }
}
