import { prisma } from '@/lib/db'
import { generatePresignedViewUrl } from '@/lib/storage'

/**
 * Mídia de fundo da página inicial (vídeos/imagens ativos, em ordem), já com
 * URL presignada para reprodução inline.
 *
 * Usada em dois lugares: pela rota pública /api/media/public e pela própria
 * página inicial (server component). Renderizar a lista no servidor põe o
 * primeiro <video>/<img> direto no HTML — o navegador começa a baixar a mídia
 * antes da hidratação, sem esperar o fetch do cliente.
 */
export interface MidiaPublica {
    id: string
    title: string | null
    type: 'video' | 'image'
    isPromotion: boolean
    promotionUrl: string | null
    mimeType: string
    duration: number | null
    url: string
}

const VALIDADE_URL_SEGUNDOS = 6 * 3600

export async function listarMidiaPublica(): Promise<MidiaPublica[]> {
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
            duration: true,
        },
    })

    const comUrl = await Promise.all(
        media.map(async (item): Promise<MidiaPublica | null> => {
            try {
                const url = await generatePresignedViewUrl(item.storageKey, item.mimeType, VALIDADE_URL_SEGUNDOS)
                return {
                    id: item.id,
                    title: item.title,
                    type: item.type === 'video' ? 'video' : 'image',
                    isPromotion: item.isPromotion,
                    promotionUrl: item.promotionUrl,
                    mimeType: item.mimeType,
                    // imagens sem duração ficam 6 s na tela
                    duration: item.duration || (item.type === 'image' ? 6 : null),
                    url,
                }
            } catch (e) {
                console.error('[media] falha ao presignar mídia pública', item.id, e)
                return null
            }
        }),
    )

    return comUrl.filter((m): m is MidiaPublica => m !== null)
}
