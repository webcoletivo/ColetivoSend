import { test, expect, type APIRequestContext } from '@playwright/test'
import { SEND, apiLogada, apiAnonima, criarEnvioViaApi, apagarEnvio, type EnvioCriado } from './apoio'

/**
 * Sondagens de segurança contra produção (auditoria OWASP de 2026-09-24).
 * Nada destrutivo: GET/HEAD/POST vazio em rotas privadas SEM cookie, token
 * inválido no link público, cabeçalhos — e UM envio de teste "[E2E-SEC]"
 * (1 arquivo .txt, com senha, sem destinatário) criado no beforeAll e apagado
 * no afterAll para provar o fluxo do link público. Ritmo baixo (≤ 5 req/s).
 *
 * O que só vale depois do deploy da auditoria é detectado pela ausência do
 * X-Powered-By (removido nela): antes do deploy esses pontos são só
 * registrados no log como "pendente de deploy", para a suíte não ficar
 * vermelha pelo que ainda não subiu.
 */

const ROTULO_SEG = '[E2E-SEC]'
const SENHA = 'e2e-senha-9x'
const pausa = (ms = 250) => new Promise((r) => setTimeout(r, ms))

let anon: APIRequestContext
let deployNovo = false
const pendentes: string[] = []

/** Afirma só depois do deploy; antes, registra a pendência. */
function aposDeploy(descricao: string, verificar: () => void) {
  if (deployNovo) {
    verificar()
  } else {
    pendentes.push(descricao)
    console.log(`  pendente de deploy: ${descricao}`)
  }
}

test.beforeAll(async () => {
  anon = await apiAnonima()
  // /api/health nunca trouxe X-Powered-By (nem no build antigo); a página
  // pública e as rotas de API trazem — a auditoria desliga em todas.
  const sondas = [`${SEND}/d/nao-existe-123`, `${SEND}/api/transfers`]
  let comPoweredBy = 0
  for (const caminho of sondas) {
    const r = await anon.get(caminho, { failOnStatusCode: false })
    if ('x-powered-by' in r.headers()) comPoweredBy++
    await pausa()
  }
  deployNovo = comPoweredBy === 0
  console.log(`[seguranca] build em produção ${deployNovo ? 'já inclui' : 'ainda NÃO inclui'} a auditoria (X-Powered-By em ${comPoweredBy}/${sondas.length} sondas)`)
})

test.afterAll(async () => {
  if (pendentes.length) console.log(`[seguranca] ${pendentes.length} verificação(ões) aguardando deploy:\n  - ${pendentes.join('\n  - ')}`)
  await anon?.dispose()
})

