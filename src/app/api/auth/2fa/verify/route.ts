import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticator } from 'otplib'
import { decryptSecret } from '@/lib/security'
import jwt from 'jsonwebtoken'

const CHALLENGE_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret'

interface ChallengePayload {
  userId: string
  email: string
  type: string
}

export async function POST(request: Request) {
  try {
    const { challengeId, otpCode } = await request.json()

    if (!challengeId || !otpCode) {
      return NextResponse.json(
        { error: 'Challenge ID e código OTP são obrigatórios' },
        { status: 400 }
      )
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otpCode)) {
      return NextResponse.json(
        { error: 'O código deve ter 6 dígitos' },
        { status: 400 }
      )
    }

    // Verify and decode challenge token
    let payload: ChallengePayload
    try {
      payload = jwt.verify(challengeId, CHALLENGE_SECRET) as ChallengePayload
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError)
      return NextResponse.json(
        { error: 'Sessão expirada. Por favor, faça login novamente.' },
        { status: 401 }
      )
    }

    if (payload.type !== '2fa_challenge') {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Get user with 2FA secret
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      }
    })

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Configuração de 2FA inválida' },
        { status: 400 }
      )
    }

    // Decrypt and validate TOTP
    try {
      const secret = decryptSecret(user.twoFactorSecret)
      const isValid = authenticator.verify({
        token: otpCode,
        secret: secret
      })

      if (!isValid) {
        return NextResponse.json(
          { error: 'Código inválido. Tente novamente.' },
          { status: 401 }
        )
      }
    } catch (totpError) {
      console.error('TOTP validation error:', totpError)
      return NextResponse.json(
        { error: 'Erro ao validar código' },
        { status: 500 }
      )
    }

    // OTP is valid - return success with user info for client-side NextAuth login
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      }
    })
  } catch (error) {
    console.error('2FA verification error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
