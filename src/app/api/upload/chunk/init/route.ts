import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { initializeMultipartUpload } from '@/lib/upload-session'
import { USER_LIMITS, isFileTypeAllowed } from '@/lib/security'
import { z } from 'zod'

const initUploadSchema = z.object({
    transferId: z.string().min(1),
    fileId: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().min(1).max(10 * 1024 * 1024 * 1024), // 10GB max
    mimeType: z.string(),
})

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

        const body = await request.json()
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
    } catch (error: any) {
        console.error('Init upload error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao inicializar upload' },
            { status: 500 }
        )
    }
}