test('privados sem cookie: API nega (401) e páginas internas vão à ponte SSO', async () => {
  const apis: [string, 'get' | 'post' | 'delete' | 'patch', number[]][] = [
    [`${SEND}/api/transfers`, 'get', [401]],
    [`${SEND}/api/transfers?limit=1`, 'get', [401]],
    [`${SEND}/api/dashboard/stats`, 'get', [401]],
    [`${SEND}/api/admin/media`, 'get', [401]],
    [`${SEND}/api/admin/media/reorder`, 'post', [401]],
    [`${SEND}/api/admin/media/abc`, 'delete', [401]],
    [`${SEND}/api/upload/chunk/init`, 'post', [401]],
    [`${SEND}/api/upload/chunk/abc`, 'get', [401]],
    [`${SEND}/api/upload/chunk/abc/presign`, 'get', [401]],
    [`${SEND}/api/upload/chunk/abc/complete`, 'post', [401]],
    [`${SEND}/api/upload/chunk/abc/report`, 'post', [401]],
    [`${SEND}/api/transfers/abc/email`, 'post', [401]],
    [`${SEND}/api/transfers/abc`, 'delete', [401]],
    [`${SEND}/api/transfers/abc`, 'patch', [401]],
    [`${SEND}/api/cron/cleanup`, 'get', [401]],
  ]
  for (const [caminho, metodo, aceitos] of apis) {
    const r = await anon[metodo](caminho, { data: {}, failOnStatusCode: false })
    console.log(`  ${metodo.toUpperCase()} ${caminho} -> ${r.status()}`)
    expect(aceitos, `${metodo.toUpperCase()} ${caminho} sem cookie`).toContain(r.status())
    await pausa()
  }

  // finalize e mídia da home: só depois do deploy a sessão é conferida antes de tudo
  const fin = await anon.post(`${SEND}/api/transfers/finalize`, { data: {}, failOnStatusCode: false })
  console.log(`  POST ${SEND}/api/transfers/finalize (vazio) -> ${fin.status()}`)
  expect([401, 400], 'finalize sem cookie nunca cria nada').toContain(fin.status())
  aposDeploy('finalize sem cookie responde 401 antes de validar o corpo', () => expect(fin.status()).toBe(401))
  const midia = await anon.get(`${SEND}/api/media/public`, { failOnStatusCode: false })
  console.log(`  GET ${SEND}/api/media/public -> ${midia.status()}`)
  aposDeploy('mídia da home exige sessão (401)', () => expect(midia.status()).toBe(401))

  // rotas mortas removidas (auth local, usuário, envio/upload legados)
  for (const caminho of [
    `${SEND}/api/auth/signup`, `${SEND}/api/auth/forgot-password`, `${SEND}/api/auth/reset-password`,
    `${SEND}/api/auth/login-challenge`, `${SEND}/api/auth/2fa/verify`, `${SEND}/api/user/profile`,
    `${SEND}/api/user/password`, `${SEND}/api/transfer`, `${SEND}/api/upload`, `${SEND}/api/upload/presign`,
  ]) {
    const r = await anon.post(caminho, { data: {}, failOnStatusCode: false })
    console.log(`  POST ${caminho} -> ${r.status()}`)
    expect(r.status(), `${caminho} nunca cria conta/sessão sem SSO`).not.toBe(200)
    aposDeploy(`${caminho} removida (404)`, () => expect(r.status()).toBe(404))
    await pausa()
  }

  // páginas internas: redirect para a ponte SSO, nunca conteúdo
  // (`/send/` com barra final é só o 308 do Next para `/send`; sonda-se `/send`)
  for (const caminho of [SEND, `${SEND}/dashboard`, `${SEND}/settings/media`, `${SEND}/login`]) {
    const r = await anon.get(caminho, { maxRedirects: 0, failOnStatusCode: false })
    const destino = r.headers()['location'] ?? ''
    console.log(`  GET ${caminho} -> ${r.status()} ${destino}`)
    expect([301, 302, 303, 307, 308], `${caminho} redireciona sem sessão`).toContain(r.status())
    expect(destino, `${caminho} vai à ponte SSO ou ao login central`).toMatch(/\/send\/api\/sso\/entrar|\/login/)
    await pausa()
  }
})

test('ponte SSO: "next" com tab/host externo não vira redirecionamento aberto', async () => {
  for (const next of ['/%09/evil.com', '//evil.com', 'https://evil.com', '/%5Cevil.com', '/kadro']) {
    const r = await anon.get(`${SEND}/api/sso/entrar?next=${next}`, { maxRedirects: 0, failOnStatusCode: false })
    const destino = r.headers()['location'] ?? ''
    console.log(`  next=${next} -> ${r.status()} ${destino}`)
    expect([301, 302, 303, 307, 308], 'sem sessão a ponte manda ao login central').toContain(r.status())
    const url = new URL(destino, 'https://app.grupocoletivo.com.br')
    expect(url.hostname, 'destino no próprio domínio').not.toMatch(/evil\.com/)
    aposDeploy(`next=${next} cai no padrão /send/dashboard`, () => {
      expect(url.searchParams.get('next')).toBe(`${SEND}/dashboard`)
    })
    await pausa()
  }
})

test('link público inválido: 404 genérico na API e na página', async () => {
  for (const token of ['nao-existe-123', 'AAAAAAAAAAAAAAAAAAAAAA', '..', '%2e%2e%2f']) {
    const api = await anon.get(`${SEND}/api/transfer/${token}`, { failOnStatusCode: false })
    console.log(`  GET /api/transfer/${token} -> ${api.status()}`)
    expect(api.status(), `metadados de token inválido "${token}"`).toBe(404)
    const corpo = await api.text()
    expect(corpo, 'sem stack trace ou detalhe interno').not.toMatch(/prisma|at .*\.js|stack/i)
    await pausa()
  }
  const unlock = await anon.post(`${SEND}/api/transfer/nao-existe-123/unlock`, { data: { password: 'x' }, failOnStatusCode: false })
  expect(unlock.status(), 'unlock de token inválido').toBe(404)
  const download = await anon.post(`${SEND}/api/download/nao-existe-123`, { data: {}, failOnStatusCode: false })
  expect(download.status(), 'download de token inválido').toBe(404)

  const pagina = await anon.get(`${SEND}/d/nao-existe-123`, { failOnStatusCode: false })
  console.log(`  GET /d/nao-existe-123 -> ${pagina.status()}`)
  expect([200, 404], 'página de token inválido não expõe nada').toContain(pagina.status())
  aposDeploy('página /d/<token inválido> responde 404 de verdade', () => expect(pagina.status()).toBe(404))
})

