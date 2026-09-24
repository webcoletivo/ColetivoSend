import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { completeMultipartUpload, exigirDonoDaSessao } from '@/lib/upload-session'
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

        // Complete multipart upload
        const result = await completeMultipartUpload(sessionId)

        return NextResponse.json({
            success: true,
            storageKey: result.storageKey,
            size: result.size,
            message: 'Upload concluído com sucesso',
        })
    } catch (error) {
        return respostaDeErroDeUpload('[upload] erro ao concluir upload', error, 'Erro ao finalizar upload', 'COMPLETE_ERROR')
    }
}
