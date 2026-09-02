import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Ponte SSO da unificação por abas (plataforma Grupo Coletivo).
 * Valida a sessão da plataforma via /api/auth/verify e cunha a sessão
 * next-auth v4 local — nenhuma rota existente precisa mudar.
 */
export const dynamic = 'force-dynamic'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/send'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60

function safeNext(raw: string | null): string {
  // "//host" e "/\host" viram URL externa no navegador — só caminho interno
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\')) return raw
  return `${BASE_PATH}/dashboard`
}

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'))
  const platformUrl = process.env.PLATFORM_URL ?? 'http://localhost:3000'

  let verify: Response
  try {
    verify = await fetch(`${platformUrl}/api/auth/verify`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
    })
  } catch (e) {
    logger.error('[SSO] plataforma inacessível', e)
    return new NextResponse('Plataforma de login indisponível. Tente novamente.', { status: 503 })
  }

  if (verify.status === 401) {
    const login = new URL('/login', request.url)
    login.pathname = '/login' // raiz do domínio, fora do basePath
    login.searchParams.set('next', next)
    return NextResponse.redirect(login)
  }
  if (!verify.ok) {
    return new NextResponse('Falha ao validar a sessão.', { status: 502 })
  }

  const data = (await verify.json()) as {
    user: { id: string; name: string; email: string }
    modules: { module: string; role: string }[]
    isSuperadmin: boolean
  }

  const sendRole = data.modules.find((m) => m.module === 'SEND')?.role
  if (!sendRole && !data.isSuperadmin) {
    return new NextResponse('Você não tem acesso ao ColetivoSend. Fale com o administrador.', {
      status: 403,
    })
  }

  const email = data.user.email.toLowerCase().trim()
  const isAdmin = data.isSuperadmin || sendRole === 'ADMIN'

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: data.user.name || 'Usuário',
        emailVerifiedAt: new Date(), // identidade garantida pela plataforma
        isAdmin,
      },
    })
    logger.info('[SSO] usuário local criado', { email })
  } else if (user.isAdmin !== isAdmin || user.name !== data.user.name) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin, name: data.user.name || user.name },
    })
  }

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return new NextResponse('NEXTAUTH_SECRET ausente.', { status: 500 })

  const sessionToken = await encode({
    token: { id: user.id, email: user.email, name: user.name, picture: user.image },
    secret,
    maxAge: SESSION_MAX_AGE,
  })

  const secure = request.nextUrl.protocol === 'https:'
  const cookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

  const res = NextResponse.redirect(new URL(next, request.url))
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return res
}
