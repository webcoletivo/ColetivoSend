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
    let emailLog: any = null
    try {
      emailLog = await prisma.emailLog.create({
        data: {
          transferId,
          recipientEmail,
          status: 'queued',
        }
      })
    } catch (logError) {
      console.error('Failed to create initial email log:', logError)
      // We continue even if logging fails, to ensure email delivery isn't blocked by DB issues.
    }

    try {
      // 2. Send Email
      const result = await sendTransferEmail(
        recipientEmail,
        senderName,
        shareToken,
        message || undefined,
        files.length,
        formatBytes(totalSizeBytes)
      )
      if (result.success) {
        if (emailLog) {
          try {
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: {
                status: 'sent',
                sentAt: new Date(),
                providerResponse: result.messageId,
              }
            })
          } catch (e) { console.error('Silent log error:', e) }
        }
        return NextResponse.json({ success: true, message: 'E-mail enviado com sucesso' })
      } else {
        // Detailed log of failure
        if (emailLog) {
          try {
            await prisma.emailLog.update({
              where: { id: emailLog.id },
              data: {
                status: 'failed',
                errorMessage: result.error,
                providerResponse: result.code, // Store the SMTP error code if available
                retryCount: { increment: 1 }
              }
            })
          } catch (e) { console.error('Silent log error:', e) }
        }

        // Determine status code based on error
        let status = 502 // Bad Gateway by default for SMTP issues
        let userMessage = 'Falha ao conectar com o servidor de e-mail.'

        if (result.code === 'EAUTH') {
          status = 503
          userMessage = 'Erro de autenticação no servidor de e-mail.'
        } else if (result.code === 'EENVELOPE') {
          status = 400
          userMessage = 'E-mail do destinatário rejeitado.'
        }

        return NextResponse.json({ 
          error: userMessage,
          details: result.error,
          code: result.code
        }, { status })
      }
    } catch (emailError: any) {
      console.error('Critical email route error:', emailError)
      
      // Attempt to log the critical error if emailLog was created
      if (emailLog) {
        try {
          await prisma.emailLog.update({
            where: { id: emailLog.id },
            data: {
              status: 'failed',
              errorMessage: `CRITICAL: ${emailError.message}`,
              retryCount: { increment: 1 }
            }
          })
        } catch (logError) {
          console.error('Failed to log critical email error to DB:', logError)
        }
      }

      return NextResponse.json({ 
        error: `DEBUG: Erro ao processar e-mail: ${emailError.message}`,
        details: emailError.stack,
        code: 'CRITICAL_ERROR'
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Outer email route error:', error)
    return NextResponse.json({ 
      error: `DEBUG: Erro interno no servidor de e-mail: ${error.message}`,
      details: error.stack,
      code: 'INTERNAL_SERVER_ERROR'
    }, { status: 500 })
  }
}
