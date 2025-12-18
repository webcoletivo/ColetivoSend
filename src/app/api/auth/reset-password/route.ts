import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // 1. Find verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'Link inválido ou expirado' },
        { status: 400 }
      )
    }

    // 2. Check expiration
    if (new Date() > verificationToken.expires) {
      await prisma.verificationToken.delete({
        where: { token },
      })
      return NextResponse.json(
        { error: 'Link expirado. Solicite uma nova redefinição.' },
        { status: 400 }
      )
    }

    // 3. Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // 4. Update User
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: {
        passwordHash: passwordHash,
      }
    })

    // 5. Delete token to prevent reuse
    await prisma.verificationToken.delete({
      where: { token },
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Reset Password] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
