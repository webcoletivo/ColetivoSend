import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { encode } from 'next-auth/jwt'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { destinoSeguro } from '@/lib/sso-destino'

/**
 * Ponte SSO da unificação por abas (plataforma Grupo Coletivo).
 * Valida a sessão da plataforma via /api/auth/verify e cunha a sessão
 * next-auth v4 local — nenhuma rota existente precisa mudar.
 */
export const dynamic = 'force-dynamic'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/send'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60
/** next-auth assina o JWT com HS256 (HKDF do segredo): menos que isto é fraco demais. */
const TAMANHO_MINIMO_SEGREDO = 32

interface RespostaVerify {
  user?: { id?: unknown; name?: unknown; email?: unknown }
  modules?: { module?: unknown; role?: unknown }[]
  isSuperadmin?: unknown
}

export async function GET(request: NextRequest) {
  const next = destinoSeguro(request.nextUrl.searchParams.get('next'), BASE_PATH)
  const platformUrl = process.env.PLATFORM_URL ?? 'http://localhost:3000'

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < TAMANHO_MINIMO_SEGREDO) {
    logger.error('[SSO] NEXTAUTH_SECRET ausente ou curto demais (mínimo 32 caracteres)')
    return new NextResponse('Configuração de sessão inválida.', { status: 500 })
  }

  let verify: Response
  try {
    verify = await fetch(`${platformUrl}/api/auth/verify`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  } catch (e) {
    logger.error('[SSO] plataforma inacessível', e)
    return new NextResponse('Plataforma de login indisponível. Tente novamente.', { status: 503 })
  }

  if (verify.status === 401) {
    // Base = PLATFORM_URL (mesmo domínio): atrás do proxy, request.url vem
    // como localhost:3000 e um redirect absoluto montado dele vaza pro
    // navegador.
    const login = new URL('/login', platformUrl)
    login.searchParams.set('next', next)
    return NextResponse.redirect(login)
  }
  if (!verify.ok) {
    return new NextResponse('Falha ao validar a sessão.', { status: 502 })
  }

  const data = (await verify.json().catch(() => null)) as RespostaVerify | null
  const emailBruto = typeof data?.user?.email === 'string' ? data.user.email : ''
  const email = emailBruto.toLowerCase().trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    logger.error('[SSO] verify sem e-mail válido')
    return new NextResponse('Falha ao validar a sessão.', { status: 502 })
  }
  const nomeDaPlataforma = typeof data?.user?.name === 'string' ? data.user.name.trim().slice(0, 100) : ''
  const modulos = Array.isArray(data?.modules) ? data!.modules! : []
  const sendRole = modulos.find((m) => m?.module === 'SEND')?.role
  const isSuperadmin = data?.isSuperadmin === true

  if (!sendRole && !isSuperadmin) {
    return new NextResponse('Você não tem acesso ao ColetivoSend. Fale com o administrador.', {
      status: 403,
    })
  }

  const isAdmin = isSuperadmin || sendRole === 'ADMIN'

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: nomeDaPlataforma || 'Usuário',
        emailVerifiedAt: new Date(), // identidade garantida pela plataforma
        isAdmin,
      },
    })
    logger.info('[SSO] usuário local criado', { email })
  } else if (user.isAdmin !== isAdmin || (nomeDaPlataforma && user.name !== nomeDaPlataforma)) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin, name: nomeDaPlataforma || user.name },
    })
  }

  const sessionToken = await encode({
    token: { id: user.id, email: user.email, name: user.name, picture: user.image },
    secret,
    maxAge: SESSION_MAX_AGE,
  })

  const secure = platformUrl.startsWith('https:')
  const cookieName = secure ? '__Secure-next-auth.session-token' : 'next-auth.session-token'

  const res = NextResponse.redirect(new URL(next, platformUrl))
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
