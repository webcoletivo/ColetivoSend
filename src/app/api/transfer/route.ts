import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generateShareToken, hashPassword, GUEST_LIMITS, USER_LIMITS, hashFingerprint, hashIP } from '@/lib/security'
import { sendTransferEmail } from '@/lib/email'
import { formatBytes } from '@/lib/utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      senderName, 
      recipientEmail, 
      message, 
      files, 
      expirationDays = 7,
      password,
      fingerprint,
    } = body

    // Validate required fields
    if (!senderName || typeof senderName !== 'string' || senderName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nome do remetente é obrigatório' },
        { status: 400 }
      )
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Pelo menos um arquivo é necessário' },
        { status: 400 }
      )
    }

    // Validate email if provided
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: 'E-mail do destinatário inválido' },
        { status: 400 }
      )
    }

    // Get user from session (if logged in)
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null

    // Determine limits based on auth status
    const isLoggedIn = !!userId
    const maxFiles = isLoggedIn ? USER_LIMITS.maxFiles : GUEST_LIMITS.maxFiles
    const maxSizeMB = isLoggedIn ? USER_LIMITS.maxSizeMB : GUEST_LIMITS.maxSizeMB
    const maxSizeBytes = maxSizeMB * 1024 * 1024

    // Validate file count
    if (files.length > maxFiles) {
      return NextResponse.json(
        { error: `Máximo de ${maxFiles} arquivos permitidos` },
        { status: 400 }
      )
    }

    // Calculate total size and validate
    const totalSizeBytes = files.reduce((acc: number, f: any) => acc + (f.size || 0), 0)
    if (totalSizeBytes > maxSizeBytes) {
      return NextResponse.json(
        { error: `Tamanho máximo de ${formatBytes(maxSizeBytes)} excedido` },
        { status: 400 }
      )
    }

    // For guests, check usage limits
    if (!isLoggedIn && fingerprint) {
      const clientIP = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown'
      
      const fingerprintHash = hashFingerprint(fingerprint)
      const ipHash = hashIP(clientIP)

      // Check or create guest usage record
      let guestUsage = await prisma.guestUsage.findUnique({
        where: { fingerprintHash }
      })

      if (!guestUsage) {
        // Try to find by IP as fallback
        const existingByIP = await prisma.guestUsage.findFirst({
          where: { ipHash }
        })
        
        if (existingByIP && existingByIP.transfersCreatedCount >= GUEST_LIMITS.maxTransfers) {
          return NextResponse.json(
            { 
              error: 'Limite de envios gratuitos atingido',
              message: 'Você atingiu o limite de 5 envios gratuitos. Crie uma conta para continuar.',
              limitReached: true
            },
            { status: 403 }
          )
        }

        guestUsage = await prisma.guestUsage.create({
          data: {
            fingerprintHash,
            ipHash,
            transfersCreatedCount: 0,
          }
        })
      }

      if (guestUsage.transfersCreatedCount >= GUEST_LIMITS.maxTransfers) {
        return NextResponse.json(
          { 
            error: 'Limite de envios gratuitos atingido',
            message: 'Você atingiu o limite de 5 envios gratuitos. Crie uma conta para continuar.',
            limitReached: true,
            used: guestUsage.transfersCreatedCount,
            max: GUEST_LIMITS.maxTransfers
          },
          { status: 403 }
        )
      }
    }

    // Validate expiration days for guests
    const validExpirationDays = isLoggedIn 
      ? (USER_LIMITS.expirationOptions.includes(expirationDays) ? expirationDays : 7)
      : GUEST_LIMITS.expirationDays

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + validExpirationDays)

    // Generate unique share token
    let shareToken = generateShareToken()
    let tokenExists = await prisma.transfer.findUnique({ where: { shareToken } })
    while (tokenExists) {
      shareToken = generateShareToken()
      tokenExists = await prisma.transfer.findUnique({ where: { shareToken } })
    }

    // Hash password if provided (only for logged in users)
    let passwordHash = null
    if (isLoggedIn && password && password.length >= 4) {
      passwordHash = await hashPassword(password)
    }

    // Create transfer record
    const transfer = await prisma.transfer.create({
      data: {
        ownerUserId: userId,
        senderName: senderName.trim(),
        recipientEmail: recipientEmail?.trim() || null,
        message: message?.trim() || null,
        shareToken,
        expiresAt,
        passwordHash,
        status: 'active',
        totalSizeBytes,
        files: {
          create: files.map((file: any) => ({
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            storageKey: file.storageKey || `temp/${shareToken}/${file.name}`,
            checksum: file.checksum || null,
          }))
        }
      },
      include: {
        files: true,
      }
    })

    // Update guest usage count if not logged in
    if (!isLoggedIn && fingerprint) {
      const fingerprintHash = hashFingerprint(fingerprint)
      await prisma.guestUsage.update({
        where: { fingerprintHash },
        data: { 
          transfersCreatedCount: { increment: 1 },
          lastSeenAt: new Date()
        }
      })
    }

    // Send email if recipient provided
    if (recipientEmail) {
      await sendTransferEmail(
        recipientEmail,
        senderName,
        shareToken,
        message || undefined,
        files.length,
        formatBytes(totalSizeBytes)
      )
    }

    return NextResponse.json({
      success: true,
      transfer: {
        id: transfer.id,
        shareToken: transfer.shareToken,
        expiresAt: transfer.expiresAt,
        fileCount: transfer.files.length,
        totalSize: totalSizeBytes,
      },
      downloadUrl: `/d/${transfer.shareToken}`,
    })

  } catch (error) {
    console.error('Create transfer error:', error)
    return NextResponse.json(
      { error: 'Erro interno ao criar transfer' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // TODO: Get user from NextAuth session
    const userId = null

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const transfers = await prisma.transfer.findMany({
      where: { ownerUserId: userId },
      include: {
        files: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ transfers })

  } catch (error) {
    console.error('List transfers error:', error)
    return NextResponse.json(
      { error: 'Erro ao listar transfers' },
      { status: 500 }
    )
  }
}
