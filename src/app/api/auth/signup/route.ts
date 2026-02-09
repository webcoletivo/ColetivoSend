import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'
import { sendVerificationEmail, sendAccountExistsEmail } from '@/lib/email'
import { checkRateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

const signupSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = await checkRateLimit(`signup:${ip}`, 3, 3600) // 3 signups per hour per IP

    if (!success) {
      return NextResponse.json(
        { error: 'Limite de criação de conta atingido. Tente novamente mais tarde.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = signupSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0].message },
        { status: 400 }
      )
    }
    
    const normalizedEmail = validationResult.data.email.toLowerCase().trim()
    const { name, password } = validationResult.data

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      // To prevent account enumeration, we return a success message even if the user already exists.
      // We also send an email to the existing user to notify them.
      try {
        await sendAccountExistsEmail(normalizedEmail)
      } catch (e) {
        logger.error('Failed to send account exists email', e)
      }
      return NextResponse.json(
        { message: 'Conta criada com sucesso! Verifique seu e-mail.' },
        { status: 201 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
      },
    })

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    })

    // Send verification email
    try {
      logger.info('Sending verification email', { email: normalizedEmail })
      const sent = await sendVerificationEmail(normalizedEmail, token)
      if (sent) {
        logger.info('Verification email sent successfully')
      } else {
        console.error('sendVerificationEmail returned false')
      }
    } catch (error) {
      console.error('Failed to send verification email:', error)
    }

    return NextResponse.json(
      { message: 'Conta criada com sucesso! Verifique seu e-mail.' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
