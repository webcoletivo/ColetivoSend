import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Unificação por abas: senha e segurança da conta ficam na plataforma —
 * é ela quem autentica em todos os sistemas.
 */
export default async function SecuritySettingsPage() {
  const h = await headers()
  const host = h.get('host') ?? 'localhost'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  redirect(`${proto}://${host}/conta`)
}
