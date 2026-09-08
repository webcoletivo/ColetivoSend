import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Unificação por abas: não existe cadastro local — contas são criadas pela
 * administração na plataforma. Encaminha para a ponte SSO (que leva ao login
 * central quando não há sessão).
 */
export default function SignupRedirect() {
  redirect('/api/sso/entrar?next=/send')
}
