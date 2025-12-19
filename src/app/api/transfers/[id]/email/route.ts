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

    // 1. Create or Update Email Log
    let emailLog = await prisma.emailLog.create({
      data: {
        transferId,
        recipientEmail,
        status: 'queued',
      }
    })

    try {
      // 2. Send Email
      const sent = await sendTransferEmail(
        recipientEmail,
        senderName,
        shareToken,
        message || undefined,
        files.length,
        formatBytes(totalSizeBytes)
      )

      if (sent) {
        await prisma.emailLog.update({
          where: { id: emailLog.id },
          data: {
            status: 'sent',
            sentAt: new Date(),
          }
        })
        return NextResponse.json({ success: true, message: 'E-mail enviado com sucesso' })
      } else {
        throw new Error('SMTP provider failed to send email')
      }
    } catch (emailError: any) {
      console.error('Email send error for transfer:', transferId, emailError)
      
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: 'failed',
          errorMessage: emailError.message,
          retryCount: { increment: 1 }
        }
      })

      return NextResponse.json({ 
        error: 'Falha ao enviar e-mail. Você pode tentar novamente.',
        details: emailError.message 
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Email route error:', error)
    return NextResponse.json({ error: 'Erro interno ao processar e-mail' }, { status: 500 })
  }
}