test('cabeçalhos de segurança na página pública, na API e no 404', async () => {
  const alvos = [`${SEND}/d/nao-existe-123`, `${SEND}/api/transfer/nao-existe-123`, `${SEND}/api/transfers`, `${SEND}/api/health`]
  for (const caminho of alvos) {
    const r = await anon.get(caminho, { failOnStatusCode: false })
    const h = r.headers()
    console.log(`  ${caminho} -> ${r.status()} csp=${(h['content-security-policy'] ?? '').slice(0, 60)}…`)
    expect(h['content-security-policy'], `${caminho}: CSP`).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
    expect(h['content-security-policy'], `${caminho}: frame-ancestors`).toContain("frame-ancestors 'none'")
    expect(h['content-security-policy'], `${caminho}: object-src`).toContain("object-src 'none'")
    expect(h['strict-transport-security'], `${caminho}: HSTS`).toMatch(/max-age=\d{7,}/)
    expect(h['x-content-type-options'], `${caminho}: nosniff`).toBe('nosniff')
    expect(h['x-frame-options'], `${caminho}: X-Frame-Options`).toBe('DENY')
    expect(h['referrer-policy'], `${caminho}: Referrer-Policy`).toBe('strict-origin-when-cross-origin')
    expect(h['x-robots-tag'], `${caminho}: X-Robots-Tag`).toContain('noindex')
    aposDeploy(`${caminho}: sem X-Powered-By`, () => expect(h['x-powered-by']).toBeUndefined())
    if (caminho.startsWith(`${SEND}/api/`) && caminho !== `${SEND}/api/health`) {
      aposDeploy(`${caminho}: Cache-Control no-store`, () => expect(h['cache-control'] ?? '').toContain('no-store'))
    }
    await pausa()
  }
})

