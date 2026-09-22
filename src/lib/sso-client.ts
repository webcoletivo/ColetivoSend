/**
 * Ponte SSO vista do navegador (unificação por abas).
 *
 * Quando a sessão local do Send some no meio do uso (cookie expirou, saída
 * pela plataforma), o caminho de volta é a ponte /api/sso/entrar: ela
 * revalida a sessão central, cunha a local de novo e devolve para `next`.
 * É uma rota de API que grava cookie e redireciona — por isso a ida é uma
 * navegação de documento inteiro (window.location), e não router.push.
 *
 * `next` é caminho interno JÁ com basePath (ex.: `${BASE_PATH}/dashboard`):
 * o navegador não acrescenta o prefixo sozinho.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/send'

/** Caminho (com basePath) da ponte SSO que volta para `next`. */
export function caminhoSso(next: string): string {
  return `${BASE_PATH}/api/sso/entrar?next=${encodeURIComponent(next)}`
}

/** Vai à ponte SSO e volta para `next`. Só no navegador. */
export function entrarPelaPlataforma(next: string): void {
  if (typeof window === 'undefined') return
  window.location.assign(caminhoSso(next))
}
