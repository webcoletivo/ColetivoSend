import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword, ipDoPedido } from '@/lib/security'
import { generatePresignedDownloadUrl } from '@/lib/storage'
import { bloqueadoPorFalhas, registrarFalha } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'
import { sleep } from '@/lib/utils'
import {
  estadoPublico,
  respostaDeEstado,
  LIMITES_PUBLICOS,
  VALIDADE_URL_DOWNLOAD_SEGUNDOS,
  ATRASO_SENHA_ERRADA_MS,
} from '@/lib/transfer-publico'

export const dynamic = 'force-dynamic'

/**
 * Desbloqueio do link com senha: confere a senha (bcrypt, comparação de tempo
 * constante) e devolve arquivos com URLs presignadas curtas. Respeita
 * expiração/revogação como as demais rotas públicas — antes desta auditoria
 * o /unlock entregava arquivos de link expirado ou revogado.
 */
export async function POST(
  request: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params
  try {
    if (!token || token.length > 64) {
      return respostaDeEstado('notfound')
    }

    const corpo = await request.json().catch(() => ({})) as { password?: unknown }
    const password = typeof corpo.password === 'string' ? corpo.password : ''
    const ip = ipDoPedido(request)

    // Freio de força bruta por IP+token: só senhas ERRADAS contam (quem acertou
    // não é bloqueado); em erro de banco, bloqueia (fail closed).
    const chaveSenha = `senha-errada:${ip}:${token}`
    if (await bloqueadoPorFalhas(chaveSenha, LIMITES_PUBLICOS.senhaErrada.limite)) {
      return NextResponse.json(
        { error: 'Muitas tentativas de senha. Aguarde um momento.' },
        { status: 429 }
      )
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
    if (estado !== 'ok') {
      return respostaDeEstado(estado)
    }

    if (transfer.passwordHash) {
      if (!password) {
        return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })
      }
      const isValid = await verifyPassword(password, transfer.passwordHash)
      if (!isValid) {
        await registrarFalha(chaveSenha, LIMITES_PUBLICOS.senhaErrada.janelaSegundos)
        await sleep(ATRASO_SENHA_ERRADA_MS)
        return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
      }
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
      viewCount: transfer.viewCount,
      downloadCount: transfer.downloadCount,
      files: filesWithUrls,
      hasPassword: false // Unlocked
    })

  } catch (error) {
    logger.error('[transfer] erro ao desbloquear link', error)
    return NextResponse.json({ error: 'Erro ao desbloquear link' }, { status: 500 })
  }
}
