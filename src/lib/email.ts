export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  code?: string
}

export function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Assunto/preheader: uma linha só (CR/LF injetaria cabeçalhos). */
function umaLinha(v: string): string {
  return v.replace(/[\r\n\t]+/g, ' ').trim()
}

/**
 * Unificação: todo e-mail sai pelo Resend ÚNICO da plataforma (template
 * padrão + email_logs + retry centralizados). Não há mais SMTP local — sem
 * PLATFORM_URL/segredo (ambiente isolado/dev) o e-mail é só registrado no
 * log, sem dados do destinatário.
 */
async function enviarPelaPlataforma(payload: Record<string, unknown>): Promise<EmailResult | null> {
  const base = process.env.PLATFORM_URL
  const segredo = process.env.NOTIFY_SERVICE_SECRET
  if (!base || !segredo) return null
  try {
    const res = await fetch(`${base}/api/servico/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-servico-segredo': segredo },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; logId?: string; error?: string }
    if (res.ok && data.ok) return { success: true, messageId: data.logId }
    return { success: false, error: data.error || `HTTP ${res.status}`, code: 'PLATFORM_MAIL' }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Plataforma inacessível', code: 'PLATFORM_MAIL' }
  }
}

export async function sendTransferEmail(
  recipientEmail: string,
  senderName: string,
  shareToken: string,
  message?: string,
  fileCount?: number,
  totalSize?: string
): Promise<EmailResult> {
  const downloadUrl = `${process.env.NEXTAUTH_URL}/d/${shareToken}`

  // Template padrão da marca via plataforma, com todos os dados de usuário
  // escapados (nome/mensagem entram em e-mail externo).
  const quantos = fileCount
    ? `${fileCount} arquivo${fileCount > 1 ? 's' : ''}`
    : 'arquivos'
  const remetente = umaLinha(senderName)
  const viaPlataforma = await enviarPelaPlataforma({
    to: recipientEmail,
    subject: `${remetente} enviou arquivos para você`,
    titulo: 'Você recebeu arquivos',
    bodyHtml:
      `<p><strong>${escapeHtml(remetente)}</strong> enviou ${quantos} para você${totalSize ? ` (${escapeHtml(totalSize)})` : ''}.</p>` +
      (message
        ? `<p style="background:#1E1B18;border-radius:8px;padding:12px 16px;color:#CFC8C2;font-style:italic;">"${escapeHtml(message)}"</p>`
        : ''),
    botao: { url: downloadUrl, label: 'Baixar arquivos' },
    preheader: `${remetente} compartilhou ${quantos} com você`,
    module: 'SEND',
    template: 'send-transfer',
  })
  if (viaPlataforma) return viaPlataforma

  // Ambiente isolado (sem plataforma): nada é enviado; registro sem PII.
  console.log(`[email] (sem plataforma) e-mail de envio não despachado: ${quantos}`)
  return { success: true, messageId: `dev-${Date.now()}` }
}
