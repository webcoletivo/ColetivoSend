import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { generateShareToken, hashPassword, USER_LIMITS } from '@/lib/security'
import { checkFileExists } from '@/lib/storage'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { nomeDeExibicao } from '@/lib/plataforma'
import { prefixoDoDono } from '@/lib/upload-session'
import { logger } from '@/lib/logger'
import { finalizeTransferSchema } from '@/lib/schemas'

export const dynamic = 'force-dynamic'

/** Executa `tarefa` sobre cada item com no máximo `limite` em paralelo. */
async function emLotes<T>(itens: T[], limite: number, tarefa: (item: T) => Promise<void>): Promise<void> {
  let proximo = 0
  const trabalhadores = Array.from({ length: Math.min(limite, itens.length) }, async () => {
    while (proximo < itens.length) {
      const item = itens[proximo++]
      await tarefa(item)
    }
  })
  await Promise.all(trabalhadores)
}

export async function POST(request: NextRequest) {
  try {
    // Só usuário da plataforma cria envio (não existe mais convidado).
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rawBody = await request.json().catch(() => null)
    const validationResult = finalizeTransferSchema.safeParse(rawBody)
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Dados inválidos',
        details: validationResult.error.flatten()
      }, { status: 400 })
    }

    const {
      transferId,
      senderName,
      recipientEmail,
      message,
      files,
      expirationDays,
      password,
    } = validationResult.data

    // 1. Posse: cada arquivo tem de ser um upload CONCLUÍDO deste usuário,
    //    neste envio, com o mesmo tamanho declarado — a chave vem do servidor
    //    (prefixo do dono), nunca do cliente. Sem isto, um envio podia apontar
    //    para objetos de outra pessoa no bucket.
    const sessoes = await prisma.uploadSession.findMany({
      where: { userId, transferId },
      select: { storageKey: true, fileSize: true, status: true },
    })
    const pendentes = sessoes.filter(s => s.status !== 'completed' && s.status !== 'aborted')
    if (pendentes.length > 0) {
      return NextResponse.json(
        { error: 'Alguns arquivos ainda não foram completamente enviados' },
        { status: 400 }
      )
    }
    const concluidas = new Map(sessoes.filter(s => s.status === 'completed').map(s => [s.storageKey, Number(s.fileSize)]))
    const prefixo = prefixoDoDono(userId, transferId)
    const chaves = new Set<string>()
    for (const file of files) {
      const tamanhoDaSessao = concluidas.get(file.storageKey)
      if (!file.storageKey.startsWith(prefixo) || tamanhoDaSessao === undefined || tamanhoDaSessao !== file.size || chaves.has(file.storageKey)) {
        return NextResponse.json({ error: 'Upload incompleto. Por favor, tente novamente.' }, { status: 400 })
      }
      chaves.add(file.storageKey)
    }

    // 2. Limites por envio (o init de cada arquivo já limitou o arquivo).
    const totalSizeBytes = files.reduce((acc, f) => acc + f.size, 0)
    const maxSizeBytes = USER_LIMITS.maxSizeMB * 1024 * 1024
    if (totalSizeBytes > maxSizeBytes) {
      return NextResponse.json({ error: `Tamanho total excede ${USER_LIMITS.maxSizeMB}MB` }, { status: 400 })
    }

    // 3. O objeto existe no armazenamento com o tamanho declarado (HEAD).
    let integro = true
    await emLotes(files, 5, async (file) => {
      if (!integro) return
      if (!(await checkFileExists(file.storageKey, file.size))) integro = false
    })
    if (!integro) {
      return NextResponse.json({ error: 'Upload incompleto. Por favor, tente novamente.' }, { status: 400 })
    }

    // 4. Janela de 30 dias por usuário
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const recentTransfersCount = await prisma.transfer.count({
      where: { ownerUserId: userId, createdAt: { gte: thirtyDaysAgo } }
    })
    if (recentTransfersCount >= USER_LIMITS.maxTransfersPer30Days) {
      return NextResponse.json({
        error: `Limite de ${USER_LIMITS.maxTransfersPer30Days} transferências nos últimos 30 dias atingido.`
      }, { status: 403 })
    }

    // 5. Expiração (opções fixas; fração de dia = horas)
    const validExpirationDays = USER_LIMITS.expirationOptions.includes(expirationDays)
      ? expirationDays
      : 7
    const expiresAt = new Date()
    if (validExpirationDays < 1) {
      expiresAt.setMinutes(expiresAt.getMinutes() + Math.round(validExpirationDays * 24 * 60))
    } else {
      expiresAt.setDate(expiresAt.getDate() + validExpirationDays)
    }

    // 6. Token público (≥128 bits) — colisão é astronomicamente improvável, mas confere
    let shareToken = generateShareToken()
    while (await prisma.transfer.findUnique({ where: { shareToken }, select: { id: true } })) {
      shareToken = generateShareToken()
    }

    // 7. Senha opcional (bcrypt)
    const passwordHash = password && password.length >= 4 ? await hashPassword(password) : null

    // Remetente = nome da plataforma (o cliente manda um palpite; quem manda
    // é o verify, com a cópia local como reserva). Aparece na página pública,
    // no e-mail e no painel.
    const nomeRemetente = (await nomeDeExibicao(userId, request.headers.get('cookie'), senderName.trim())).slice(0, 100)

    // 8. Registros
    const transfer = await prisma.transfer.create({
      data: {
        ownerUserId: userId,
        senderName: nomeRemetente,
        recipientEmail: recipientEmail?.trim() || null,
        message: message?.trim() || null,
        shareToken,
        expiresAt,
        passwordHash,
        status: 'active',
        totalSizeBytes,
        files: {
          create: files.map((file) => ({
            originalName: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
            storageKey: file.storageKey,
            checksum: file.checksum || null,
          }))
        }
      },
      select: { id: true, shareToken: true, expiresAt: true },
    })

    // E-mail ao destinatário é disparado pelo cliente em POST /api/transfers/[id]/email.
    // Limpeza dos arquivos expirados: cron (/api/cron/cleanup) + expiração preguiçosa.

    return NextResponse.json({
      success: true,
      transfer: {
        id: transfer.id,
        shareToken: transfer.shareToken,
        expiresAt: transfer.expiresAt,
      },
      downloadUrl: `/d/${transfer.shareToken}`,
    })

  } catch (error) {
    logger.error('[finalize] erro ao finalizar transferência', error)
    return NextResponse.json({ error: 'Erro ao finalizar transferência' }, { status: 500 })
  }
}
