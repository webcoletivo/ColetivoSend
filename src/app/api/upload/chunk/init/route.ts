import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/db'
import { initializeMultipartUpload } from '@/lib/upload-session'
import { USER_LIMITS, isFileTypeAllowed } from '@/lib/security'
import { initUploadSchema, MAX_FILES_COUNT } from '@/lib/schemas'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id

        // Require authentication
        if (!userId) {
            return NextResponse.json(
                { error: 'Você precisa estar logado para enviar arquivos.' },
                { status: 401 }
            )
        }

        const body = await request.json().catch(() => null)
        const validation = initUploadSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Dados inválidos', details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { transferId, fileId, fileName, fileSize, mimeType } = validation.data

        // Validate file type
        if (!isFileTypeAllowed(mimeType, fileName)) {
            return NextResponse.json(
                { error: `Tipo de arquivo não permitido: ${fileName}` },
                { status: 400 }
            )
        }

        // Validate file size against user limits
        const maxSizeBytes = USER_LIMITS.maxSizeMB * 1024 * 1024
        if (fileSize > maxSizeBytes) {
            return NextResponse.json(
                {
                    error: `Arquivo excede o tamanho máximo de ${USER_LIMITS.maxSizeMB}MB (${(USER_LIMITS.maxSizeMB / 1024).toFixed(0)}GB)`,
                },
                { status: 400 }
            )
        }

        // Limites POR ENVIO, contados no servidor: quantidade de arquivos e
        // bytes somados das sessões deste usuário neste transferId.
        const doEnvio = await prisma.uploadSession.aggregate({
            where: { userId, transferId, status: { not: 'aborted' } },
            _count: { _all: true },
            _sum: { fileSize: true },
        })
        if (doEnvio._count._all >= MAX_FILES_COUNT) {
            return NextResponse.json({ error: `Máximo de ${MAX_FILES_COUNT} arquivos por envio` }, { status: 400 })
        }
        if (Number(doEnvio._sum.fileSize ?? 0) + fileSize > maxSizeBytes) {
            return NextResponse.json({ error: `Tamanho total do envio excede ${USER_LIMITS.maxSizeMB}MB` }, { status: 400 })
        }

        // Initialize multipart upload
        const result = await initializeMultipartUpload(
            userId,
            transferId,
            fileId,
            fileName,
            fileSize,
            mimeType
        )

        return NextResponse.json({
            success: true,
            sessionId: result.sessionId,
            uploadId: result.uploadId,
            storageKey: result.storageKey,
            chunkSize: result.chunkSize,
            totalParts: result.totalParts,
        })
    } catch (error) {
        logger.error('[upload] erro ao iniciar upload', error)
        return NextResponse.json(
            { error: 'Erro ao inicializar upload' },
            { status: 500 }
        )
    }
}
