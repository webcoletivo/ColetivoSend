import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  
  try {
    // 1. Check Environment Variables
    const envCheck = {
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_START: process.env.DATABASE_URL?.substring(0, 15) + '...',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
      NODE_ENV: process.env.NODE_ENV,
    }

    // 2. Test Database Connection with Timeout
    // Create a promise that rejects after 5 seconds
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database Connection Timed Out (Firewall?)')), 5000)
    )

    // Race connection against timeout
    const dbPromise = prisma.user.count().catch(e => {
        throw new Error(`DB Error: ${e.message}`)
    })

    const userCount = await Promise.race([dbPromise, timeoutPromise])
    
    return NextResponse.json({
      status: 'ok',
      message: 'System Operational',
      timestamp: new Date().toISOString(),
      env: envCheck,
      database: {
        connected: true,
        latency: `${Date.now() - startTime}ms`,
        userCount
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('Debug Diagnosis Error:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'System Diagnosis Failed',
      timestamp: new Date().toISOString(),
      retry: 'Refresh this page to test again',
      error: {
        message: error.message,
        type: error.name,
        suggestion: error.message.includes('Time') ? 'Check EasyPanel Firewall / Allow Hostinger IP' : 'Check Database Credentials'
      },
      env_dump: {
         // Safe dump to verify context
        NODE_ENV: process.env.NODE_ENV,
        HAS_DB_URL: !!process.env.DATABASE_URL,
        HAS_AUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      }
    }, { status: 503 })
  }
}
