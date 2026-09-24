import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/** Paginação: inteiro dentro de [min, max]; qualquer outra coisa vira o padrão. */
function inteiroEntre(bruto: string | null, padrao: number, min: number, max: number): number {
  const n = Number.parseInt(bruto ?? '', 10)
  if (!Number.isFinite(n)) return padrao
  return Math.min(max, Math.max(min, n))
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = inteiroEntre(searchParams.get('page'), 1, 1, 100_000)
    const limit = inteiroEntre(searchParams.get('limit'), 10, 1, 100)
    const skip = (page - 1) * limit

    const userId = session.user.id
    const now = new Date()

    // Fetch transfers with file count aggregation
    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where: { ownerUserId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          senderName: true,
          recipientEmail: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          shareToken: true,
          viewCount: true,
          downloadCount: true,
          totalSizeBytes: true,
          _count: {
            select: { files: true }
          }
        }
      }),
      prisma.transfer.count({
        where: { ownerUserId: userId }
      })
    ])

    // Process transfers to determine real status based on expiration
    const processedTransfers = transfers.map(t => {
      let status = t.status
      // If active but expired, show as expired
      if (status === 'active' && new Date(t.expiresAt) <= now) {
        status = 'expired'
      }

      return {
        id: t.id,
        senderName: t.senderName,
        recipientEmail: t.recipientEmail,
        status,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        shareToken: t.shareToken,
        viewCount: t.viewCount,
        downloadCount: t.downloadCount,
        totalSizeBytes: t.totalSizeBytes,
        fileCount: t._count.files
      }
    })

    return NextResponse.json({
      transfers: processedTransfers,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit
      }
    })
  } catch (error) {
    logger.error('[transfers] erro ao listar envios', error)
    return NextResponse.json({ error: 'Erro ao buscar envios' }, { status: 500 })
  }
}
