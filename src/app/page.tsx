import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarMidiaPublica, type MidiaPublica } from '@/lib/media-publica'
import { HomeClient } from './home-client'

/**
 * Unificação por abas: sistema interno — a home exige a sessão central.
 * Sem sessão local, a ponte SSO decide: com cookie da plataforma, cunha a
 * sessão local e volta; sem, manda para o login central (?next volta aqui).
 * Só a página de download (/d/[token]) permanece pública — é o link que o
 * cliente externo recebe.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/api/sso/entrar?next=/send')
  }

  // A mídia de fundo vai no HTML (sem o fetch cliente + hidratação antes do
  // primeiro byte do vídeo). Falha aqui nunca derruba a home: o player faz
  // o fetch dele mesmo quando a lista não vem.
  let midiaInicial: MidiaPublica[] | undefined
  try {
    midiaInicial = await listarMidiaPublica()
  } catch (e) {
    console.error('[home] mídia de fundo indisponível no servidor', e)
  }

  return <HomeClient midiaInicial={midiaInicial} />
}
