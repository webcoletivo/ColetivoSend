import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { checkRateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

const CHALLENGE_SECRET = process.env.NEXTAUTH_SECRET
const CHALLENGE_EXPIRY = '5m' // 5 minutes

if (!CHALLENGE_SECRET) {
  throw new Error('NEXTAUTH_SECRET is not defined')
}

export async function POST(request: Request) {
  try {
    // Rate Limiting (Strategy: IP-based)
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const limitKey = `login_challenge:${ip}`

    // Allow 10 attempts per minute
    const { success, remaining } = await checkRateLimit(limitKey, 10, 60)

    if (!success) {
      logger.warn('[RateLimit] Login challenge limit exceeded', { ip })
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json()

    // Validate input
    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, password } = validationResult.data
    const normalizedEmail = email.toLowerCase().trim()

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
      }
    })

    if (!user || !user.passwordHash) {
      // Fake delay to mitigate timing attacks (basic)
      // In a real production app we might match bcrypt time, but here we just proceed to return error.
      // We do NOT reveal that user does not exist explicitly (generic message).
      return NextResponse.json(
        { error: 'Credenciais inválidas.' }, // Changed from "Conta não encontrada" to generic "Credenciais inválidas" for better security (User Enumeration prevention)
        { status: 401 }
      )
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Credenciais inválidas.' },
        { status: 401 }
      )
    }

    // Check email verification
    if (!user.emailVerifiedAt) {
      return NextResponse.json(
        { error: 'Por favor, verifique seu e-mail antes de fazer login.' },
        { status: 403 }
      )
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Create a challenge token
      const challengeToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: '2fa_challenge',
        },
        CHALLENGE_SECRET!,
        { expiresIn: CHALLENGE_EXPIRY }
      )

      logger.info('[Auth] Login challenge success, 2FA required', { userId: user.id })

      return NextResponse.json({
        requires2FA: true,
        challengeId: challengeToken,
        email: user.email,
      })
    }

    // No 2FA - return success indicator for direct login
    logger.info('[Auth] Login challenge success, no 2FA', { userId: user.id })
    return NextResponse.json({
      requires2FA: false,
      canLogin: true,
      email: user.email,
    })
  } catch (error) {
    logger.error('Login challenge error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
