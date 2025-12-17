import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Check Environment Variables (Masked)
    const envStatus = {
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Set' : 'Missing',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ? 'Set' : 'Missing',
      NODE_ENV: process.env.NODE_ENV,
    }

    // 2. Test Database Connection
    const startTime = Date.now()
    const userCount = await prisma.user.count()
    const duration = Date.now() - startTime

    return NextResponse.json({
      status: 'ok',
      message: 'Connection successful',
      env: envStatus,
      database: {
        latency: `${duration}ms`,
        userCount: userCount
      }
    })

  } catch (error: any) {
    console.error('Debug DB Error:', error)
    return NextResponse.json({
      status: 'error',
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? 'Set (Check firewall/credentials)' : 'Missing',
      }
    }, { status: 500 })
  }
}
