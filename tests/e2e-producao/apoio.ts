import { expect, request, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Apoio da suíte de produção do Send. Não é um teste: o Playwright só coleta
 * *.spec.ts e *.setup.ts.
 *
 * A pergunta que a suíte responde é sempre a mesma: a ação refletiu na tela
 * SEM recarregar a página? A prova tem duas partes:
 *  - uma marca gravada no `window` antes da ação (some se o documento
 *    recarregar);
 *  - o contador de eventos `load` da página desde a marca (zero = nenhuma
 *    navegação inteira / F5).
 */

export const BASE = process.env.E2E_BASE_URL || 'https://app.grupocoletivo.com.br'
export const SEND = '/send'
export const EMAIL_PROPRIO = 'web@coletivoestudio.com.br'
export const ROTULO = '[E2E-AJAX]'

/** Sessão salva pelo auth.setup.ts (ignorada pelo git). */
export const ESTADO = path.join(__dirname, '.auth', 'user.json')

/**
 * O que a suíte criou em produção (envio e mídia de teste). Fica em arquivo,
 * não em variável de módulo: o Playwright reinicia o worker depois de uma
 * falha e o estado em memória se perde — e a limpeza (globalTeardown) roda
 * num processo separado, no fim de tudo.
 */
export const ARQUIVO_ESTADO = path.join(__dirname, '.auth', 'e2e-estado.json')

export interface EstadoSuite {
  token?: string | null
  transferId?: string | null
  mediaId?: string | null
  /** Envios criados por API (a11y, segurança) que ainda não foram apagados. */
  transferIdsApi?: string[]
}

export function lerEstado(): EstadoSuite {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8')) as EstadoSuite
  } catch {
    return {}
  }
}

export function gravarEstado(parcial: EstadoSuite) {
  fs.mkdirSync(path.dirname(ARQUIVO_ESTADO), { recursive: true })
  fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify({ ...lerEstado(), ...parcial }))
}

/** Registra/retira um envio criado por API na lista de pendências da limpeza. */
export function lembrarEnvioApi(transferId: string, apagado = false) {
  const atual = new Set(lerEstado().transferIdsApi ?? [])
  if (apagado) atual.delete(transferId)
  else atual.add(transferId)
  gravarEstado({ transferIdsApi: [...atual] })
}

/** PNG 1x1 transparente — única mídia que a suíte envia (e apaga). */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

export interface Cargas {
  loads: number
}

/** Conta cargas de documento (F5, navegação inteira) a partir de agora. */
export function vigiarRecarga(page: Page): Cargas {
  const cargas: Cargas = { loads: 0 }
  page.on('load', () => {
    cargas.loads++
  })
  return cargas
}

/** Marca o contexto JS atual; se a página recarregar, a marca some. */
export async function marcar(page: Page) {
  await page.evaluate(() => {
    ;(window as unknown as { __marca: number }).__marca = 1
  })
}

export async function exigirSemRecarga(page: Page, cargas: Cargas, passo: string) {
  const marca = await page.evaluate(() => (window as unknown as { __marca?: number }).__marca)
  expect(marca, `${passo}: contexto JS preservado (sem recarga)`).toBe(1)
  expect(cargas.loads, `${passo}: nenhuma carga de documento`).toBe(0)
}

/** Erros graves (5xx da própria origem, exceção não tratada) derrubam o teste. */
export function vigiar(page: Page, tela: string) {
  const graves: string[] = []
  page.on('pageerror', (e) => graves.push(`[${tela}] pageerror: ${String(e).slice(0, 200)}`))
  page.on('response', (r) => {
    if (r.status() >= 500 && r.url().startsWith(BASE)) {
      graves.push(`[${tela}] HTTP ${r.status()} em ${r.url().slice(0, 160)}`)
    }
  })
  return {
    exigirSemGraves() {
      expect(graves, `erros graves de console/rede em ${tela}`).toEqual([])
    },
  }
}

/**
 * A sessão salva é só a da plataforma; a do Send é cunhada pela ponte SSO na
 * primeira visita. Para chamar a API do Send por page.request antes de
 * qualquer navegação, passa pela ponte uma vez (o cookie fica no contexto).
 */
export async function entrarNoSend(page: Page) {
  await page.request.get(`${SEND}/api/sso/entrar?next=${encodeURIComponent(`${SEND}/dashboard`)}`, {
    failOnStatusCode: false,
  })
}

/** Contexto de API já logado no Send (sessão salva + ponte SSO). */
export async function apiLogada(): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: BASE, storageState: ESTADO })
  await api.get(`${SEND}/api/sso/entrar?next=${encodeURIComponent(`${SEND}/dashboard`)}`, { failOnStatusCode: false })
  return api
}

/** Contexto de API SEM sessão nenhuma (quem está de fora). */
export async function apiAnonima(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE, storageState: { cookies: [], origins: [] } })
}

export interface EnvioCriado {
  token: string
  transferId: string
  nomeDoArquivo: string
}

/**
 * Cria um envio pequeno pela API (o mesmo caminho do formulário: init →
 * PUT presignado → report → complete → finalize), com 1 arquivo .txt e sem
 * destinatário (nenhum e-mail sai). Quem chama apaga com apagarEnvio().
 */
