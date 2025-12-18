import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import jwt from 'jsonwebtoken'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
})

const CHALLENGE_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret'
const CHALLENGE_EXPIRY = '5m' // 5 minutes

export async function POST(request: Request) {
  try {
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
      return NextResponse.json(
        { error: 'Conta não encontrada. Crie uma conta para continuar.' },
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
        CHALLENGE_SECRET,
        { expiresIn: CHALLENGE_EXPIRY }
      )

      return NextResponse.json({
        requires2FA: true,
        challengeId: challengeToken,
        email: user.email,
      })
    }

    // No 2FA - return success indicator for direct login
    return NextResponse.json({
      requires2FA: false,
      canLogin: true,
      email: user.email,
    })
  } catch (error) {
    console.error('Login challenge error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
