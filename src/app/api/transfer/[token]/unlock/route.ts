import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword } from '@/lib/security'
import { generatePresignedDownloadUrl } from '@/lib/storage'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params;
  try {
    const { password } = await request.json()
    const { token } = params

    if (!token) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
    }

    // Brute-force protection: this endpoint returns files when the password is
    // correct, so it must be rate limited (the in-memory middleware limiter does
    // not cover /unlock and is not shared across serverless instances).
    const ip = (request.headers.get('x-forwarded-for')?.split(',')[0].trim())
      || request.headers.get('x-real-ip')
      || 'unknown'
    const rl = await checkRateLimit(`unlock:${ip}:${token}`, 5, 60)
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas de senha. Aguarde um momento.' },
        { status: 429 }
      )
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
            storageKey: true,
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

    const filesWithUrls = await Promise.all(
      transfer.files.map(async (file) => ({
        ...file,
        downloadUrl: await generatePresignedDownloadUrl(file.storageKey, file.originalName),
        storageKey: undefined,
      }))
    )

    return NextResponse.json({
      id: transfer.id,
      senderName: transfer.senderName,
      message: transfer.message,
      expiresAt: transfer.expiresAt,
      viewCount: transfer.viewCount,
      downloadCount: transfer.downloadCount,
      files: filesWithUrls,
      hasPassword: false // Unlocked
    })

  } catch (error) {
    console.error('Unlock transfer error:', error)
    return NextResponse.json({ error: 'Erro ao desbloquear link' }, { status: 500 })
  }
}
