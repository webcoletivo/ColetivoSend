import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Pong! Server is alive.',
    time: new Date().toISOString()
  })
}
