import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { LRUCache } from 'lru-cache'

// Static security headers (CSP is generated per-request with a nonce below).
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Block search engine indexing at the HTTP layer (defense in depth alongside robots.txt + metadata)
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload'
}

// Generate a cryptographically-random nonce (Edge runtime compatible).
function generateNonce(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

// Build a strict CSP. script-src uses a per-request nonce + strict-dynamic
// instead of 'unsafe-inline', removing the inline-script XSS vector.
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development'
  // next dev needs 'unsafe-eval' for HMR; production does not.
  const scriptSrc = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.amazonaws.com",
    "media-src 'self' blob: https://*.amazonaws.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.amazonaws.com",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ') + ';'
}

// Rate limit storage (LRU Cache to prevent memory leaks)
// NOTE: This is in-memory and local to the function instance.
// In distributed/serverless environments (like Vercel), this cache is NOT shared.
// For critical routes, we also use database-backed rate limiting in the API routes.
const rateLimit = new LRUCache<string, { count: number; resetAt: number }>({
  max: 500, // Maximum number of IPs to track
  ttl: 60 * 1000, // Default 1 minute TTL
})

function getRateLimitKey(request: NextRequest, action: string): string {
  // Try to get IP from various headers, prioritized by reliability
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  let ip = 'unknown'
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, the first one is the client
    ip = forwardedFor.split(',')[0].trim()
  } else if (realIp) {
    ip = realIp
  }

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
  const nonce = generateNonce()
  const csp = buildCsp(nonce)

  // 1. Rate limiting checks
  if (pathname.startsWith('/api/')) {
    const isNextAuthCallback = pathname.includes('/api/auth/callback') ||
      pathname.includes('/api/auth/session') ||
      pathname.includes('/api/auth/providers') ||
      pathname.includes('/api/auth/csrf')

    // Auth attempts
    if (!isNextAuthCallback && (pathname === '/api/auth/signup' || pathname.includes('/api/auth/signin'))) {
      const key = getRateLimitKey(request, 'auth')
      if (!checkRateLimit(key, 10, 60 * 1000)) {
        return withSecurityHeaders(NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 }), request, csp)
      }
    }

    // 2FA Verification
    if (pathname.includes('/api/auth/2fa/verify')) {
      const key = getRateLimitKey(request, '2fa')
      if (!checkRateLimit(key, 5, 60 * 1000)) { // 5 attempts per minute
        return withSecurityHeaders(NextResponse.json({ error: 'Muitas tentativas. Aguarde.' }, { status: 429 }), request, csp)
      }
    }

    // Transfer creation (Finalize & Presign)
    if (pathname === '/api/transfers/finalize' || pathname === '/api/upload/presign') {
      const key = getRateLimitKey(request, 'transfer_create')
      if (!checkRateLimit(key, 10, 60 * 1000)) {
        return withSecurityHeaders(NextResponse.json({ error: 'Limite de criação rápida atingido.' }, { status: 429 }), request, csp)
      }
    }

    // Password verification (for downloads)
    if (pathname.includes('/transfer/') && pathname.includes('/password') && request.method === 'POST') {
      const key = getRateLimitKey(request, 'password_verify')
      if (!checkRateLimit(key, 5, 60 * 1000)) {
        return withSecurityHeaders(NextResponse.json({ error: 'Muitas tentativas de senha.' }, { status: 429 }), request, csp)
      }
    }
  }

  // 2. Auth Protection
  const protectedRoutes = ['/dashboard', '/settings']
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return withSecurityHeaders(NextResponse.redirect(loginUrl), request, csp)
    }
  }

  const authRoutes = ['/login', '/signup']
  if (authRoutes.some(route => pathname === route)) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (token) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), request, csp)
    }
  }

  // 3. Normal Response — propagate the nonce to the request so Next.js applies
  // it to its own inline scripts, then enforce the same CSP on the response.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  return withSecurityHeaders(response, request, csp)
}

function withSecurityHeaders(response: NextResponse, request: NextRequest, csp: string) {
  // Apply standard security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  response.headers.set('Content-Security-Policy', csp)

  // CORS
  const origin = request.headers.get('origin')
  const allowedOrigins = [
    'https://send.grupocoletivo.com.br',
    'https://coletivo-send.vercel.app',
  ]
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000')
  }

  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
