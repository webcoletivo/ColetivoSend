import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

// Check if user is admin
async function requireAdmin() {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
        return { error: 'Não autenticado', status: 401 }
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true }
    })

    if (!user?.isAdmin) {
        return { error: 'Acesso negado', status: 403 }
    }

    return { userId: session.user.id }
}

// Schema for reordering
const reorderSchema = z.object({
    items: z.array(z.object({
        id: z.string(),
        order: z.number()
    }))
})

// POST /api/admin/media/reorder - Bulk update order
export async function POST(req: NextRequest) {
    const auth = await requireAdmin()
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    try {
        const body = await req.json()
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
            return NextResponse.json({ error: error.errors }, { status: 400 })
        }
        console.error('Error reordering media:', error)
        return NextResponse.json({ error: 'Erro ao reordenar mídia' }, { status: 500 })
    }
}
