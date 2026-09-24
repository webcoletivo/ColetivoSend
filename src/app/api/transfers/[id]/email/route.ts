import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendTransferEmail } from '@/lib/email'
import { formatBytes } from '@/lib/utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transferId } = await params

  try {
    // Disparo de e-mail é do DONO, não de quem tem o link: o id interno vaza
    // pela rota pública GET /api/transfer/[token], e sem esta checagem qualquer
    // pessoa com o link reenviava o aviso ao destinatário à vontade (spam).
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Mesmo o dono não precisa reenviar mais que algumas vezes por minuto.
    const rl = await checkRateLimit(`transfer-email:${userId}:${transferId}`, 3, 60)
    if (!rl.success) {
      return NextResponse.json({ error: 'Muitos reenvios. Aguarde um momento.' }, { status: 429 })
    }

    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: { files: true }
    })

    if (!transfer || transfer.ownerUserId !== userId) {
      // 404 também para dono errado: não confirmar a existência do id.
      return NextResponse.json({ error: 'Transferência não encontrada' }, { status: 404 })
    }

    const { recipientEmail, senderName, shareToken, message, totalSizeBytes, files } = transfer

    if (!recipientEmail) {
      return NextResponse.json({ error: 'Destinatário não configurado para esta transferência' }, { status: 400 })
    }

    const recipients = recipientEmail.split(',').map(e => e.trim()).filter(Boolean)
    const fileCount = files.length
    const totalSize = formatBytes(Number(totalSizeBytes))

    const results: { email: string; success: boolean; error?: string }[] = []

    for (const email of recipients) {
      let emailLog: any = null
      try {
        emailLog = await prisma.emailLog.create({
          data: { transferId, recipientEmail: email, status: 'queued' }
        })
      } catch (logError) {
        logger.error('[email] falha ao registrar log de e-mail', logError)
      }

      try {
        const result = await sendTransferEmail(
          email,
          senderName,
          shareToken,
          message || undefined,
          fileCount,
          totalSize
        )

        if (result.success) {
          if (emailLog) {
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: { status: 'sent', sentAt: new Date(), providerResponse: result.messageId }
            }).catch(e => logger.error('[email] falha ao registrar envio', e))
          }
          results.push({ email, success: true })
        } else {
          if (emailLog) {
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: { status: 'failed', errorMessage: result.error, providerResponse: result.code, retryCount: { increment: 1 } }
            }).catch(e => logger.error('[email] falha ao registrar falha', e))
          }
          results.push({ email, success: false, error: result.error })
        }
      } catch (emailError: any) {
        logger.error('[email] falha ao enviar e-mail de envio', emailError)
        if (emailLog) {
          await prisma.emailLog.update({
            where: { id: emailLog.id },
            data: { status: 'failed', errorMessage: `CRITICAL: ${emailError.message}`, retryCount: { increment: 1 } }
          }).catch(logError => logger.error('[email] falha ao registrar erro crítico', logError))
        }
        // Detalhe da exceção fica no log; o cliente recebe uma mensagem genérica.
        results.push({ email, success: false, error: 'Falha ao enviar' })
      }
    }

    const allSucceeded = results.every(r => r.success)
    const anySucceeded = results.some(r => r.success)

    if (allSucceeded) {
      return NextResponse.json({ success: true, message: `E-mail enviado para ${results.length} destinatário(s)`, results })
    }

    if (anySucceeded) {
      return NextResponse.json({ success: true, message: 'E-mail enviado parcialmente', results }, { status: 207 })
    }

    const firstFailure = results.find(r => !r.success)
    return NextResponse.json({
      error: 'Falha ao enviar e-mail para todos os destinatários',
      details: firstFailure?.error,
      results
    }, { status: 502 })

  } catch (error: any) {
    logger.error('[email] erro na rota de reenvio', error)
    // Stack trace fica no log do servidor, nunca na resposta.
    return NextResponse.json({
      error: 'Erro interno no servidor de e-mail',
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
}
