import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPresignedPartUrlForSession, exigirDonoDaSessao } from '@/lib/upload-session'
import { respostaDeErroDeUpload } from '@/lib/upload-erros'

export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{
        sessionId: string
    }>
}

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
        const { searchParams } = new URL(request.url)
        const partNumber = parseInt(searchParams.get('partNumber') || '1')

        if (isNaN(partNumber) || partNumber < 1 || partNumber > 10000) {
            return NextResponse.json(
                { error: 'Part number inválido' },
                { status: 400 }
            )
        }

        const result = await getPresignedPartUrlForSession(sessionId, partNumber)

        return NextResponse.json({
            success: true,
            url: result.url,
            storageType: result.storageType,
            partNumber,
        })
    } catch (error) {
        return respostaDeErroDeUpload('[upload] erro ao presignar parte', error, 'Erro ao gerar URL presigned', 'PRESIGN_ERROR')
    }
}
