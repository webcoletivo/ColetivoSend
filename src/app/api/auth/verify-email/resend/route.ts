import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()
    const normalizedEmail = email?.toLowerCase().trim()
    const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'E-mail é necessário' }, { status: 400 })
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailVerifiedAt: true }
    })

    if (!user) {
      // For security, don't reveal if user exists or not
      return NextResponse.json({ message: 'Se este e-mail estiver cadastrado, você receberá um novo link.' })
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ error: 'Este e-mail já está verificado' }, { status: 400 })
    }

    // Rate limit check (optional but recommended) - here we just delete old tokens for this identifier
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail },
    })

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        expires,
      },
    })

    // Send email
    try {
      console.log(`Resending verification email to ${normalizedEmail} with origin ${origin}`)
      const sent = await sendVerificationEmail(normalizedEmail, token, origin || undefined)
      if (sent) {
        console.log('Resend email sent successfully')
      } else {
        console.error('sendVerificationEmail returned false during resend')
      }
    } catch (error) {
      console.error('Failed to resend verification email:', error)
      return NextResponse.json({ error: 'Erro ao enviar e-mail. Tente novamente mais tarde.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Novo link enviado com sucesso!' })
  } catch (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'Erro ao processar solicitação' }, { status: 500 })
  }
}
