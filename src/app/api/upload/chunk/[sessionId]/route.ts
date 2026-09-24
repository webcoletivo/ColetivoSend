import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadChunk, getUploadProgress, listUploadedParts, abortMultipartUpload, exigirDonoDaSessao } from '@/lib/upload-session'
import { respostaDeErroDeUpload } from '@/lib/upload-erros'

// Configure route to accept larger payloads (chunks up to 10MB)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for slow uploads

interface RouteParams {
    params: Promise<{
        sessionId: string
    }>
}

/**
 * PUT - Upload a chunk
 */
export async function PUT(request: NextRequest, context: RouteParams) {
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
        const partNumberHeader = request.headers.get('x-part-number')

        if (!partNumberHeader) {
            return NextResponse.json(
                { error: 'Part number é obrigatório (header x-part-number)' },
                { status: 400 }
            )
        }

        const partNumber = parseInt(partNumberHeader)

        if (isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
            return NextResponse.json(
                { error: 'Part number inválido' },
                { status: 400 }
            )
        }

        // Read chunk from request body
        const arrayBuffer = await request.arrayBuffer()
        const chunk = Buffer.from(arrayBuffer)

        if (chunk.length === 0) {
            return NextResponse.json(
                { error: 'Chunk vazio' },
                { status: 400 }
            )
        }

        // Upload chunk
        const result = await uploadChunk(sessionId, partNumber, chunk)

        // Get updated progress
        const progress = await getUploadProgress(sessionId)

        return NextResponse.json({
            success: true,
            partNumber: result.partNumber,
            ETag: result.ETag,
            size: result.size,
            progress: {
                uploadedParts: progress.uploadedParts,
                totalParts: progress.totalParts,
                uploadedBytes: progress.uploadedBytes,
                totalBytes: progress.fileSize,
                percentage: Math.round((progress.uploadedBytes / progress.fileSize) * 100),
            },
        })
    } catch (error) {
        return respostaDeErroDeUpload('[upload] erro ao enviar parte', error, 'Erro ao enviar chunk', 'UPLOAD_ERROR')
    }
}

/**
 * GET - Get upload status (for resume)
 */
export async function GET(request: NextRequest, context: RouteParams) {
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

        // Get progress
        const progress = await getUploadProgress(sessionId)

        // Get list of uploaded parts
        const uploadedPartNumbers = await listUploadedParts(sessionId)

        return NextResponse.json({
            success: true,
            sessionId: progress.sessionId,
            fileName: progress.fileName,
            fileSize: progress.fileSize,
            uploadedParts: progress.uploadedParts,
            totalParts: progress.totalParts,
            uploadedBytes: progress.uploadedBytes,
            percentage: Math.round((progress.uploadedBytes / progress.fileSize) * 100),
            status: progress.status,
            uploadedPartNumbers,
        })
    } catch (error) {
        return respostaDeErroDeUpload('[upload] erro ao obter status', error, 'Erro ao obter status do upload', 'STATUS_ERROR')
    }
}

/**
 * DELETE - Abort upload
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
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
        await exigirDonoDaSessao(sessionId, userId) // IDOR: só o dono aborta

        await abortMultipartUpload(sessionId)

        return NextResponse.json({
            success: true,
            message: 'Upload cancelado',
        })
    } catch (error) {
        return respostaDeErroDeUpload('[upload] erro ao cancelar upload', error, 'Erro ao cancelar upload', 'ABORT_ERROR')
    }
}
