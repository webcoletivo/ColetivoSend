import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { exigirAdmin, verificarMidiaNoArmazenamento } from '@/lib/admin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/media/[id]/confirmar — depois do PUT direto ao S3.
 *
 * Confere no próprio objeto o tipo (assinatura) e o tamanho aprovados no
 * POST. Confere → a mídia fica ativa. Não confere (ou não chegou) → o
 * registro e o objeto são apagados e a resposta diz por quê.
 */
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await exigirAdmin()
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const media = await prisma.backgroundMedia.findUnique({ where: { id } })
        if (!media) {
            return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 })
        }

        const veredito = await verificarMidiaNoArmazenamento(media)
        if (!veredito.ok) {
            await deleteFile(media.storageKey).catch(() => false)
            await prisma.backgroundMedia.delete({ where: { id } }).catch(() => null)
            logger.warn('[media] upload rejeitado na confirmação', { motivo: veredito.motivo })
            return NextResponse.json({ error: veredito.motivo }, { status: 400 })
        }

        const ativa = await prisma.backgroundMedia.update({
            where: { id },
            data: { isActive: true },
        })
        return NextResponse.json(ativa)
    } catch (error) {
        logger.error('[media] erro ao confirmar', error)
        return NextResponse.json({ error: 'Erro ao confirmar mídia' }, { status: 500 })
    }
}
