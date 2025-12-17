import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const envCheck = {
    DATABASE_URL: process.env.DATABASE_URL ? (process.env.DATABASE_URL.substring(0, 10) + '...') : 'MISSING',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ALL_KEYS: Object.keys(process.env).sort().filter(k => !k.includes('KEY') && !k.includes('SECRET'))
  }

  return NextResponse.json({
    status: 'ok',
    message: 'Pong! Server is alive.',
    version: '1.0.2-PING-DEBUG',
    time: new Date().toISOString(),
    env: envCheck
  })
}
