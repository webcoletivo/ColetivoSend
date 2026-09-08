import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/send'

/**
 * Unificação por abas: o login local foi desativado — quem autentica é a
 * plataforma. Esta rota só encaminha para a ponte SSO, preservando o destino
 * (callbackUrl vem dos fluxos antigos do app; caminho interno apenas).
 */
export default async function LoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  const bruto = callbackUrl ?? `${BASE_PATH}/dashboard`
  const next =
    bruto.startsWith('/') && !bruto.startsWith('//') && !bruto.includes('\\')
      ? bruto
      : `${BASE_PATH}/dashboard`
  redirect(`/api/sso/entrar?next=${encodeURIComponent(next)}`)
}
