import { NextResponse } from 'next/server'
import { cleanupExpiredTransfers } from '@/lib/cleanup'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // Optional: Add auth check if needed
    
    console.log('[Cron] Starting cleanup job...')
    const results = await cleanupExpiredTransfers(50) // Process up to 50 items
    console.log('[Cron] Cleanup finished:', results)

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
