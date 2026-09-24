import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { verifyPassword, ipDoPedido } from '@/lib/security'
import { generatePresignedDownloadUrl } from '@/lib/storage'
import { checkRateLimit, bloqueadoPorFalhas, registrarFalha } from '@/lib/ratelimit'
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
 * Registra um download (um arquivo ou todos), devolve URLs presignadas novas
 * (15 min) e avisa o dono. Exige a senha quando o link tem senha — com o
 * mesmo freio de força bruta do /unlock.
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

    const corpo = await request.json().catch(() => ({})) as { password?: unknown; fileId?: unknown }
    const password = typeof corpo.password === 'string' ? corpo.password : ''
    const fileId = typeof corpo.fileId === 'string' && corpo.fileId.length <= 64 ? corpo.fileId : undefined
    const ip = ipDoPedido(request)

    // Abuso do contador / das URLs: por IP+token (baixar arquivo a arquivo cabe).
    const rl = await checkRateLimit(
      `download:${ip}:${token}`,
      LIMITES_PUBLICOS.download.limite,
      LIMITES_PUBLICOS.download.janelaSegundos,
    )
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde um momento.' }, { status: 429 })
    }

    const transfer = await prisma.transfer.findUnique({
      where: { shareToken: token },
      include: { files: true }
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
        return NextResponse.json({ error: 'Senha necessária', requiresPassword: true }, { status: 401 })
      }
      // Freio de força bruta: mesma chave do /unlock (IP+token); só erros contam.
      const chaveSenha = `senha-errada:${ip}:${token}`
      if (await bloqueadoPorFalhas(chaveSenha, LIMITES_PUBLICOS.senhaErrada.limite)) {
        return NextResponse.json({ error: 'Muitas tentativas de senha. Aguarde um momento.' }, { status: 429 })
      }
      const isValid = await verifyPassword(password, transfer.passwordHash)
      if (!isValid) {
        await registrarFalha(chaveSenha, LIMITES_PUBLICOS.senhaErrada.janelaSegundos)
        await sleep(ATRASO_SENHA_ERRADA_MS)
        return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
      }
    }

    const arquivos = fileId ? transfer.files.filter(f => f.id === fileId) : transfer.files
    if (fileId && arquivos.length === 0) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    }

    const downloadUrls = await Promise.all(arquivos.map(async (file) => ({
      id: file.id,
      name: file.originalName,
      url: await generatePresignedDownloadUrl(file.storageKey, file.originalName, VALIDADE_URL_DOWNLOAD_SEGUNDOS),
    })))

    await prisma.transfer.update({
      where: { id: transfer.id },
      data: { downloadCount: { increment: 1 } }
    })

    // Notificação unificada ao dono (sino da plataforma) — nunca bloqueia o download.
    // Um aviso por pessoa (IP) e por link a cada hora: quem baixa os arquivos
    // um a um não gera um e-mail por clique.
    const aviso = await checkRateLimit(
      `download-aviso:${ip}:${token}`,
      LIMITES_PUBLICOS.avisoAoDono.limite,
      LIMITES_PUBLICOS.avisoAoDono.janelaSegundos,
    )
    void (async () => {
      if (!aviso.success) return
      const base = process.env.PLATFORM_URL
      const segredo = process.env.NOTIFY_SERVICE_SECRET
      if (!base || !segredo || !transfer.ownerUserId) return
      const dono = await prisma.user.findUnique({
        where: { id: transfer.ownerUserId },
        select: { email: true },
      })
      if (!dono?.email) return
      const quantos = transfer.files.length
      const texto = `Sua transferência de ${quantos} arquivo${quantos === 1 ? '' : 's'} teve um novo download.`
      await fetch(`${base}/api/servico/notificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-servico-segredo': segredo },
        body: JSON.stringify({
          email: dono.email,
          module: 'SEND',
          type: 'transfer_baixada',
          title: 'Seus arquivos foram baixados',
          body: texto,
          url: '/send/dashboard',
        }),
      })
      // E-mail ao dono pelo canal unificado (template da plataforma)
      await fetch(`${base}/api/servico/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-servico-segredo': segredo },
        body: JSON.stringify({
          to: dono.email,
          subject: 'Seus arquivos foram baixados',
          titulo: 'Seus arquivos foram baixados',
          bodyHtml: `<p>${texto}</p>`,
          module: 'SEND',
          refType: 'transfer',
          refId: transfer.id,
          botao: { url: `${base}/send/dashboard`, label: 'Abrir o ColetivoSend' },
        }),
      })
    })().catch(() => {})

    return NextResponse.json({
      success: true,
      downloads: downloadUrls,
    })

  } catch (error) {
    logger.error('[download] erro ao registrar download', error)
    return NextResponse.json({ error: 'Erro ao processar download' }, { status: 500 })
  }
}
