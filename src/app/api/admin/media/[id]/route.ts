import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { exigirAdmin, urlDePromocaoSchema, verificarMidiaNoArmazenamento } from '@/lib/admin'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for updating media
const updateMediaSchema = z.object({
    title: z.string().max(120).optional(),
    isPromotion: z.boolean().optional(),
    promotionUrl: urlDePromocaoSchema.optional().nullable(),
    duration: z.number().min(1).max(600).optional(),
    isActive: z.boolean().optional()
})

// PATCH /api/admin/media/[id] - Update media
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await exigirAdmin()
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await req.json().catch(() => null)
        const data = updateMediaSchema.parse(body)

        // Validate promotion URL if isPromotion is true
        if (data.isPromotion && !data.promotionUrl) {
            return NextResponse.json(
                { error: 'URL da propaganda é obrigatória' },
                { status: 400 }
            )
        }

        const atual = await prisma.backgroundMedia.findUnique({
            where: { id },
            select: { storageKey: true, mimeType: true, type: true, sizeBytes: true },
        })
        if (!atual) {
            return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 })
        }
        // Ativar = voltar ao loop da home: o objeto tem de estar lá com o tipo
        // (assinatura) e o tamanho aprovados — sempre, não só no primeiro envio.
        if (data.isActive) {
            const veredito = await verificarMidiaNoArmazenamento(atual)
            if (!veredito.ok) {
                return NextResponse.json({ error: veredito.motivo }, { status: 409 })
            }
        }

        const media = await prisma.backgroundMedia.update({
            where: { id },
            data: {
                title: data.title,
                isPromotion: data.isPromotion,
                promotionUrl: data.promotionUrl,
                duration: data.duration,
                isActive: data.isActive
            }
        })

        return NextResponse.json(media)
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
        }
        logger.error('[media] erro ao atualizar', error)
        return NextResponse.json({ error: 'Erro ao atualizar mídia' }, { status: 500 })
    }
}

// DELETE /api/admin/media/[id] - Delete media
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await exigirAdmin()
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        // Get media to delete storage
        const media = await prisma.backgroundMedia.findUnique({
            where: { id }
        })

        if (!media) {
            return NextResponse.json({ error: 'Mídia não encontrada' }, { status: 404 })
        }

        // Delete from storage
        try {
            await deleteFile(media.storageKey)
        } catch (e) {
            logger.error('[media] erro ao apagar do armazenamento', e)
            // Continue with database deletion even if storage fails
        }

        // Delete from database
        await prisma.backgroundMedia.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        logger.error('[media] erro ao excluir', error)
        return NextResponse.json({ error: 'Erro ao excluir mídia' }, { status: 500 })
    }
}
