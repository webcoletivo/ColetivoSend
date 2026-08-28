import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HomeClient } from './home-client'

/**
 * Unificação por abas: a home é pública (quem recebe um link não precisa de
 * conta), mas quem já está logado na plataforma não pode ver "Entrar / Criar
 * conta". Sem sessão local e com o cookie da plataforma presente, passa pela
 * ponte SSO — que valida a sessão central e volta para cá já autenticado.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    const cookieStore = await cookies()
    const temSessaoDaPlataforma = cookieStore
      .getAll()
      .some((c) => /^(__Secure-)?authjs\.session-token/.test(c.name))
    if (temSessaoDaPlataforma) {
      redirect('/api/sso/entrar?next=/send')
    }
  }

  return <HomeClient />
}
