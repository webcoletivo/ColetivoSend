import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { exigirAdmin } from '@/lib/admin'
import { logger } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema for reordering
const reorderSchema = z.object({
    items: z.array(z.object({
        id: z.string().max(64),
        order: z.number().int().min(0).max(10_000)
    })).max(500)
})

// POST /api/admin/media/reorder - Bulk update order
export async function POST(req: NextRequest) {
    const auth = await exigirAdmin()
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    try {
        const body = await req.json().catch(() => null)
        const { items } = reorderSchema.parse(body)

        // Update all items in a transaction
        await prisma.$transaction(
            items.map(item =>
                prisma.backgroundMedia.update({
                    where: { id: item.id },
                    data: { order: item.order }
                })
            )
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
        }
        logger.error('[media] erro ao reordenar', error)
        return NextResponse.json({ error: 'Erro ao reordenar mídia' }, { status: 500 })
    }
}
