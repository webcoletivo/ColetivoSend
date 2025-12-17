import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function GET(
  request: NextRequest, 
  { params }: { params: { token: string } }
) {
  try {
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

    // Check expiration (Lazy Expire)
    const now = new Date()
    if (new Date(transfer.expiresAt) <= now) {
      // If it's still marked active, update it
      if (transfer.status === 'active') {
        try {
           // Fire and forget update
           await prisma.transfer.update({
             where: { id: transfer.id },
             data: { status: 'expired' }
           })
        } catch (e) {
          console.error('Lazy expire update failed:', e)
        }
      }
  
      return NextResponse.json({ 
        error: 'Este link expirou',
        code: 'EXPIRED',
        expiresAt: transfer.expiresAt
      }, { status: 410 })
    }

    // Check revocation
    if (transfer.status === 'revoked') {
      return NextResponse.json({ 
        error: 'Link desativado', 
        code: 'revoked' 
      }, { status: 410 })
    }

    // If password protected, return limited data only
    if (transfer.passwordHash) {
      return NextResponse.json({
        hasPassword: true,
        id: transfer.id,
        // Don't send files or text yet
      })
    }

    // If public/verified, return full data
    return NextResponse.json({
      id: transfer.id,
      senderName: transfer.senderName,
      message: transfer.message,
      expiresAt: transfer.expiresAt,
      viewCount: transfer.viewCount,
      downloadCount: transfer.downloadCount,
      files: transfer.files,
      hasPassword: false
    })

  } catch (error) {
    console.error('Fetch transfer error:', error)
    return NextResponse.json({ error: 'Erro ao buscar link' }, { status: 500 })
  }
}
