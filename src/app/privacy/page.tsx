import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Unificação por abas: privacidade e termos são únicos para toda a
 * plataforma. URL absoluta de propósito — um caminho relativo receberia o
 * basePath deste app.
 */
export default async function Page() {
  const h = await headers()
  const host = h.get('host') ?? 'localhost'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  redirect(`${proto}://${host}/privacidade`)
}
