import { NextRequest, NextResponse } from 'next/server'
import { cleanupExpiredTransfers } from '@/lib/cleanup'

export const dynamic = 'force-dynamic' // Ensure it's not cached

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')

    // Check for Vercel Cron secret using Bearer token standard
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await cleanupExpiredTransfers(50)

    return NextResponse.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Cron Cleanup Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
