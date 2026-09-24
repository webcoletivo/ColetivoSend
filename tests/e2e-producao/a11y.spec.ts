import { test, expect, type Page } from '@playwright/test'
import { SEND, entrarNoSend, linhasDoPainel, botaoMenu, itemMenu } from './apoio'

/**
 * Acessibilidade e contraste do Send, contra produção, nos dois temas.
 * Responde aos achados da auditoria de 2026-09-23 (seção 3.4 e item 5 da
 * usabilidade):
 *  - 0 botões/links-ícone sem nome acessível (fora da barra da plataforma);
 *  - 0 campos visíveis sem rótulo (label associado ou aria-label);
 *  - contraste mínimo WCAG AA nos pares citados ("clique para selecionar",
 *    "Até 10 GB", "Meus envios", texto sobre laranja, rótulos mono);
 *  - menu "…" com papéis ARIA e teclado; exclusão em diálogo do padrão
 *    (e o "Cancelar" não apaga nada).
 *
 * O tema é forçado pela classe do <html> (mesmo mecanismo da barra), então
 * cada tela é medida no claro e no escuro. Nada é criado nem apagado.
 */

type Tema = 'light' | 'dark'
const TEMAS: Tema[] = ['light', 'dark']

async function aplicarTema(page: Page, tema: Tema) {
  await page.evaluate((t) => {
    const html = document.documentElement
    html.classList.remove('light', 'dark')
    html.classList.add(t)
    html.style.colorScheme = t
  }, tema)
  await page.waitForTimeout(250) // transições de cor
}

/** Botões e links-ícone visíveis sem nome acessível (ignora a barra da plataforma). */
function semNome(page: Page) {
  return page.evaluate(() => {
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const texto = (el: Element) => ((el as HTMLElement).innerText || '').trim()
    const nome = (b: Element) =>
      (
        b.getAttribute('aria-label') ||
        b.getAttribute('title') ||
        texto(b) ||
        b.querySelector('img[alt]')?.getAttribute('alt') ||
        b.querySelector('svg[aria-label]')?.getAttribute('aria-label') ||
        b.querySelector('svg title')?.textContent ||
        (b.getAttribute('aria-labelledby') ? 'labelledby' : '') ||
        (b instanceof HTMLInputElement ? b.value : '') ||
        ''
      ).trim()
    const candidatos = Array.from(
      document.querySelectorAll('button, [role="button"], a[href], input[type="submit"]'),
    ).filter((b) => !b.closest('#gc-barra, [id^="gc-"]') && visivel(b))
    return candidatos
      .filter((b) => !nome(b))
      .map((b) => b.outerHTML.replace(/\s+/g, ' ').slice(0, 140))
  })
}

/** Campos visíveis sem rótulo: nem <label for>, nem label envolvente, nem aria-label(ledby). */
function camposSemRotulo(page: Page) {
  return page.evaluate(() => {
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const campos = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea',
      ),
    ).filter((c) => !c.closest('#gc-barra, [id^="gc-"]') && visivel(c))
    return campos
      .filter((c) => {
        const id = c.id
        const porFor = id && document.querySelector(`label[for="${CSS.escape(id)}"]`)
        const envolvente = c.closest('label')
        const aria = c.getAttribute('aria-label') || c.getAttribute('aria-labelledby')
        return !porFor && !envolvente && !aria
      })
      .map((c) => c.outerHTML.replace(/\s+/g, ' ').slice(0, 140))
  })
}

interface Contraste {
  texto: string
  cor: string
  fundo: string
  razao: number
  px: number
  minimo: number
}

/**
 * Contraste do texto de um elemento contra o fundo efetivo: compõe as cores de
 * fundo dos ancestrais (alpha) até achar uma opaca; se chegar ao <html> sem
 * fundo opaco (tela sobre foto/vídeo), mede contra preto E branco e devolve o
 * pior caso — assim a pílula do cabeçalho tem de ser legível sobre qualquer mídia.
 */
