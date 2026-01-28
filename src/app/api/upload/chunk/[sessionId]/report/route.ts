import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reportPartUploaded, getUploadProgress } from '@/lib/upload-session'

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
        const body = await request.json()
        const { partNumber, ETag, size } = body

        if (!partNumber || !ETag || !size) {
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
    } catch (error: any) {
        console.error('Report chunk error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao registrar chunk' },
            { status: 500 }
        )
    }
}
