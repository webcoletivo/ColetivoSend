import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarMidiaPublica } from '@/lib/media-publica'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/media/public - mídia ativa do loop da página inicial.
 * A home é interna (exige sessão), então a lista também: URLs presignadas
 * não ficam ao alcance de quem está fora — e a resposta é privada, não
 * cacheável por proxies.
 */
export async function GET() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    try {
        const midia = await listarMidiaPublica()

        return NextResponse.json(midia, {
            headers: {
                'Cache-Control': 'private, max-age=60',
            }
        })
    } catch (error) {
        logger.error('[media] erro ao listar mídia da home', error)
        return NextResponse.json({ error: 'Erro ao buscar mídia' }, { status: 500 })
    }
}
