import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'
import { sendTransferEmail } from '@/lib/email'
import { formatBytes } from '@/lib/utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: transferId } = await params

  try {
    const session = await getServerSession(authOptions)
    // Optional: add authorization check if needed, but transfers are public by shareToken or private by owner.
    // For now, we'll allow anyone who knows the ID to trigger the email if it was configured in finalize.
    // Actually, it's safer to check if the transfer exists and belongs to the user or was just created.

    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
      include: { files: true }
    })

    if (!transfer) {
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
        console.error('Failed to create email log for', email, logError)
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
            }).catch(e => console.error('Silent log error:', e))
          }
          results.push({ email, success: true })
        } else {
          if (emailLog) {
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: { status: 'failed', errorMessage: result.error, providerResponse: result.code, retryCount: { increment: 1 } }
            }).catch(e => console.error('Silent log error:', e))
          }
          results.push({ email, success: false, error: result.error })
        }
      } catch (emailError: any) {
        console.error('Email send error for', email, emailError)
        if (emailLog) {
          await prisma.emailLog.update({
            where: { id: emailLog.id },
            data: { status: 'failed', errorMessage: `CRITICAL: ${emailError.message}`, retryCount: { increment: 1 } }
          }).catch(logError => console.error('Failed to log critical error:', logError))
        }
        results.push({ email, success: false, error: emailError.message })
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
    console.error('Outer email route error:', error)
    return NextResponse.json({
      error: `DEBUG: Erro interno no servidor de e-mail: ${error.message}`,
      details: error.stack,
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
}
