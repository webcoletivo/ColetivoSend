import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword } from '@/lib/security'
import { generatePresignedDownloadUrl } from '@/lib/storage'
import { isExpired } from '@/lib/utils'

// Get transfer info by share token (public)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: params.token },
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
      return NextResponse.json(
        { error: 'Link não encontrado', status: 'notfound' },
        { status: 404 }
      )
    }

    // Check if expired
    if (isExpired(transfer.expiresAt)) {
      // Update status if not already
      if (transfer.status === 'active') {
        await prisma.transfer.update({
          where: { id: transfer.id },
          data: { status: 'expired' }
        })
      }
      return NextResponse.json(
        { error: 'Link expirado', status: 'expired' },
        { status: 410 }
      )
    }

    // Check if revoked
    if (transfer.status === 'revoked') {
      return NextResponse.json(
        { error: 'Este link foi desativado pelo remetente', status: 'revoked' },
        { status: 410 }
      )
    }

    // Check if deleted
    if (transfer.status === 'deleted') {
      return NextResponse.json(
        { error: 'Link não encontrado', status: 'notfound' },
        { status: 404 }
      )
    }

    // Increment view count
    await prisma.transfer.update({
      where: { id: transfer.id },
      data: { viewCount: { increment: 1 } }
    })

    // Return transfer info (without password hash)
    return NextResponse.json({
      id: transfer.id,
      senderName: transfer.senderName,
      message: transfer.message,
      expiresAt: transfer.expiresAt,
      hasPassword: !!transfer.passwordHash,
      files: transfer.files,
      totalSize: transfer.files.reduce((acc, f) => acc + f.sizeBytes, 0),
    })

  } catch (error) {
    console.error('Get download error:', error)
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    )
  }
}

// Verify password and get download URLs
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json()
    const { password, fileId } = body

    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: params.token },
      include: {
        files: true
      }
    })

    if (!transfer) {
      return NextResponse.json(
        { error: 'Link não encontrado' },
        { status: 404 }
      )
    }

    // Check status
    if (transfer.status !== 'active') {
      return NextResponse.json(
        { error: 'Este link não está mais disponível' },
        { status: 410 }
      )
    }

    // Check expiration
    if (isExpired(transfer.expiresAt)) {
      return NextResponse.json(
        { error: 'Link expirado' },
        { status: 410 }
      )
    }

    // Verify password if required
    if (transfer.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: 'Senha necessária', requiresPassword: true },
          { status: 401 }
        )
      }

      const isValid = await verifyPassword(password, transfer.passwordHash)
      if (!isValid) {
        return NextResponse.json(
          { error: 'Senha incorreta' },
          { status: 401 }
        )
      }
    }

    // Generate download URLs
    let downloadUrls

    if (fileId) {
      // Single file download
      const file = transfer.files.find(f => f.id === fileId)
      if (!file) {
        return NextResponse.json(
          { error: 'Arquivo não encontrado' },
          { status: 404 }
        )
      }

      downloadUrls = [{
        id: file.id,
        name: file.originalName,
        url: generatePresignedDownloadUrl(file.storageKey, file.originalName, 300),
      }]
    } else {
      // All files download
      downloadUrls = transfer.files.map(file => ({
        id: file.id,
        name: file.originalName,
        url: generatePresignedDownloadUrl(file.storageKey, file.originalName, 300),
      }))
    }

    // Increment download count
    await prisma.transfer.update({
      where: { id: transfer.id },
      data: { downloadCount: { increment: 1 } }
    })

    return NextResponse.json({
      success: true,
      downloads: downloadUrls,
    })

  } catch (error) {
    console.error('Download request error:', error)
    return NextResponse.json(
      { error: 'Erro ao processar download' },
      { status: 500 }
    )
  }
}
