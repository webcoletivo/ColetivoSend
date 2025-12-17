import nodemailer from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

function createTransporter() {
  // In development, log to console
  if (!process.env.SMTP_HOST) {
    return {
      sendMail: async (options: EmailOptions) => {
        console.log('📧 Email (dev mode):')
        console.log('  To:', options.to)
        console.log('  Subject:', options.subject)
        console.log('  Content:', options.text || options.html)
        return { messageId: 'dev-' + Date.now() }
      }
    }
  }
  
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: parseInt(process.env.SMTP_PORT || '587') === 465, // True for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter()
    
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'ColetivoSend <no-reply@grupocoletivo.com.br>',
      ...options,
    })
    
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendTransferEmail(
  recipientEmail: string,
  senderName: string,
  shareToken: string,
  message?: string,
  fileCount?: number,
  totalSize?: string
): Promise<boolean> {
  const downloadUrl = `${process.env.NEXTAUTH_URL}/d/${shareToken}`
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você recebeu arquivos</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <!-- Logo -->
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b;">
            <span style="color: #6366f1;">Coletivo</span>Send
          </h1>
        </div>
        
        <!-- Card -->
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <h2 style="margin: 0 0 8px 0; font-size: 24px; color: #1e293b; font-weight: 600;">
            Você recebeu arquivos
          </h2>
          <p style="margin: 0 0 24px 0; color: #64748b; font-size: 16px;">
            <strong style="color: #1e293b;">${senderName}</strong> enviou ${fileCount ? `${fileCount} arquivo${fileCount > 1 ? 's' : ''}` : 'arquivos'} para você${totalSize ? ` (${totalSize})` : ''}.
          </p>
          
          ${message ? `
          <div style="background: #f1f5f9; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
            <p style="margin: 0; color: #475569; font-size: 15px; font-style: italic;">
              "${message}"
            </p>
          </div>
          ` : ''}
          
          <!-- Button -->
          <a href="${downloadUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; text-align: center;">
            Baixar arquivos →
          </a>
          
          <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 14px;">
            Ou copie este link: <a href="${downloadUrl}" style="color: #6366f1;">${downloadUrl}</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; margin-top: 32px; color: #94a3b8; font-size: 13px;">
          <p style="margin: 0;">
            Enviado com <span style="color: #f43f5e;">♥</span> via ColetivoSend
          </p>
          <p style="margin: 8px 0 0 0;">
            © ${new Date().getFullYear()} ColetivoSend. Compartilhamento seguro de arquivos.
          </p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `
  
  const text = `
${senderName} enviou arquivos para você via ColetivoSend.

${message ? `Mensagem: "${message}"\n\n` : ''}

Baixe seus arquivos: ${downloadUrl}

---
Enviado via ColetivoSend
  `
  
  return sendEmail({
    to: recipientEmail,
    subject: `${senderName} enviou arquivos para você`,
    html,
    text,
  })
}

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<boolean> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b;">
            <span style="color: #6366f1;">Coletivo</span>Send
          </h1>
        </div>
        
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #1e293b;">
            Verifique seu e-mail
          </h2>
          <p style="margin: 0 0 24px 0; color: #64748b; font-size: 16px;">
            Clique no botão abaixo para verificar seu endereço de e-mail e ativar sua conta.
          </p>
          
          <a href="${verifyUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Verificar e-mail →
          </a>
          
          <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 14px;">
            Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.
          </p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `
  
  return sendEmail({
    to: email,
    subject: 'Verifique seu e-mail - ColetivoSend',
    html,
    text: `Verifique seu e-mail: ${verifyUrl}`,
  })
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<boolean> {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td>
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b;">
            <span style="color: #6366f1;">Coletivo</span>Send
          </h1>
        </div>
        
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
          <h2 style="margin: 0 0 16px 0; font-size: 24px; color: #1e293b;">
            Redefinir senha
          </h2>
          <p style="margin: 0 0 24px 0; color: #64748b; font-size: 16px;">
            Você solicitou a redefinição de senha. Clique no botão abaixo para criar uma nova senha.
          </p>
          
          <a href="${resetUrl}" 
             style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
            Redefinir senha →
          </a>
          
          <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 14px;">
            Este link expira em 1 hora. Se você não solicitou esta alteração, ignore este e-mail.
          </p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `
  
  return sendEmail({
    to: email,
    subject: 'Redefinir senha - ColetivoSend',
    html,
    text: `Redefina sua senha: ${resetUrl}`,
  })
}
