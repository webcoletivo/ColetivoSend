import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPresignedPartUrlForSession } from '@/lib/upload-session'

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
        const { searchParams } = new URL(request.url)
        const partNumber = parseInt(searchParams.get('partNumber') || '1')

        if (isNaN(partNumber) || partNumber < 1) {
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
    } catch (error: any) {
        console.error('Presign chunk error:', error)
        return NextResponse.json(
            { error: error.message || 'Erro ao gerar URL presigned' },
            { status: 500 }
        )
    }
}
