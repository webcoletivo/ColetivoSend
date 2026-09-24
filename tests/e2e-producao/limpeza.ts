import { request } from '@playwright/test'
import fs from 'node:fs'
import { BASE, SEND, ESTADO, ARQUIVO_ESTADO, lerEstado } from './apoio'

/**
 * globalTeardown: apaga em produção o que a suíte criou e não conseguiu
 * apagar (envio [E2E-AJAX], envios criados por API — a11y/segurança — e/ou
 * mídia 1x1). Usa a sessão salva pelo setup; a do Send é cunhada pela ponte
 * SSO antes das chamadas à API.
 */
export default async function limpeza() {
  const estado = lerEstado()
  fs.rmSync(ARQUIVO_ESTADO, { force: true }) // sempre: a próxima rodada começa limpa
  const envios = [estado.transferId, ...(estado.transferIdsApi ?? [])].filter((id): id is string => !!id)
  if (envios.length === 0 && !estado.mediaId) return
  if (!fs.existsSync(ESTADO)) {
    console.log('[limpeza] sem sessão salva — nada apagado:', JSON.stringify(estado))
    return
  }
  const api = await request.newContext({ baseURL: BASE, storageState: ESTADO })
  try {
    await api.get(`${SEND}/api/sso/entrar?next=${encodeURIComponent(`${SEND}/dashboard`)}`, { failOnStatusCode: false })
    for (const id of envios) {
      const r = await api.delete(`${SEND}/api/transfers/${id}`, { failOnStatusCode: false })
      console.log(`[limpeza] envio ${id}: HTTP ${r.status()}`)
    }
    if (estado.mediaId) {
      const r = await api.delete(`${SEND}/api/admin/media/${estado.mediaId}`, { failOnStatusCode: false })
      console.log(`[limpeza] mídia ${estado.mediaId}: HTTP ${r.status()}`)
    }
  } finally {
    await api.dispose()
  }
}
