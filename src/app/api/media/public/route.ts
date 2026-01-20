import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generatePresignedDownloadUrl, generatePresignedViewUrl } from '@/lib/storage'

// GET /api/media/public - Get active media for homepage loop (public)
export async function GET() {
    try {
        const media = await prisma.backgroundMedia.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
            select: {
                id: true,
                title: true,
                type: true,
                isPromotion: true,
                promotionUrl: true,
                storageKey: true,
                mimeType: true,
                duration: true
            }
        })

        // Generate signed URLs for each media (cache-friendly expiry)
        const mediaWithUrls = await Promise.all(
            media.map(async (item) => {
                let url = ''
                try {
                    // 6 hour expiry for public URLs, inline for playback
                    url = await generatePresignedViewUrl(item.storageKey, item.mimeType, 6 * 3600)
                } catch (e) {
                    console.error('Error generating URL for public media:', item.id, e)
                    return null // Skip items with URL generation errors
                }

                return {
                    id: item.id,
                    title: item.title,
                    type: item.type,
                    isPromotion: item.isPromotion,
                    promotionUrl: item.promotionUrl,
                    mimeType: item.mimeType,
                    duration: item.duration || (item.type === 'image' ? 6 : null), // Default 6s for images
                    url
                }
            })
        )

        // Filter out null items (failed URL generation)
        const validMedia = mediaWithUrls.filter(Boolean)

        console.log(`[API Public Media] Found ${media.length} items, returning ${validMedia.length} valid items`)

        return NextResponse.json(validMedia, {
            headers: {
                // Cache for 5 minutes
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        })
    } catch (error) {
        console.error('Error fetching public media:', error)
        return NextResponse.json({ error: 'Erro ao buscar mídia' }, { status: 500 })
    }
}