async function contrasteDe(page: Page, seletor: string, filtroTexto?: RegExp): Promise<Contraste> {
  return page.evaluate(
    ({ seletor, filtro }) => {
      const parse = (s: string) => {
        const m = s.match(/rgba?\(([^)]+)\)/)
        if (!m) return null
        const [r, g, b, a = '1'] = m[1].split(/[\s,\/]+/).filter(Boolean)
        return { r: +r, g: +g, b: +b, a: +a }
      }
      type Cor = { r: number; g: number; b: number; a: number }
      const lum = (c: Cor) => {
        const f = (v: number) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
      }
      const razao = (a: Cor, b: Cor) => {
        const l1 = lum(a)
        const l2 = lum(b)
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      }
      const hex = (c: Cor) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
      const sobre = (topo: Cor, base: Cor): Cor => ({
        r: topo.r * topo.a + base.r * (1 - topo.a),
        g: topo.g * topo.a + base.g * (1 - topo.a),
        b: topo.b * topo.a + base.b * (1 - topo.a),
        a: 1,
      })

      const todos = Array.from(document.querySelectorAll<HTMLElement>(seletor))
      const el = filtro
        ? todos.find((e) => new RegExp(filtro.source, filtro.flags).test((e.innerText || '').trim()))
        : todos[0]
      if (!el) throw new Error(`elemento não encontrado: ${seletor}`)

      const cs = getComputedStyle(el)
      const corTxt = parse(cs.color)!
      // pilha de camadas translúcidas até um fundo opaco
      const camadas: Cor[] = []
      let opaco: Cor | null = null
      let no: HTMLElement | null = el
      while (no) {
        const bg = parse(getComputedStyle(no).backgroundColor)
        if (bg && bg.a > 0) {
          if (bg.a >= 0.99) {
            opaco = bg
            break
          }
          camadas.push(bg)
        }
        no = no.parentElement
      }
      const compor = (base: Cor) => camadas.reduceRight((acc, camada) => sobre(camada, acc), base)
      let fundo: Cor
      let r: number
      if (opaco) {
        fundo = compor(opaco)
        r = razao(corTxt, fundo)
      } else {
        const preto = compor({ r: 0, g: 0, b: 0, a: 1 })
        const branco = compor({ r: 255, g: 255, b: 255, a: 1 })
        const rp = razao(corTxt, preto)
        const rb = razao(corTxt, branco)
        fundo = rp < rb ? preto : branco
        r = Math.min(rp, rb)
      }
      const px = parseFloat(cs.fontSize)
      const peso = parseInt(cs.fontWeight, 10) || 400
      const grande = px >= 24 || (px >= 18.66 && peso >= 700)
      return {
        texto: (el.innerText || '').trim().slice(0, 40),
        cor: hex(corTxt),
        fundo: hex(fundo),
        razao: +r.toFixed(2),
        px,
        minimo: grande ? 3 : 4.5,
      }
    },
    { seletor, filtro: filtroTexto ? { source: filtroTexto.source, flags: filtroTexto.flags } : null },
  )
}

async function exigirContraste(page: Page, rotulo: string, seletor: string, filtro?: RegExp) {
  const c = await contrasteDe(page, seletor, filtro)
  console.log(`  ${rotulo}: "${c.texto}" ${c.cor} sobre ${c.fundo} = ${c.razao} (${c.px}px, mín ${c.minimo})`)
  expect(c.razao, `${rotulo}: contraste "${c.texto}" ${c.cor}/${c.fundo}`).toBeGreaterThanOrEqual(c.minimo)
}

