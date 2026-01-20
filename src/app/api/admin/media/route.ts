import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generatePresignedUploadUrl, generatePresignedDownloadUrl, generateSimpleUploadUrl } from '@/lib/storage'
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

// GET /api/admin/media - List all media
export async function GET() {
  const auth = await requireAdmin()
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
          console.error('Error generating URL for media:', item.id, e)
        }
        return { ...item, url }
      })
    )

    return NextResponse.json(mediaWithUrls)
  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json({ error: 'Erro ao buscar mídia' }, { status: 500 })
  }
}

// Schema for creating media
const createMediaSchema = z.object({
  title: z.string().nullable().optional(),
  type: z.enum(['video', 'image']),
  isPromotion: z.boolean().default(false),
  promotionUrl: z.string().url().nullable().optional(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  duration: z.number().nullable().optional()
})

// POST /api/admin/media - Create new media with presigned upload URL
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await req.json()
    const data = createMediaSchema.parse(body)

    // Validate promotion URL if isPromotion is true
    if (data.isPromotion && !data.promotionUrl) {
      console.error('Validation error: Promotion URL missing')
      return NextResponse.json(
        { error: 'URL da propaganda é obrigatória' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo']
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    const allowedTypes = data.type === 'video' ? allowedVideoTypes : allowedImageTypes
    const allowedTypesForChecking = data.type === 'video' ? [...allowedVideoTypes, 'video/quicktime'] : allowedImageTypes

    // Temporary Allow .mov for checking but maybe fail if strict
    // Just logging for now
    console.log('Received file type:', data.mimeType)

    if (!allowedTypes.includes(data.mimeType)) {
      console.error(`Validation error: Invalid mime type ${data.mimeType}`)
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido. Permitidos: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Max file size: 100MB for video, 10MB for image
    const maxSize = data.type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (data.sizeBytes > maxSize) {
      console.error(`Validation error: File too large ${data.sizeBytes} > ${maxSize}`)
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

    // Generate storage key
    const ext = data.fileName.split('.').pop() || ''
    const storageKey = `background-media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    // Generate presigned upload URL
    const uploadUrl = await generateSimpleUploadUrl(storageKey, data.mimeType)

    // Create media record
    const media = await prisma.backgroundMedia.create({
      data: {
        title: data.title,
        type: data.type,
        isPromotion: data.isPromotion,
        promotionUrl: data.promotionUrl,
        storageKey,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        duration: data.duration,
        order: nextOrder,
        isActive: true
      }
    })

    return NextResponse.json({
      media,
      uploadUrl
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', JSON.stringify(error.errors, null, 2))
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Error creating media:', error)
    return NextResponse.json({ error: 'Erro ao criar mídia' }, { status: 500 })
  }
}
