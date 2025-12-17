import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword } from '@/lib/security'

export async function POST(
  request: NextRequest, 
  { params }: { params: { token: string } }
) {
  try {
    const { password } = await request.json()
    const { token } = params

    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: token },
      include: {
        files: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
          }
        }
      }
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    }

    if (transfer.passwordHash) {
      if (!password) {
        return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })
      }

      const isValid = await verifyPassword(password, transfer.passwordHash)
      if (!isValid) {
        return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
      }
    }

    return NextResponse.json({
      id: transfer.id,
      senderName: transfer.senderName,
      message: transfer.message,
      expiresAt: transfer.expiresAt,
      viewCount: transfer.viewCount,
      downloadCount: transfer.downloadCount,
      files: transfer.files,
      hasPassword: false // Unlocked
    })

  } catch (error) {
    console.error('Unlock transfer error:', error)
    return NextResponse.json({ error: 'Erro ao desbloquear link' }, { status: 500 })
  }
}
