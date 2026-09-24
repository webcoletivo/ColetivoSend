import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generatePresignedDownloadUrl, deleteMultipleFiles } from '@/lib/storage'
import { checkRateLimit } from '@/lib/ratelimit'
import { ipDoPedido } from '@/lib/security'
import { logger } from '@/lib/logger'
import {
  estadoPublico,
  respostaDeEstado,
  LIMITES_PUBLICOS,
  VALIDADE_URL_DOWNLOAD_SEGUNDOS,
} from '@/lib/transfer-publico'

export const dynamic = 'force-dynamic'

/**
 * Metadados do link público (/d/<token>). Sem senha, já devolve as URLs
 * presignadas (15 min); com senha, só diz que há senha — arquivos e mensagem
 * ficam para o /unlock. Nunca expõe o id interno, o dono ou o destinatário.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params
  try {
    if (!token || token.length > 64) {
      return respostaDeEstado('notfound')
    }

    // Varredura de tokens / inflar o contador de views: limite por IP no banco
    // (compartilhado entre instâncias — o do middleware é por processo).
    const rl = await checkRateLimit(
      `publico:${ipDoPedido(request)}`,
      LIMITES_PUBLICOS.metadados.limite,
      LIMITES_PUBLICOS.metadados.janelaSegundos,
    )
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitos pedidos. Aguarde um momento.' }, { status: 429 })
    }

    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: token },
      include: {
        files: {
          select: {
            id: true,
            originalName: true,
            sizeBytes: true,
            mimeType: true,
            storageKey: true,
          }
        }
      }
    })

    if (!transfer) {
      return respostaDeEstado('notfound')
    }

    const estado = estadoPublico(transfer)
    if (estado === 'expired') {
      // Expiração preguiçosa: apaga os objetos na hora (o cron é a rede de segurança).
      if (transfer.status === 'active' || transfer.cleanupStatus !== 'done') {
        try {
          const storageKeys = transfer.files.map(f => f.storageKey)
          const apagou = storageKeys.length === 0 || await deleteMultipleFiles(storageKeys)
          await prisma.transfer.update({
            where: { id: transfer.id },
            data: { status: 'expired', cleanupStatus: apagou ? 'done' : 'failed' }
          })
          if (apagou) {
            await prisma.file.updateMany({
              where: { transferId: transfer.id },
              data: { deletedAt: new Date() }
            })
          }
        } catch (e) {
          logger.error('[transfer] expiração preguiçosa falhou', e)
        }
      }
      return respostaDeEstado('expired')
    }
    if (estado !== 'ok') {
      return respostaDeEstado(estado)
    }

    // Views: a página pública (/d/[token]) só passa por aqui — sem isto o
    // contador do painel do dono nunca sai do zero.
    const { viewCount } = await prisma.transfer.update({
      where: { id: transfer.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    })

    // Com senha: nada além do fato de haver senha.
    if (transfer.passwordHash) {
      return NextResponse.json({ hasPassword: true })
    }

    const filesWithUrls = await Promise.all(
      transfer.files.map(async (file) => ({
        id: file.id,
        originalName: file.originalName,
        sizeBytes: file.sizeBytes,
        mimeType: file.mimeType,
        downloadUrl: await generatePresignedDownloadUrl(file.storageKey, file.originalName, VALIDADE_URL_DOWNLOAD_SEGUNDOS),
      }))
    )

    return NextResponse.json({
      senderName: transfer.senderName,
      message: transfer.message,
      expiresAt: transfer.expiresAt,
      viewCount,
      downloadCount: transfer.downloadCount,
      files: filesWithUrls,
      hasPassword: false
    })

  } catch (error) {
    logger.error('[transfer] erro ao buscar link público', error)
    return NextResponse.json({ error: 'Erro ao buscar link' }, { status: 500 })
  }
}
