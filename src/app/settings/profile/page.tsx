import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Unificação por abas: dados da pessoa ficam em "Sua conta", na plataforma.
 * URL absoluta de propósito — um caminho relativo receberia o basePath.
 */
export default async function ProfileSettingsPage() {
  const h = await headers()
  const host = h.get('host') ?? 'localhost'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  redirect(`${proto}://${host}/conta`)
}
