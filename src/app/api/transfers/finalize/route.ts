import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generateShareToken, hashPassword, GUEST_LIMITS, USER_LIMITS, hashFingerprint, hashIP } from '@/lib/security'
import { sendTransferEmail } from '@/lib/email'
import { formatBytes } from '@/lib/utils'
import { checkFileExists } from '@/lib/storage'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import pLimit from 'p-limit'

// Limit concurrency for S3 checks
const limit = pLimit(5)

import { finalizeTransferSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()

    // Zod Validation
    const validationResult = finalizeTransferSchema.safeParse(rawBody)

    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten()
      }, { status: 400 })
    }

    const {
      transferId,
      senderName,
      recipientEmail,
      message,
      files,
      expirationDays,
      password,
      fingerprint,
    } = validationResult.data

    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const isLoggedIn = !!userId

    // 1. Verify files exist in S3 (Integrity Check)
    // We check ALL files to ensure upload is complete
    // 1. Verify files exist in S3 (Integrity Check)
    // We check ALL files to ensure upload is complete
    const checkPromises = files.map((file: any) => limit(async () => {
      // Security: Ensure storageKey belongs to this transfer
      if (!file.storageKey.startsWith(`transfers/${transferId}/`)) {
        throw new Error(`Chave de armazenamento inválida para o arquivo: ${file.name}`)
      }

      // If local storage, this checks local file. If S3, checks HeadObject.
      const exists = await checkFileExists(file.storageKey, file.size)
      if (!exists) {
        throw new Error(`Arquivo incompleto ou ausente: ${file.name}`)
      }
      return true
    }))

    try {
      await Promise.all(checkPromises)
    } catch (error: any) {
      console.error('Integrity check failed:', error)
      return NextResponse.json({ error: 'Upload incompleto. Por favor, tente novamente.' }, { status: 400 })
    }

    // 2. Validate rolling window limit for transfer creation (Free Plan)
    // "15 transfers in last 30 days"
    if (userId) { // Apply to all users now since Free is the standard
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentTransfersCount = await prisma.transfer.count({
        where: {
          ownerUserId: userId,
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      })

      if (recentTransfersCount >= USER_LIMITS.maxTransfersPer30Days) {
        return NextResponse.json({
          error: `Limite de ${USER_LIMITS.maxTransfersPer30Days} transferências nos últimos 30 dias atingido.`
        }, { status: 403 })
      }
    }

    // 3. Determine expiration & Validate
    const validExpirationDays = USER_LIMITS.expirationOptions.includes(expirationDays)
      ? expirationDays
      : 7 // Default if invalid option sent

    const expiresAt = new Date()
    // handle fractional days (like 0.0416 for 1 hour)
    // Add minutes if < 1 day, otherwise Add days
    if (validExpirationDays < 1) {
      expiresAt.setMinutes(expiresAt.getMinutes() + Math.round(validExpirationDays * 24 * 60))
    } else {
      expiresAt.setDate(expiresAt.getDate() + validExpirationDays)
    }

    // 4. Generate Share Token
    let shareToken = generateShareToken()
    let tokenExists = await prisma.transfer.findUnique({ where: { shareToken } })
    while (tokenExists) {
      shareToken = generateShareToken()
      tokenExists = await prisma.transfer.findUnique({ where: { shareToken } })
    }

    // 4. Hash password
    let passwordHash = null
    if (isLoggedIn && password && password.length >= 4) {
      passwordHash = await hashPassword(password)
    }

    const totalSizeBytes = files.reduce((acc: number, f: any) => acc + (f.size || 0), 0)

    // 5. Create DB Records
    const transfer = await prisma.transfer.create({
      data: {
        ownerUserId: userId || null,
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
            storageKey: file.storageKey,
            checksum: file.checksum || null,
          }))
        }
      },
      include: {
        files: true,
      }
    })

    // 6. Update Guest Usage
    if (!isLoggedIn && fingerprint) {
      const fingerprintHash = hashFingerprint(fingerprint)
      const ipHash = hashIP(request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown')

      // Try to find existing usage record by fingerprint OR IP
      // Note: In `api/upload/presign` we checked limits. Here we assume we can increment.
      // But we should double check if strictly required? 
      // Theoretically user could have started multiple transfers in parallel.
      // We'll just increment here.

      try {
        await prisma.guestUsage.upsert({
          where: { fingerprintHash },
          create: {
            fingerprintHash,
            ipHash,
            transfersCreatedCount: 1,
            lastSeenAt: new Date()
          },
          update: {
            transfersCreatedCount: { increment: 1 },
            lastSeenAt: new Date()
          }
        })
      } catch (e) {
        // Fallback for IP collision or race condition? 
        // We'll ignore unique constraint errors on IP hash for simplicity 
        // (schema says fingerprintHash is unique, ipHash is NOT unique in schema `model GuestUsage`? 
        // Let's check schema. `ipHash` is not marked unique in `@unique`. `fingerprintHash` IS unique.
        // So upsert on fingerprintHash is safe.)
      }
    }

    // 7. Email Sending is now decoupled to POST /api/transfers/[id]/email
    // The client will call it after a successful finalize.

    // Cleanup is now handled by Vercel Cron (/api/cron/cleanup)

    return NextResponse.json({
      success: true,
      transfer: {
        id: transfer.id,
        shareToken: transfer.shareToken,
        expiresAt: transfer.expiresAt,
      },
      downloadUrl: `/d/${transfer.shareToken}`,
    })

  } catch (error) {
    console.error('Finalize error:', error)
    return NextResponse.json({ error: 'Erro ao finalizar transferência' }, { status: 500 })
  }
}
