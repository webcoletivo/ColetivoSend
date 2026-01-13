import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { generatePresignedUploadUrl, isFileTypeAllowed } from '@/lib/storage'
import { GUEST_LIMITS, USER_LIMITS, hashFingerprint, hashIP } from '@/lib/security'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'

import { presignUploadSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const rawBody = await request.json()

    // Zod Validation
    const validationResult = presignUploadSchema.safeParse(rawBody)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten()
      }, { status: 400 })
    }

    const { files, fingerprint } = validationResult.data

    // Determine limits
    const isLoggedIn = !!userId
    const limits = isLoggedIn ? USER_LIMITS : GUEST_LIMITS

    // Validate count
    if (files.length > limits.maxFiles) {
      return NextResponse.json({ error: `Máximo de ${limits.maxFiles} arquivos permitidos` }, { status: 400 })
    }

    // Validate size
    const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0)
    const maxSizeBytes = limits.maxSizeMB * 1024 * 1024
    if (totalSize > maxSizeBytes) {
      return NextResponse.json({ error: `Tamanho total excede ${limits.maxSizeMB}MB` }, { status: 400 })
    }

    // Validate guest limits (usage count)
    if (!isLoggedIn) {
      // Check existing usage if fingerprint provided
      if (fingerprint) {
        const fingerprintHash = hashFingerprint(fingerprint)
        const ipHash = hashIP(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')

        const usage = await prisma.guestUsage.findFirst({
          where: { OR: [{ fingerprintHash }, { ipHash }] }
        })


        if (usage && usage.transfersCreatedCount >= GUEST_LIMITS.maxTransfers) {
          return NextResponse.json({
            error: 'Limite de envios gratuitos atingido',
            limitReached: true
          }, { status: 403 })
        }
      }
    }

    const transferId = uuidv4() // Temporary ID for storage organization

    const presignedUrls = []

    for (const file of files) {
      // Validate type
      if (!isFileTypeAllowed(file.type || '', file.name)) {
        return NextResponse.json({ error: `Tipo de arquivo não permitido: ${file.name}` }, { status: 400 })
      }

      const fileId = uuidv4()
      const { url, storageKey } = await generatePresignedUploadUrl(
        transferId,
        fileId,
        file.name,
        file.type || 'application/octet-stream',
        isLoggedIn ? 900 : 600, // 10-15min request
        userId
      )

      presignedUrls.push({
        fileId,
        originalId: file.id,
        url,
        storageKey,
        name: file.name
      })
    }

    return NextResponse.json({
      transferId,
      presignedUrls,
      expiresIn: isLoggedIn ? 900 : 600
    })

  } catch (error) {
    console.error('Presign error:', error)
    return NextResponse.json({ error: 'Erro ao gerar URLs de upload' }, { status: 500 })
  }
}