test.describe('link público com senha (envio de teste [E2E-SEC])', () => {
  let api: APIRequestContext | null = null
  let envio: EnvioCriado | null = null
  let motivo = ''

  test.beforeAll(async () => {
    try {
      api = await apiLogada()
      envio = await criarEnvioViaApi(api, ROTULO_SEG, { senha: SENHA })
      console.log(`[seguranca] envio ${ROTULO_SEG} criado: token=${envio.token} id=${envio.transferId}`)
    } catch (e) {
      motivo = String(e).slice(0, 200)
      console.log(`[seguranca] não foi possível criar o envio ${ROTULO_SEG}: ${motivo}`)
    }
  })

  test.afterAll(async () => {
    if (api && envio) console.log(`[seguranca] envio ${ROTULO_SEG} apagado: HTTP ${await apagarEnvio(api, envio.transferId)}`)
    await api?.dispose()
  })

  test('metadados não vazam, senha certa entrega URLs curtas, senha errada é freada, revogado bloqueia', async () => {
    test.skip(!envio, `sem envio ${ROTULO_SEG}: ${motivo}`)
    const { token, transferId, nomeDoArquivo } = envio!
    const tokenNovo = /^[A-Za-z0-9]{22}$/.test(token)
    console.log(`  token com ${token.length} caracteres (${tokenNovo ? '≥128 bits' : 'formato antigo'})`)
    aposDeploy('token novo com 22 caracteres (≥128 bits)', () => expect(tokenNovo).toBe(true))

    // 1. metadados: só "há senha" — nem arquivos, nem remetente, nem id interno
    const meta = await anon.get(`${SEND}/api/transfer/${token}`, { failOnStatusCode: false })
    expect(meta.status()).toBe(200)
    const dadosMeta = (await meta.json()) as Record<string, unknown>
    expect(dadosMeta.hasPassword).toBe(true)
    expect(dadosMeta.files, 'arquivos só depois da senha').toBeUndefined()
    expect(dadosMeta.senderName, 'remetente só depois da senha').toBeUndefined()
    aposDeploy('id interno fora da resposta pública', () => expect(dadosMeta.id).toBeUndefined())
    await pausa()

    // 2. página pública existe (200) e é a tela de senha, sem os arquivos no HTML
    const pagina = await anon.get(`${SEND}/d/${token}`, { failOnStatusCode: false })
    expect(pagina.status()).toBe(200)
    expect(await pagina.text(), 'nome do arquivo não vai no HTML antes da senha').not.toContain(nomeDoArquivo)
    await pausa()

    // 3. senha certa: arquivos com URL presignada curta
    const ok = await anon.post(`${SEND}/api/transfer/${token}/unlock`, { data: { password: SENHA }, failOnStatusCode: false })
    expect(ok.status(), 'senha certa desbloqueia').toBe(200)
    const dadosOk = (await ok.json()) as { files: { id: string; originalName: string; downloadUrl: string }[] }
    expect(dadosOk.files).toHaveLength(1)
    expect(dadosOk.files[0].originalName).toBe(nomeDoArquivo)
    const urlDownload = new URL(dadosOk.files[0].downloadUrl, 'https://app.grupocoletivo.com.br')
    const validade = Number(urlDownload.searchParams.get('X-Amz-Expires') ?? urlDownload.searchParams.get('expires') ?? 0)
    console.log(`  URL de download: host=${urlDownload.hostname} validade=${validade}s`)
    aposDeploy('URL presignada vale no máximo 15 min', () => expect(validade).toBeLessThanOrEqual(900))
    await pausa()

    // 4. POST /download com a senha: registra e devolve URL nova (string, não "{}")
    const dl = await anon.post(`${SEND}/api/download/${token}`, {
      data: { password: SENHA, fileId: dadosOk.files[0].id },
      failOnStatusCode: false,
    })
    expect(dl.status(), 'download com senha certa').toBe(200)
    const dadosDl = (await dl.json()) as { downloads: { id: string; url: unknown }[] }
    expect(dadosDl.downloads).toHaveLength(1)
    aposDeploy('POST /download devolve URL de download (bug do presign não aguardado)', () => {
      expect(typeof dadosDl.downloads[0].url).toBe('string')
    })
    await pausa()

    // 5. download sem senha é negado
    const semSenha = await anon.post(`${SEND}/api/download/${token}`, { data: {}, failOnStatusCode: false })
    expect(semSenha.status(), 'download sem senha').toBe(401)
    await pausa()

    // 6. força bruta: 6 senhas erradas seguidas — nenhuma abre, e o freio (429) aparece
    const respostas: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await anon.post(`${SEND}/api/transfer/${token}/unlock`, { data: { password: `errada-${i}` }, failOnStatusCode: false })
      respostas.push(r.status())
      await pausa(300)
    }
    console.log(`  senhas erradas: ${respostas.join(' ')}`)
    expect(respostas, 'senha errada nunca abre').not.toContain(200)
    expect(respostas.every((s) => s === 401 || s === 429), 'só 401/429').toBe(true)
    expect(respostas, 'freio de força bruta (429) dentro de 6 tentativas').toContain(429)

    // 7. revogado: metadados 410 e nem a senha certa desbloqueia
    const rev = await api!.patch(`${SEND}/api/transfers/${transferId}`, { data: { status: 'revoked' }, failOnStatusCode: false })
    expect(rev.status(), 'dono revoga').toBe(200)
    await pausa()
    const metaRev = await anon.get(`${SEND}/api/transfer/${token}`, { failOnStatusCode: false })
    expect(metaRev.status(), 'metadados de link revogado').toBe(410)
    expect(((await metaRev.json()) as { code?: string }).code).toBe('revoked')
    const unlockRev = await anon.post(`${SEND}/api/transfer/${token}/unlock`, { data: { password: SENHA }, failOnStatusCode: false })
    console.log(`  unlock com senha certa após revogar -> ${unlockRev.status()}`)
    expect(unlockRev.status(), 'revogado não entrega arquivos').not.toBe(200)
    aposDeploy('unlock de link revogado responde 410 (ou 429 pelo freio)', () => expect([410, 429]).toContain(unlockRev.status()))
    const dlRev = await anon.post(`${SEND}/api/download/${token}`, { data: { password: SENHA }, failOnStatusCode: false })
    expect(dlRev.status(), 'download de link revogado').not.toBe(200)
  })
})
