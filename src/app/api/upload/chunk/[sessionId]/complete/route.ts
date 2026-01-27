import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { completeMultipartUpload } from '@/lib/upload-session'

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

        // Complete multipart upload
        const result = await completeMultipartUpload(sessionId)

        return NextResponse.json({
            success: true,
            storageKey: result.storageKey,
            size: result.size,
            message: 'Upload concluído com sucesso',
        })
    } catch (error: any) {
        console.error('Complete upload error:', error)

        if (error.message.includes('not found')) {
            return NextResponse.json(
                { error: 'Sessão de upload não encontrada', code: 'SESSION_NOT_FOUND' },
                { status: 404 }
            )
        }

        if (error.message.includes('Incomplete upload')) {
            return NextResponse.json(
                { error: error.message, code: 'INCOMPLETE_UPLOAD' },
                { status: 400 }
            )
        }

        return NextResponse.json(
            { error: error.message || 'Erro ao finalizar upload', code: 'COMPLETE_ERROR' },
            { status: 500 }
        )
    }
}
