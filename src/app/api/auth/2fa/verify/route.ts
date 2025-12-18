import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authenticator } from 'otplib'
import { decryptSecret } from '@/lib/security'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import crypto from 'crypto'

const CHALLENGE_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret'

interface ChallengePayload {
  userId: string
  email: string
  type: string
}

export async function POST(request: Request) {
  try {
    const { challengeId, otpCode, rememberDevice } = await request.json()

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

    // Decrypt and validate TOTP with window tolerance
    try {
      const secret = decryptSecret(user.twoFactorSecret)
      
      // Configure authenticator with window tolerance (accepts codes from ±1 window)
      authenticator.options = { 
        window: 1,  // Accept codes from 30 seconds before/after
        step: 30    // Standard TOTP step
      }
      
      const isValid = authenticator.verify({
        token: otpCode,
        secret: secret
      })

      console.log(`[2FA] OTP validation for user ${payload.userId}: ${isValid ? 'SUCCESS' : 'FAILED'}`)

      if (!isValid) {
        return NextResponse.json(
          { error: 'Código inválido. Tente novamente.' },
          { status: 401 }
        )
      }
    } catch (totpError) {
      console.error('[2FA] TOTP validation error:', totpError)
      // Return 401 for TOTP errors, not 500 - this is an expected failure case
      return NextResponse.json(
        { error: 'Código inválido ou expirado. Tente novamente.' },
        { status: 401 }
      )
    }

    // OTP is valid

    // Handle "Remember Device"
    if (rememberDevice) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

      await prisma.trustedDevice.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          userAgent: request.headers.get('user-agent'),
        }
      })

      // Set cookie
      cookies().set('trusted_device', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      })
    }
    
    // Return success with user info for client-side NextAuth login
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
