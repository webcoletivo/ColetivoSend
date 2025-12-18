import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { LRUCache } from 'lru-cache'

// Security headers
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://lh3.googleusercontent.com; font-src 'self'; frame-ancestors 'none';",
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
}

// Rate limit storage (LRU Cache to prevent memory leaks)
const rateLimit = new LRUCache<string, { count: number; resetAt: number }>({
  max: 500, // Maximum number of IPs to track
  ttl: 60 * 1000, // Default 1 minute TTL
})

function getRateLimitKey(request: NextRequest, action: string): string {
  const ip = request.headers.get('x-forwarded-for') || 
              request.headers.get('x-real-ip') || 
              'unknown'
  return `${action}:${ip}`
}

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimit.get(key)

  if (!record || now > record.resetAt) {
    rateLimit.set(key, { count: 1, resetAt: now + windowMs }, { ttl: windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  rateLimit.set(key, record) // Update to keep fresh
  return true
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  console.log(`[MIDDLEWARE ENTRY] ${request.method} ${pathname}`)
  
  const response = NextResponse.next()

  // Rate limiting for specific endpoints
  if (pathname.startsWith('/api/')) {
    // Exclude NextAuth internal routes from strict rate limiting
    const isNextAuthCallback = pathname.includes('/api/auth/callback') || 
                                pathname.includes('/api/auth/session') ||
                                pathname.includes('/api/auth/providers') ||
                                pathname.includes('/api/auth/csrf')
    
    // More strict limits for login/signup attempts only
    if (!isNextAuthCallback && (pathname === '/api/auth/signup' || pathname.includes('/login'))) {
      const key = getRateLimitKey(request, 'auth')
      if (!checkRateLimit(key, 20, 60 * 1000)) { // 20 requests per minute
        return NextResponse.json(
          { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
          { status: 429 }
        )
      }
    }

    // Transfer creation limit
    if (pathname === '/api/transfer' && request.method === 'POST') {
      const key = getRateLimitKey(request, 'transfer')
      if (!checkRateLimit(key, 20, 60 * 1000)) { // 20 per minute
        return NextResponse.json(
          { error: 'Limite de criação de envios atingido. Aguarde um momento.' },
          { status: 429 }
        )
      }
    }

    // Download rate limit (per token)
    if (pathname.startsWith('/api/download/') && request.method === 'POST') {
      const key = getRateLimitKey(request, 'download')
      if (!checkRateLimit(key, 60, 60 * 1000)) { // 60 per minute
        return NextResponse.json(
          { error: 'Muitas solicitações de download. Aguarde um momento.' },
          { status: 429 }
        )
      }
    }

    // Password verification limit (prevent brute force)
    if (pathname.includes('/download/') && request.method === 'POST') {
      const key = getRateLimitKey(request, 'password')
      if (!checkRateLimit(key, 5, 60 * 1000)) { // 5 password attempts per minute
        return NextResponse.json(
          { error: 'Muitas tentativas de senha. Aguarde alguns minutos.' },
          { status: 429 }
        )
      }
    }
  }

  // Protected routes - require authentication
  const protectedRoutes = ['/dashboard', '/settings']
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    console.log(`Middleware check [${pathname}]:`, { 
      hasToken: !!token,
      cookieCount: request.cookies.size,
      allCookies: Array.from(request.cookies.getAll()).map(c => c.name)
    })

    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Redirect authenticated users away from auth pages
  const authRoutes = ['/login', '/signup']
  if (authRoutes.some(route => pathname === route)) {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
