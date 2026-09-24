import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generatePresignedDownloadUrl, generateSimpleUploadUrl } from '@/lib/storage'
import { TIPOS_DE_MIDIA_ACEITOS } from '@/lib/assinatura-midia'
import { exigirAdmin, urlDePromocaoSchema, TAMANHO_MAXIMO_MIDIA } from '@/lib/admin'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// GET /api/admin/media - List all media
export async function GET() {
  const auth = await exigirAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const media = await prisma.backgroundMedia.findMany({
      orderBy: { order: 'asc' }
    })

    // Generate signed URLs for each media
    const mediaWithUrls = await Promise.all(
      media.map(async (item) => {
        let url = ''
        try {
          url = await generatePresignedDownloadUrl(item.storageKey, item.title || 'media', 3600)
        } catch (e) {
          logger.error('[media] falha ao presignar mídia', e)
        }
        return { ...item, url }
      })
    )

    return NextResponse.json(mediaWithUrls)
  } catch (error) {
    logger.error('[media] erro ao listar', error)
    return NextResponse.json({ error: 'Erro ao buscar mídia' }, { status: 500 })
  }
}

const EXTENSOES_POR_TIPO: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Schema for creating media
const createMediaSchema = z.object({
  title: z.string().max(120).nullable().optional(),
  type: z.enum(['video', 'image']),
  isPromotion: z.boolean().default(false),
  promotionUrl: urlDePromocaoSchema.nullable().optional(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().min(1),
  duration: z.number().min(1).max(600).nullable().optional()
})

/**
 * POST /api/admin/media - Prepara o upload direto ao S3.
 *
 * O registro nasce INATIVO: só entra no loop da home depois de
 * POST /api/admin/media/[id]/confirmar, que confere no próprio objeto o tipo
 * (assinatura) e o tamanho. O PUT presignado já leva Content-Type e
 * Content-Length assinados — o S3 recusa outro tipo ou outro tamanho.
 */
export async function POST(req: NextRequest) {
  const auth = await exigirAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json().catch(() => null)
    const data = createMediaSchema.parse(body)

    // Validate promotion URL if isPromotion is true
    if (data.isPromotion && !data.promotionUrl) {
      return NextResponse.json(
        { error: 'URL da propaganda é obrigatória' },
        { status: 400 }
      )
    }

    const allowedTypes: readonly string[] = TIPOS_DE_MIDIA_ACEITOS[data.type]
    const mimeType = data.mimeType.trim().toLowerCase()
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido. Permitidos: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const maxSize = TAMANHO_MAXIMO_MIDIA[data.type]
    if (data.sizeBytes > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Get next order
    const lastMedia = await prisma.backgroundMedia.findFirst({
      orderBy: { order: 'desc' }
    })
    const nextOrder = (lastMedia?.order ?? -1) + 1

    // Chave gerada no servidor (extensão pelo tipo aceito, nunca pelo nome enviado)
    const ext = EXTENSOES_POR_TIPO[mimeType] ?? 'bin'
    const storageKey = `background-media/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`

    const uploadUrl = await generateSimpleUploadUrl(storageKey, mimeType, data.sizeBytes)

    const media = await prisma.backgroundMedia.create({
      data: {
        title: data.title,
        type: data.type,
        isPromotion: data.isPromotion,
        promotionUrl: data.promotionUrl,
        storageKey,
        mimeType,
        sizeBytes: data.sizeBytes,
        duration: data.duration,
        order: nextOrder,
        isActive: false, // ativa só depois de /confirmar
      }
    })

    return NextResponse.json({
      media,
      uploadUrl
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
    }
    logger.error('[media] erro ao criar', error)
    return NextResponse.json({ error: 'Erro ao criar mídia' }, { status: 500 })
  }
}
