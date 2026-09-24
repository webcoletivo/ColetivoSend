import { test, expect } from '@playwright/test'
import {
  BASE, SEND, EMAIL_PROPRIO, ROTULO, PNG_1X1,
  lerEstado, gravarEstado,
  vigiarRecarga, marcar, exigirSemRecarga, vigiar, entrarNoSend,
  linhasDoPainel, botaoMenu, itemMenu, confirmarNoDialogo, metrica, resumo,
} from './apoio'

/**
 * Atualização da tela sem recarga (AJAX) em todas as ações do Send, contra
 * produção. Os testes rodam em ordem, num worker só, e compartilham o envio
 * criado no primeiro (estado em .auth/e2e-estado.json); a limpeza final é o
 * globalTeardown (limpeza.ts).
 */

test('home: cria envio [E2E-AJAX] e conclui sem recarga (progresso, link, copiar, e-mail)', async ({ page, context }) => {
  gravarEstado({ token: null, transferId: null })
  const v = vigiar(page, 'home')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  await page.goto(`${SEND}/`)
  await expect(page.getByRole('heading', { name: 'Enviar arquivos' })).toBeVisible({ timeout: 30_000 })
  const cargas = vigiarRecarga(page)
  await marcar(page)

  // um arquivo pequeno, gerado aqui, para o próprio e-mail
  await page.locator('input[type="file"]').first().setInputFiles({
    name: `${ROTULO}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from(`${ROTULO} envio de teste automatizado — pode apagar\n`.repeat(20)),
  })
  await expect(page.getByText(`${ROTULO}.txt`)).toBeVisible()
  // e-mail digitado SEM Enter: tem de virar chip sozinho ao sair do campo
  // (Tab) — antes só o Enter confirmava e o clique em "Transferir" não fazia nada
  const destinatario = page.getByPlaceholder('adicionar@email.com')
  await destinatario.fill(EMAIL_PROPRIO)
  await destinatario.press('Tab')
  await expect(page.getByText(EMAIL_PROPRIO, { exact: true })).toBeVisible()
  await page.getByPlaceholder('Mensagem (opcional)').fill(`${ROTULO} envio de teste automatizado — pode apagar`)
  await exigirSemRecarga(page, cargas, 'preencher formulário')

  const progresso = page.getByText(/Enviando \d+ de \d+|Finalizando envio|Enviando e-mails/)
  await page.getByRole('button', { name: 'Transferir Arquivos' }).click()
  const viuProgresso = await progresso.first().waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false)
  await expect(page.getByRole('heading', { name: 'Envio concluído!' })).toBeVisible({ timeout: 120_000 })
  console.log(`[home] barra de progresso vista durante o upload: ${viuProgresso}`)
  await exigirSemRecarga(page, cargas, 'concluir envio')

  const link = await page.locator('input[readonly]').inputValue()
  const m = link.match(/\/send\/d\/([A-Za-z0-9_-]+)/)
  expect(m, 'link de download com basePath /send e token').not.toBeNull()
  const token = m![1]
  gravarEstado({ token })
  await expect(page.getByText('E-mail enviado para 1 destinatário(s).')).toBeVisible()

  await page.locator('input[readonly] + button').click()
  await expect(page.getByText('Link copiado!')).toBeVisible()
  const area = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '')
  console.log(`[home] área de transferência confere com o link: ${area === link}`)
  await exigirSemRecarga(page, cargas, 'copiar link')

  // id interno, para a limpeza final
  const r = await page.request.get(`${SEND}/api/transfers?limit=10`)
  const dados = await r.json()
  const transferId = dados.transfers?.find((t: { shareToken: string; id: string }) => t.shareToken === token)?.id ?? null
  gravarEstado({ transferId })
  console.log(`[home] envio criado: token=${token} id=${transferId}`)
  v.exigirSemGraves()
})

test('painel: lista o envio novo sem F5, copia sem recarga e navega por Link (sem carga inteira)', async ({ page }) => {
  const { token } = lerEstado()
  test.skip(!token, 'sem envio criado no teste anterior')
  const v = vigiar(page, 'painel')
  await page.goto(`${SEND}/dashboard`)
  const linha = linhasDoPainel(page).first()
  await expect(linha).toBeVisible({ timeout: 30_000 })
  const cargas = vigiarRecarga(page)
  await marcar(page)

  // a primeira linha é o envio recém-criado (ordem: mais recente primeiro)
  await expect(linha).toContainText(EMAIL_PROPRIO)
  await botaoMenu(linha).click()
  await expect(itemMenu(linha, 'Abrir link')).toHaveAttribute('href', new RegExp(`/send/d/${token}$`))
  await page.keyboard.press('Escape') // fecha o menu sem escolher nada

  await linha.getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByText('Link copiado!')).toBeVisible()
  await expect(linha.getByRole('button', { name: 'Copiado' })).toBeVisible()
  await exigirSemRecarga(page, cargas, 'copiar no painel')

  // atalhos do painel precisam ficar sob /send (basePath) — <a> puro cai na raiz da plataforma
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLAnchorElement>('header a, main a'))
      .map((a) => a.href)
      .filter((h) => !h.includes('/d/')),
  )
  console.log(`[painel] atalhos: ${hrefs.join(' | ')}`)
  for (const h of hrefs) expect(h, 'atalho do painel sob /send').toMatch(/\/send(\/|$)/)

  // "Novo envio" leva à home do Send por navegação client-side
  await page.locator('a:has-text("Novo envio")').first().click()
  await expect(page).toHaveURL(/\/send\/?$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'Enviar arquivos' })).toBeVisible({ timeout: 30_000 })
  console.log(`[painel] cargas de documento ao ir para "Novo envio": ${cargas.loads}`)
  expect(cargas.loads, '"Novo envio" sem carga inteira (Link do Next)').toBe(0)
  v.exigirSemGraves()
})

test('público /d/<token>: baixa sem recarga; painel aberto reflete views e downloads sem F5', async ({ page, context }) => {
  const { token } = lerEstado()
  test.skip(!token, 'sem envio criado no teste anterior')
  const v = vigiar(page, 'painel')
  await page.goto(`${SEND}/dashboard`)
  const linha = linhasDoPainel(page).first()
  await expect(linha).toBeVisible({ timeout: 30_000 })
  const cargas = vigiarRecarga(page)
  await marcar(page)
  const viewsAntes = Number(await metrica(linha, 'Views').innerText())
  const downloadsAntes = Number(await metrica(linha, 'Downloads').innerText())

  const publica = await context.newPage()
  const vp = vigiar(publica, 'publica')
  await publica.goto(`${SEND}/d/${token}`)
  await expect(publica.getByText(`${ROTULO}.txt`)).toBeVisible({ timeout: 30_000 })
  const cargasPub = vigiarRecarga(publica)
  await marcar(publica)

  const umArquivo = publica.waitForEvent('download', { timeout: 30_000 })
  await publica.getByRole('button', { name: `Baixar ${ROTULO}.txt` }).click()
  console.log(`[publica] download individual: ${(await umArquivo).suggestedFilename()}`)
  await exigirSemRecarga(publica, cargasPub, 'baixar um arquivo')

  const todos = publica.waitForEvent('download', { timeout: 30_000 })
  await publica.getByRole('button', { name: 'Baixar todos os arquivos' }).click()
  console.log(`[publica] baixar todos: ${(await todos).suggestedFilename()}`)
  await exigirSemRecarga(publica, cargasPub, 'baixar todos')
  vp.exigirSemGraves()
  await publica.close()

  // painel aberto ao lado, sem F5: view (+1 ao abrir) e downloads (+2) têm de aparecer sozinhos
  await expect(metrica(linha, 'Views'), 'views atualizam sem F5').not.toHaveText(String(viewsAntes), { timeout: 60_000 })
  await expect(metrica(linha, 'Downloads'), 'downloads atualizam sem F5').not.toHaveText(String(downloadsAntes), { timeout: 60_000 })
  console.log(
    `[painel] views ${viewsAntes} -> ${await metrica(linha, 'Views').innerText()}, ` +
    `downloads ${downloadsAntes} -> ${await metrica(linha, 'Downloads').innerText()}`,
  )
  await exigirSemRecarga(page, cargas, 'contadores atualizados')
  v.exigirSemGraves()
})

test('painel: revogar e excluir refletem na hora, sem recarga', async ({ page }) => {
  const { token } = lerEstado()
  test.skip(!token, 'sem envio criado no teste anterior')
  const v = vigiar(page, 'painel')
  page.on('dialog', (d) => d.accept())
  await page.goto(`${SEND}/dashboard`)
  const linhas = linhasDoPainel(page)
  const linha = linhas.first()
  await expect(linha).toBeVisible({ timeout: 30_000 })
  const cargas = vigiarRecarga(page)
  await marcar(page)
  const quantasAntes = await linhas.count()
  const ativosAntes = Number(await resumo(page, 'Ativos').innerText())
  const totalAntes = Number(await resumo(page, 'Total de envios').innerText())

  await botaoMenu(linha).click()
  await expect(itemMenu(linha, 'Abrir link')).toHaveAttribute('href', new RegExp(`/send/d/${token}$`))
  await itemMenu(linha, 'Revogar link').click()
  await expect(linha.getByText('Revogado')).toBeVisible()
  await expect(linha.getByRole('button', { name: 'Copiar' })).toBeDisabled()
  await expect(resumo(page, 'Ativos')).toHaveText(String(ativosAntes - 1))
  await exigirSemRecarga(page, cargas, 'revogar')

  await botaoMenu(linha).click()
  await itemMenu(linha, 'Excluir').click()
  // diálogo do padrão (explica a consequência) no lugar do confirm() nativo
  console.log(`[painel] diálogo de exclusão do padrão: ${await confirmarNoDialogo(page, /^Excluir envio$/)}`)
  await expect(linhas).toHaveCount(quantasAntes - 1)
  await expect(resumo(page, 'Total de envios')).toHaveText(String(totalAntes - 1))
  await exigirSemRecarga(page, cargas, 'excluir')

  const r = await page.request.get(`${SEND}/api/transfers?limit=50`)
  const dados = await r.json()
  expect(dados.transfers.some((t: { shareToken: string }) => t.shareToken === token), 'envio sumiu no servidor').toBe(false)
  gravarEstado({ transferId: null })
  v.exigirSemGraves()
})

test('mídia de fundo: enviar, desativar e excluir imagem 1x1 sem recarga', async ({ page }) => {
  await entrarNoSend(page)
  const sonda = await page.request.get(`${SEND}/api/admin/media`, { failOnStatusCode: false })
  test.skip(sonda.status() === 401 || sonda.status() === 403, 'usuário sem papel de admin no Send')
  const v = vigiar(page, 'midia')
  page.on('dialog', (d) => d.accept())
  await page.goto(`${SEND}/settings/media`)
  await expect(page.getByRole('heading', { name: 'Mídia de Fundo' })).toBeVisible({ timeout: 30_000 })
  const cargas = vigiarRecarga(page)
  await marcar(page)
  const itens = page.locator('main li')
  const antes = await itens.count()

  await page.getByRole('button', { name: 'Adicionar mídia' }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: `${ROTULO}.png`, mimeType: 'image/png', buffer: PNG_1X1 })
  await page.getByPlaceholder('Nome da mídia').fill(ROTULO)
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  const item = itens.filter({ hasText: ROTULO })
  await expect(item).toBeVisible({ timeout: 60_000 })
  await expect(itens).toHaveCount(antes + 1)
  await exigirSemRecarga(page, cargas, 'enviar mídia')
  const lista = await (await page.request.get(`${SEND}/api/admin/media`)).json()
  gravarEstado({ mediaId: lista.find((m: { title: string | null; id: string }) => m.title === ROTULO)?.id ?? null })

  // só desativa (nunca ativa: não vira fundo real) — o botão troca de nome na hora (title= virou tooltip próprio)
  await item.getByRole('button', { name: /^Desativar / }).click()
  await expect(item.getByRole('button', { name: /^Ativar / })).toBeVisible()
  await exigirSemRecarga(page, cargas, 'desativar mídia')

  await item.locator('button').last().click() // lixeira
  console.log(`[midia] diálogo de exclusão do padrão: ${await confirmarNoDialogo(page, /^Excluir mídia$/)}`)
  await expect(item).toHaveCount(0)
  await expect(itens).toHaveCount(antes)
  await exigirSemRecarga(page, cargas, 'excluir mídia')
  const depois = await (await page.request.get(`${SEND}/api/admin/media`)).json()
  expect(depois.some((m: { title: string | null }) => m.title === ROTULO), 'mídia sumiu no servidor').toBe(false)
  gravarEstado({ mediaId: null })
  v.exigirSemGraves()
})

test('sessão local expirada: volta pela ponte SSO ao painel, sem loop e sem cair na home da plataforma', async ({ page, context }) => {
  await page.goto(`${SEND}/dashboard`)
  await expect(page.getByRole('heading', { name: 'Meus envios' })).toBeVisible({ timeout: 30_000 })
  let idasAoSso = 0
  page.on('request', (r) => {
    if (r.url().includes(`${SEND}/api/sso/entrar`)) idasAoSso++
  })

  // some só o cookie do Send (o da plataforma continua): é a sessão local expirando no meio do uso
  await context.clearCookies({ name: /next-auth\.session-token$/ })
  // next-auth refaz a sessão ao voltar a visibilidade → status "unauthenticated"
  const saida = page.waitForRequest((r) => /\/send\/api\/sso\/entrar|\/login(\?|$)/.test(r.url()), { timeout: 30_000 })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  console.log(`[sso] primeira saída: ${(await saida).url()}`)
  await page.waitForLoadState('load').catch(() => {})
  let anterior = ''
  for (let i = 0; i < 20 && page.url() !== anterior; i++) {
    anterior = page.url()
    await page.waitForTimeout(1_500)
  }
  console.log(`[sso] destino final: ${page.url()} (idas à ponte: ${idasAoSso})`)
  expect(new URL(page.url()).pathname.replace(/\/$/, ''), 'volta ao painel do Send').toBe(`${SEND}/dashboard`)
  expect(idasAoSso, 'sem loop na ponte SSO').toBeLessThanOrEqual(2)
  await expect(page.getByRole('heading', { name: 'Meus envios' })).toBeVisible({ timeout: 30_000 })
})
