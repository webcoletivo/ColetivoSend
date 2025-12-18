import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'E-mail inválido' },
        { status: 400 }
      )
    }

    // 1. Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // 2. If user exists, generate token and send email
    // We don't reveal if user exists or not, so we just return success at the end
    if (user) {
      // Check if user has password (might be OAuth only)
      // Even if OAuth only, maybe we should allow setting a password?
      // For now, let's assume we proceed.
      
      // 3. Generate secure token
      const token = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // 4. Store token in VerificationToken table
      // We use 'reset-password' prefix or just the email as identifier?
      // Since VerificationToken usually stores 'email' for email verification,
      // let's stick to using the email as identifier. 
      // The token uniqueness ensures we find the right record.
      
      // Clean up old tokens for this user/identifier to avoid clutter/collisions
      // (Optional but good practice)
      await prisma.verificationToken.deleteMany({
        where: { identifier: email }
      })

      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        }
      })

      // 5. Send Email
      const sent = await sendPasswordResetEmail(email, token)
      
      if (!sent) {
        console.error(`[Forgot Password] Failed to send email to ${email}`)
        // Should we fail the request? 
        // If we fail, we might reveal user existence if we don't fail for non-users.
        // But internal error 500 is generic enough.
        return NextResponse.json(
          { error: 'Erro ao enviar e-mail' },
          { status: 500 }
        )
      }
      
      console.log(`[Forgot Password] Reset link sent to ${email}`)
    } else {
      console.log(`[Forgot Password] Request for non-existent email: ${email}`)
      // Mimic delay of real operation to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Forgot Password] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
