import { expect, type Locator, type Page } from '@playwright/test'
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

/** Linhas da lista de envios do painel: os cards que têm o botão "Copiar" (mais recente primeiro). */
export function linhasDoPainel(page: Page): Locator {
  return page.locator('main .card').filter({ has: page.getByRole('button', { name: /^(Copiar|Copiado)$/ }) })
}

/** Botão "mais ações" da linha: o único botão sem texto (só ícone). */
export function botaoMenu(linha: Locator): Locator {
  return linha.getByRole('button').filter({ hasNotText: /./ }).first()
}

/** Valor da métrica ("Views" | "Downloads") de uma linha do painel. */
export function metrica(linha: Locator, rotulo: 'Views' | 'Downloads'): Locator {
  return linha.locator('.text-center', { hasText: rotulo }).locator('p').first()
}

/** Valor de um card de resumo ("Total de envios" | "Ativos" | "Expirados"). */
export function resumo(page: Page, rotulo: string): Locator {
  return page.locator('p', { hasText: new RegExp(`^${rotulo}$`) }).locator('xpath=following-sibling::p[1]')
}