for (const tema of TEMAS) {
  test(`home (${tema}): nomes, rótulos e contraste do formulário de envio`, async ({ page }) => {
    await page.goto(`${SEND}/`)
    await expect(page.getByRole('heading', { name: 'Enviar arquivos' })).toBeVisible({ timeout: 30_000 })
    await aplicarTema(page, tema)

    expect(await semNome(page), 'controles sem nome acessível').toEqual([])
    expect(await camposSemRotulo(page), 'campos sem rótulo').toEqual([])

    console.log(`[home ${tema}]`)
    await exigirContraste(page, 'clique para selecionar', 'p span', /clique para selecionar/)
    await exigirContraste(page, 'Até 10 GB', 'p', /^Até 10 GB/)
    await exigirContraste(page, 'Meus envios (pílula sobre a mídia)', 'header a', /Meus envios/)

    // com um arquivo, aparecem os campos: todos rotulados e o botão primário legível
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'a11y-nao-enviado.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('arquivo só para abrir o formulário — não é enviado\n'),
    })
    await expect(page.getByRole('button', { name: 'Transferir Arquivos' })).toBeVisible()
    expect(await camposSemRotulo(page), 'campos do formulário sem rótulo').toEqual([])
    expect(await semNome(page), 'controles do formulário sem nome').toEqual([])
    for (const rotulo of [/E-mail para/, /^Mensagem/, /Expira em/]) {
      await expect(page.getByLabel(rotulo).first(), `campo "${rotulo}" acessível por rótulo`).toBeVisible()
    }
    await exigirContraste(page, 'botão primário (texto sobre laranja)', 'button', /Transferir Arquivos/)

    // e-mail pendente: vírgula digitada vira chip; inválido é barrado com aviso (sem enviar)
    const destinatario = page.getByLabel(/E-mail para/)
    await destinatario.pressSequentially('a11y@exemplo.com,')
    await expect(page.getByRole('button', { name: 'Remover a11y@exemplo.com' })).toBeVisible()
    await destinatario.fill('sem-arroba')
    await page.getByRole('button', { name: 'Transferir Arquivos' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /inválido/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enviar arquivos' })).toBeVisible() // continua no formulário
  })

  test(`painel (${tema}): nomes, contraste, menu "…" com papéis e diálogo de exclusão cancelável`, async ({ page }) => {
    await page.goto(`${SEND}/dashboard`)
    await expect(page.getByRole('heading', { name: 'Meus envios' })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('main .card').first()).toBeVisible({ timeout: 30_000 })
    await aplicarTema(page, tema)

    expect(await semNome(page), 'controles sem nome acessível').toEqual([])
    expect(await camposSemRotulo(page), 'campos sem rótulo').toEqual([])

    console.log(`[painel ${tema}]`)
    await exigirContraste(page, 'título Meus envios', 'h1', /Meus envios/)
    await exigirContraste(page, 'rótulo mono', 'p', /^Resumo$/)
    await exigirContraste(page, 'Novo envio (texto sobre laranja)', 'main a', /Novo envio/)
    const mono = await page.locator('p', { hasText: /^Resumo$/ }).evaluate((el) => {
      const cs = getComputedStyle(el)
      return { fonte: cs.fontFamily, px: parseFloat(cs.fontSize) }
    })
    console.log(`  rótulo mono: ${mono.px}px ${mono.fonte.slice(0, 60)}`)
    expect(mono.fonte, 'rótulo em JetBrains Mono').toMatch(/JetBrains/i)
    expect(mono.px, 'rótulo mono a 11px').toBeCloseTo(11, 0)

    const linhas = linhasDoPainel(page)
    const quantas = await linhas.count()
    if (quantas === 0) {
      console.log('  sem envios no painel: menu/diálogo não testados nesta rodada')
      return
    }
    const linha = linhas.first()

    // menu "…": papéis, foco no primeiro item, setas, Esc devolve o foco ao gatilho
    const gatilho = botaoMenu(linha)
    await expect(gatilho).toHaveAttribute('aria-haspopup', 'menu')
    await gatilho.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(gatilho).toHaveAttribute('aria-expanded', 'true')
    const itens = menu.getByRole('menuitem')
    expect(await itens.count(), 'itens do menu com role=menuitem').toBeGreaterThanOrEqual(2)
    await expect(itens.first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(itens.nth(1)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(gatilho).toBeFocused()

    // Excluir abre diálogo do padrão; Cancelar fecha sem apagar
    await gatilho.click()
    await itemMenu(linha, 'Excluir').click()
    const dialogo = page.getByRole('alertdialog')
    await expect(dialogo).toBeVisible()
    await expect(dialogo).toContainText(/Não dá para desfazer/)
    await expect(dialogo.getByRole('button', { name: 'Cancelar' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialogo).toHaveCount(0)
    await expect(linhas, 'cancelar não apaga nada').toHaveCount(quantas)
  })

  test(`mídia (${tema}): 8 botões-ícone nomeados, campos rotulados e "Adicionar mídia" legível`, async ({ page }) => {
    await entrarNoSend(page)
    const sonda = await page.request.get(`${SEND}/api/admin/media`, { failOnStatusCode: false })
    test.skip(sonda.status() === 401 || sonda.status() === 403, 'usuário sem papel de admin no Send')
    await page.goto(`${SEND}/settings/media`)
    await expect(page.getByRole('heading', { name: 'Mídia de Fundo' })).toBeVisible({ timeout: 30_000 })
    await aplicarTema(page, tema)

    const anonimos = await semNome(page)
    console.log(`[mídia ${tema}] botões-ícone sem nome: ${anonimos.length}`)
    expect(anonimos, 'controles sem nome acessível').toEqual([])

    await exigirContraste(page, 'Adicionar mídia (texto sobre laranja)', 'button', /Adicionar mídia/)
    await exigirContraste(page, 'item ativo da navegação', 'aside a', /Mídia de Fundo/)
    await exigirContraste(page, 'descrição do item ativo', 'aside a p', /Gerenciar background/)

    await page.getByRole('button', { name: 'Adicionar mídia' }).click()
    await expect(page.getByLabel('Arquivo')).toBeVisible()
    expect(await camposSemRotulo(page), 'campos do formulário de mídia sem rótulo').toEqual([])
    await page.getByRole('button', { name: 'Cancelar' }).click()
  })
}
