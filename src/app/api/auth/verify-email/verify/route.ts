import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token é necessário' }, { status: 400 })
    }

    // Find the token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return NextResponse.json({ error: 'Token inválido ou expirado' }, { status: 400 })
    }

    // Check if expired
    if (new Date() > verificationToken.expires) {
      await prisma.verificationToken.delete({ where: { token } })
      return NextResponse.json({ error: 'Token expirado' }, { status: 400 })
    }

    // Verify user and delete token in a transaction
    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { email: verificationToken.identifier },
          data: { emailVerifiedAt: new Date() },
        }),
        prisma.verificationToken.delete({
          where: { token },
        }),
      ])
      logger.info('Successfully verified email', { email: verificationToken.identifier })
    } catch (dbError) {
      console.error('Database transaction failed during verification:', dbError)
      return NextResponse.json({ error: 'Erro ao atualizar status de verificação' }, { status: 500 })
    }

    return NextResponse.json({ message: 'E-mail verificado com sucesso!' })
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json({ error: 'Erro ao verificar e-mail' }, { status: 500 })
  }
}
