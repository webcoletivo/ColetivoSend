import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
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

// Schema for updating media
const updateMediaSchema = z.object({
    title: z.string().optional(),
    isPromotion: z.boolean().optional(),
    promotionUrl: z.string().url().optional().nullable(),
    duration: z.number().optional(),
    isActive: z.boolean().optional()
})

// PATCH /api/admin/media/[id] - Update media
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
    if ('error' in auth) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { id } = await params

    try {
        const body = await req.json()
        const data = updateMediaSchema.parse(body)

        // Validate promotion URL if isPromotion is true
        if (data.isPromotion && !data.promotionUrl) {
            return NextResponse.json(
                { error: 'URL da propaganda é obrigatória' },
                { status: 400 }
            )
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
            return NextResponse.json({ error: error.errors }, { status: 400 })
        }
        console.error('Error updating media:', error)
        return NextResponse.json({ error: 'Erro ao atualizar mídia' }, { status: 500 })
    }
}

// DELETE /api/admin/media/[id] - Delete media
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdmin()
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
            console.error('Error deleting from storage:', e)
            // Continue with database deletion even if storage fails
        }

        // Delete from database
        await prisma.backgroundMedia.delete({
            where: { id }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting media:', error)
        return NextResponse.json({ error: 'Erro ao excluir mídia' }, { status: 500 })
    }
}
