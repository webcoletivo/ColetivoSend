import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reportPartUploaded, getUploadProgress, exigirDonoDaSessao } from '@/lib/upload-session'
import { respostaDeErroDeUpload } from '@/lib/upload-erros'

export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{
        sessionId: string
    }>
}

export async function POST(request: NextRequest, context: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id

        if (!userId) {
            return NextResponse.json(
                { error: 'Não autorizado' },
                { status: 401 }
            )
        }

        const { sessionId } = await context.params
        await exigirDonoDaSessao(sessionId, userId) // IDOR: sessão é de quem criou
        const body = await request.json().catch(() => ({})) as { partNumber?: unknown; ETag?: unknown; size?: unknown }
        const { partNumber, ETag, size } = body

        if (
            typeof partNumber !== 'number' || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 ||
            typeof ETag !== 'string' || ETag.length === 0 || ETag.length > 256 ||
            typeof size !== 'number' || !Number.isInteger(size) || size < 1
        ) {
            return NextResponse.json(
                { error: 'partNumber, ETag e size são obrigatórios' },
                { status: 400 }
            )
        }

        await reportPartUploaded(sessionId, partNumber, ETag, size)

        // Get updated progress
        const progress = await getUploadProgress(sessionId)

        return NextResponse.json({
            success: true,
            partNumber,
            progress: {
                uploadedParts: progress.uploadedParts,
                totalParts: progress.totalParts,
                uploadedBytes: progress.uploadedBytes,
                totalBytes: progress.fileSize,
                percentage: Math.round((progress.uploadedBytes / progress.fileSize) * 100),
            },
        })
    } catch (error) {
        return respostaDeErroDeUpload('[upload] erro ao registrar parte', error, 'Erro ao registrar chunk', 'REPORT_ERROR')
    }
}
