import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const host = request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  const origin = `${proto}://${host}`
  
  return NextResponse.json({
    diagnostics: {
      headers: {
        host,
        'x-forwarded-proto': proto,
        'x-forwarded-host': request.headers.get('x-forwarded-host'),
        origin: request.headers.get('origin'),
        referer: request.headers.get('referer'),
      },
      env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
        VERCEL_URL: process.env.VERCEL_URL || 'NOT_SET',
        NODE_ENV: process.env.NODE_ENV,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'CONNECTED' : 'MISSING',
      },
      oauth: {
        suggested_callback_url: `${origin}/api/auth/callback/google`,
        standard_callback_url: `${process.env.NEXTAUTH_URL || origin}/api/auth/callback/google`,
      }
    }
  })
}