export async function criarEnvioViaApi(
  api: APIRequestContext,
  rotulo: string,
  opcoes: { senha?: string; expirationDays?: number } = {},
): Promise<EnvioCriado> {
  const transferId = crypto.randomUUID()
  const fileId = crypto.randomUUID()
  const nomeDoArquivo = `${rotulo}.txt`
  const conteudo = Buffer.from(`${rotulo} envio de teste automatizado — pode apagar\n`.repeat(4))

  const init = await api.post(`${SEND}/api/upload/chunk/init`, {
    data: { transferId, fileId, fileName: nomeDoArquivo, fileSize: conteudo.length, mimeType: 'text/plain' },
    failOnStatusCode: false,
  })
  if (!init.ok()) throw new Error(`init do upload: HTTP ${init.status()} ${(await init.text()).slice(0, 200)}`)
  const { sessionId, storageKey } = (await init.json()) as { sessionId: string; storageKey: string }

  const presign = await api.get(`${SEND}/api/upload/chunk/${sessionId}/presign?partNumber=1`, { failOnStatusCode: false })
  if (!presign.ok()) throw new Error(`presign da parte: HTTP ${presign.status()}`)
  const { url, storageType } = (await presign.json()) as { url: string; storageType: string }

  if (storageType === 's3') {
    const put = await api.put(url, { data: conteudo, headers: { 'Content-Type': 'application/octet-stream' }, failOnStatusCode: false })
    if (!put.ok()) throw new Error(`PUT presignado: HTTP ${put.status()}`)
    const etag = put.headers()['etag'] ?? ''
    const report = await api.post(`${SEND}/api/upload/chunk/${sessionId}/report`, {
      data: { partNumber: 1, ETag: etag, size: conteudo.length },
      failOnStatusCode: false,
    })
    if (!report.ok()) throw new Error(`report da parte: HTTP ${report.status()}`)
  } else {
    const put = await api.put(`${SEND}/api/upload/chunk/${sessionId}`, {
      data: conteudo,
      headers: { 'Content-Type': 'application/octet-stream', 'x-part-number': '1' },
      failOnStatusCode: false,
    })
    if (!put.ok()) throw new Error(`PUT local da parte: HTTP ${put.status()}`)
  }

  const complete = await api.post(`${SEND}/api/upload/chunk/${sessionId}/complete`, { failOnStatusCode: false })
  if (!complete.ok()) throw new Error(`complete do upload: HTTP ${complete.status()}`)

  const finalize = await api.post(`${SEND}/api/transfers/finalize`, {
    data: {
      transferId,
      senderName: 'E2E',
      recipientEmail: null,
      message: `${rotulo} envio de teste automatizado — pode apagar`,
      files: [{ name: nomeDoArquivo, size: conteudo.length, type: 'text/plain', storageKey }],
      expirationDays: opcoes.expirationDays ?? 1,
      password: opcoes.senha ?? null,
    },
    failOnStatusCode: false,
  })
  if (!finalize.ok()) throw new Error(`finalize: HTTP ${finalize.status()} ${(await finalize.text()).slice(0, 200)}`)
  const dados = (await finalize.json()) as { transfer: { id: string; shareToken: string } }
  lembrarEnvioApi(dados.transfer.id)
  return { token: dados.transfer.shareToken, transferId: dados.transfer.id, nomeDoArquivo }
}

/** Apaga um envio criado pela suíte (idempotente: 404 também conta como apagado). */
export async function apagarEnvio(api: APIRequestContext, transferId: string): Promise<number> {
  const r = await api.delete(`${SEND}/api/transfers/${transferId}`, { failOnStatusCode: false })
  if (r.ok() || r.status() === 404) lembrarEnvioApi(transferId, true)
  return r.status()
}

/** Linhas da lista de envios do painel: os cards que têm o botão "Copiar" (mais recente primeiro). */
export function linhasDoPainel(page: Page): Locator {
  return page.locator('main .card').filter({ has: page.getByRole('button', { name: /^(Copiar|Copiado)$/ }) })
}

/** Botão "mais ações" da linha (ícone "…", nomeado por aria-label). */
export function botaoMenu(linha: Locator): Locator {
  return linha.getByRole('button', { name: 'Mais ações' })
}

/**
 * Item do menu "…" da linha. O menu novo usa role=menuitem; a versão anterior
 * em produção usava button/link puros — aceita os dois para a suíte valer
 * antes e depois do deploy.
 */
export function itemMenu(linha: Locator, nome: string): Locator {
  return linha
    .getByRole('menuitem', { name: nome })
    .or(linha.getByRole('button', { name: nome }))
    .or(linha.getByRole('link', { name: nome }))
}

/**
 * Confirma a exclusão: no diálogo do padrão (role=alertdialog) clica no botão
 * de confirmar; se a tela ainda usa confirm() nativo, o page.on('dialog') do
 * teste já aceitou e nada aparece.
 */
export async function confirmarNoDialogo(page: Page, botao: RegExp | string) {
  const dialogo = page.getByRole('alertdialog')
  const apareceu = await dialogo.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false)
  if (apareceu) await dialogo.getByRole('button', { name: botao }).click()
  return apareceu
}

/** Valor da métrica ("Views" | "Downloads") de uma linha do painel. */
export function metrica(linha: Locator, rotulo: 'Views' | 'Downloads'): Locator {
  return linha.locator('.text-center', { hasText: rotulo }).locator('p').first()
}

/** Valor de um card de resumo ("Total de envios" | "Ativos" | "Expirados"). */
export function resumo(page: Page, rotulo: string): Locator {
  return page.locator('p', { hasText: new RegExp(`^${rotulo}$`) }).locator('xpath=following-sibling::p[1]')
}
