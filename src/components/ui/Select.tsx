'use client'

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OpcaoSelect<T extends string | number> {
  value: T
  label: string
  desabilitada?: boolean
}

interface SelectProps<T extends string | number> {
  /** id do botão-gatilho (alvo do <label htmlFor>). */
  id: string
  /** id do elemento que rotula o campo (o nome acessível vira "rótulo + valor"). */
  rotuloId: string
  value: T
  onChange: (valor: T) => void
  opcoes: readonly OpcaoSelect<T>[]
  disabled?: boolean
  placeholder?: string
  className?: string
}

// Padrão visual comum (PADRAO-UI-PROPRIA): lista até 320 px, 6 px do gatilho,
// 16 px de margem das bordas da janela, busca a partir de 9 opções.
const ALTURA_MAX = 320
const ALTURA_MIN = 120
const DISTANCIA = 6
const MARGEM = 16
const LARGURA_MAX = 560
const LIMITE_BUSCA = 8

/** Sem acento e sem caixa, para a busca. */
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Seleção do padrão da plataforma — no lugar do <select> nativo (cuja lista
 * aberta é UI do navegador/SO). Padrão WAI-ARIA "select-only combobox":
 * botão com aria-haspopup="listbox"/aria-expanded, lista role="listbox" com
 * role="option"/aria-selected e aria-activedescendant.
 *
 * A lista é renderizada em portal (position: fixed) para não ser cortada por
 * ancestrais com overflow e ficar acima dos modais. Rolar a PÁGINA reposiciona
 * a lista junto do gatilho; a rolagem da PRÓPRIA lista é ignorada pelo
 * listener (era o bug do ERP: o scroll da lista, capturado na janela,
 * disparava o reposicionamento que zerava a rolagem e a roda "não rolava").
 * O reposicionamento só escreve top/left/max-height — nunca mexe no scrollTop.
 *
 * Teclado: ↑/↓/Enter/Espaço abrem; na lista ↑/↓, Home/End, Enter (e Espaço
 * sem busca) escolhem, Esc fecha, Tab fecha, digitar pula para a opção (sem
 * busca) ou filtra (com busca, listas com mais de 8 opções). Com a lista
 * fechada, digitar no botão pula para a opção. Clique fora fecha. Ao escolher
 * ou fechar com Esc, o foco volta ao botão.
 */
export function Select<T extends string | number>({
  id,
  rotuloId,
  value,
  onChange,
  opcoes,
  disabled,
  placeholder = 'Selecione…',
  className,
}: SelectProps<T>) {
  const base = useId()
  const listaId = `${base}-lista`
  const idOpcao = (i: number) => `${base}-opcao-${i}`
  const comBusca = opcoes.length > LIMITE_BUSCA

  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0) // índice em `visiveis`
  const [termo, setTermo] = useState('')

  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const buscaRef = useRef<HTMLInputElement>(null)
  const typeahead = useRef({ texto: '', ate: 0 })
  // Lado decidido ao abrir (não "pula" de lado enquanto a página rola).
  const ladoRef = useRef<'cima' | 'baixo'>('baixo')
  // Só teclado/abertura trazem a opção ativa para a vista; o hover não (senão
  // a lista "puxaria" a rolagem enquanto a pessoa usa a roda do mouse).
  const revelarAtivo = useRef(false)
  // Espaço escolhe no keydown da lista e o foco volta ao botão; o keyup do
  // mesmo Espaço dispararia um "clique" de teclado no botão e reabriria.
  const fechouEm = useRef(0)

  const indiceSelecionado = opcoes.findIndex(o => o.value === value)
  const selecionada = indiceSelecionado >= 0 ? opcoes[indiceSelecionado] : undefined

  // Opções visíveis (filtradas pela busca), guardando o índice original.
  const visiveis = useMemo(() => {
    const t = normalizar(termo.trim())
    return opcoes
      .map((opcao, i) => ({ opcao, i }))
      .filter(({ opcao }) => !t || normalizar(opcao.label).includes(t))
  }, [opcoes, termo])

  const abrir = useCallback((indice?: number) => {
    if (disabled) return
    ladoRef.current = 'baixo'
    setTermo('')
    setAtivo(Math.max(0, indice ?? indiceSelecionado))
    revelarAtivo.current = true
    setAberto(true)
  }, [disabled, indiceSelecionado])

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false)
    fechouEm.current = Date.now()
    if (devolverFoco) gatilhoRef.current?.focus()
  }, [])

  const escolher = useCallback((posicao: number) => {
    const item = visiveis[posicao]
    if (!item || item.opcao.desabilitada) return
    if (item.opcao.value !== value) onChange(item.opcao.value)
    fechar(true)
  }, [visiveis, value, onChange, fechar])

  /**
   * Posiciona a lista (fixed) junto do gatilho. Escreve só estilos de
   * posição/tamanho direto no DOM — nada de re-render, nada de scrollTop.
   */
  const posicionar = useCallback((decidirLado: boolean) => {
    const gatilho = gatilhoRef.current
    const pop = popRef.current
    if (!gatilho || !pop) return
    const r = gatilho.getBoundingClientRect()
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight

    // Gatilho saiu da tela ao rolar: fecha em vez de deixar a lista solta.
    if (r.bottom < 0 || r.top > vh) {
      fechar(false)
      return
    }

    const abaixo = vh - r.bottom - DISTANCIA - 8
    const acima = r.top - DISTANCIA - 8
    if (decidirLado) {
      // Altura natural = busca + todas as opções (scrollHeight ignora o max-height).
      const natural = Math.min(
        ALTURA_MAX,
        (buscaRef.current?.parentElement?.offsetHeight ?? 0) + (listaRef.current?.scrollHeight ?? 0) + 10
      )
      ladoRef.current = abaixo < natural && acima > abaixo ? 'cima' : 'baixo'
      pop.dataset.lado = ladoRef.current
    }
    const paraCima = ladoRef.current === 'cima'
    const espaco = paraCima ? acima : abaixo
    pop.style.maxHeight = `${Math.max(ALTURA_MIN, Math.min(ALTURA_MAX, espaco))}px`

    if (paraCima) {
      pop.style.top = 'auto'
      pop.style.bottom = `${vh - r.top + DISTANCIA}px`
    } else {
      pop.style.bottom = 'auto'
      pop.style.top = `${r.bottom + DISTANCIA}px`
    }

    // Largura: mínimo = gatilho; máximo = min(560, janela − 32). Nunca passa da borda.
    const larguraMax = Math.min(LARGURA_MAX, vw - MARGEM * 2)
    pop.style.minWidth = `${Math.min(r.width, larguraMax)}px`
    pop.style.maxWidth = `${larguraMax}px`
    const largura = pop.offsetWidth
    let esquerda = r.left
    if (esquerda + largura > vw - MARGEM) esquerda = vw - MARGEM - largura
    pop.style.left = `${Math.max(MARGEM, esquerda)}px`
  }, [fechar])

  // Ao abrir (e quando a busca muda a altura): posiciona antes de pintar.
  useLayoutEffect(() => {
    if (!aberto) return
    posicionar(true)
  }, [aberto, posicionar])

  useLayoutEffect(() => {
    if (!aberto) return
    posicionar(false)
  }, [aberto, visiveis.length, posicionar])

  // Rolar a página / redimensionar: reposiciona (1x por quadro).
  useEffect(() => {
    if (!aberto) return
    let quadro = 0
    const agendar = () => {
      if (quadro) return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        posicionar(false)
      })
    }
    const aoRolar = (e: Event) => {
      // A rolagem da própria lista não é rolagem da página: ignora.
      const alvo = e.target
      if (alvo instanceof Node && popRef.current?.contains(alvo)) return
      agendar()
    }
    window.addEventListener('scroll', aoRolar, true)
    window.addEventListener('resize', agendar)
    return () => {
      window.removeEventListener('scroll', aoRolar, true)
      window.removeEventListener('resize', agendar)
      if (quadro) cancelAnimationFrame(quadro)
    }
  }, [aberto, posicionar])

  // Foco ao abrir: na busca (se houver) ou na lista.
  useEffect(() => {
    if (!aberto) return
    if (comBusca) buscaRef.current?.focus({ preventScroll: true })
    else listaRef.current?.focus({ preventScroll: true })
  }, [aberto, comBusca])

  // Mantém a opção ativa visível — rolando SÓ a lista (nunca a página).
  useLayoutEffect(() => {
    if (!aberto || !revelarAtivo.current) return
    revelarAtivo.current = false
    const lista = listaRef.current
    const el = document.getElementById(idOpcao(ativo))
    if (!lista || !el) return
    const topo = el.offsetTop - 4
    const fim = el.offsetTop + el.offsetHeight + 4
    if (topo < lista.scrollTop) lista.scrollTop = topo
    else if (fim > lista.scrollTop + lista.clientHeight) lista.scrollTop = fim - lista.clientHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, ativo, visiveis])

  // Clique/toque fora fecha (sem roubar o foco de onde a pessoa clicou).
  useEffect(() => {
    if (!aberto) return
    const aoApontar = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (gatilhoRef.current?.contains(alvo) || popRef.current?.contains(alvo)) return
      fechar(false)
    }
    document.addEventListener('pointerdown', aoApontar)
    return () => document.removeEventListener('pointerdown', aoApontar)
  }, [aberto, fechar])

  // Digitar para pular: acumula letras por ~0,5 s e busca pelo começo do rótulo.
  const pular = (tecla: string, inicio: number): number | null => {
    const agora = Date.now()
    const b = typeahead.current
    b.texto = (agora > b.ate ? '' : b.texto) + normalizar(tecla)
    b.ate = agora + 500
    const n = opcoes.length
    // Mesma letra repetida percorre as opções que começam com ela.
    const repetida = b.texto.length > 1 && b.texto.split('').every(c => c === b.texto[0])
    const alvo = repetida ? b.texto[0] : b.texto
    const desde = repetida || b.texto.length === 1 ? inicio + 1 : inicio
    for (let k = 0; k < n; k++) {
      const i = (desde + k) % n
      if (!opcoes[i].desabilitada && normalizar(opcoes[i].label).startsWith(alvo)) return i
    }
    return null
  }

  // Próxima opção habilitada a partir de `desde` no sentido `passo`.
  const proxima = (desde: number, passo: 1 | -1): number => {
    for (let p = desde; p >= 0 && p < visiveis.length; p += passo) {
      if (!visiveis[p].opcao.desabilitada) return p
    }
    return Math.min(Math.max(0, ativo), Math.max(0, visiveis.length - 1))
  }

  const mover = (posicao: number) => {
    revelarAtivo.current = true
    setAtivo(posicao)
  }

  const aoTeclarGatilho = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      abrir()
    } else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = pular(e.key, Math.max(0, indiceSelecionado))
      if (i !== null) {
        e.preventDefault()
        abrir(i)
      }
    }
  }

  const aoTeclarLista = (e: React.KeyboardEvent<HTMLElement>) => {
    const ultimo = visiveis.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        mover(proxima(Math.min(ultimo, ativo + 1), 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        mover(proxima(Math.max(0, ativo - 1), -1))
        break
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        mover(proxima(0, 1))
        break
      case 'End':
      case 'PageDown':
        e.preventDefault()
        mover(proxima(ultimo, -1))
        break
      case 'Enter':
        e.preventDefault()
        escolher(ativo)
        break
      case ' ':
        // Com busca, Espaço digita; sem busca, escolhe.
        if (comBusca) return
        e.preventDefault()
        escolher(ativo)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        fechar(true)
        break
      case 'Tab':
        // Deixa o Tab seguir o fluxo normal a partir do botão.
        setAberto(false)
        gatilhoRef.current?.focus()
        break
      default:
        if (!comBusca && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = pular(e.key, visiveis[ativo]?.i ?? 0)
          if (i !== null) {
            e.preventDefault()
            mover(i) // sem busca, visiveis === opcoes
          }
        }
    }
  }

  const ativoExiste = ativo >= 0 && ativo < visiveis.length
  const descendenteAtivo = ativoExiste ? idOpcao(ativo) : undefined

  const lista = aberto ? (
    <div
      ref={popRef}
      data-lado="baixo"
      className="superficie-flutuante entrada-flutuante fixed left-0 top-0 z-[70] flex max-h-[320px] flex-col overflow-hidden p-1"
    >
      {comBusca && (
        <div className="relative mb-1 shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            ref={buscaRef}
            type="text"
            role="combobox"
            aria-label="Buscar opção"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listaId}
            aria-activedescendant={descendenteAtivo}
            placeholder="Buscar…"
            autoComplete="off"
            spellCheck={false}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              revelarAtivo.current = true
              setAtivo(0)
              if (listaRef.current) listaRef.current.scrollTop = 0
            }}
            onKeyDown={aoTeclarLista}
            className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
          />
        </div>
      )}
      <ul
        ref={listaRef}
        id={listaId}
        role="listbox"
        tabIndex={-1}
        aria-labelledby={rotuloId}
        aria-activedescendant={comBusca ? undefined : descendenteAtivo}
        onKeyDown={aoTeclarLista}
        className="rolagem-fina relative min-h-0 flex-1 overflow-y-auto focus:outline-none"
      >
        {visiveis.map(({ opcao, i }, posicao) => {
          const marcada = i === indiceSelecionado
          return (
            <li
              key={String(opcao.value)}
              id={idOpcao(posicao)}
              role="option"
              aria-selected={marcada}
              aria-disabled={opcao.desabilitada || undefined}
              data-ativa={posicao === ativo}
              onPointerMove={() => { if (posicao !== ativo && !opcao.desabilitada) setAtivo(posicao) }}
              onMouseDown={(e) => e.preventDefault() /* não tira o foco da busca/lista */}
              onClick={() => escolher(posicao)}
              className="opcao-lista"
            >
              <span className="line-clamp-2 min-w-0 flex-1 break-words">{opcao.label}</span>
              {marcada && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </li>
          )
        })}
      </ul>
      {visiveis.length === 0 && (
        <p role="status" className="px-2.5 py-2 text-sm text-muted-foreground">Nenhum resultado</p>
      )}
    </div>
  ) : null

  return (
    <div className={cn('relative', className)}>
      <button
        ref={gatilhoRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-labelledby={`${rotuloId} ${id}`}
        onClick={(e) => {
          // detail === 0: clique sintético de teclado logo após fechar — ignora.
          if (!aberto && e.detail === 0 && Date.now() - fechouEm.current < 400) return
          if (aberto) fechar(true)
          else abrir()
        }}
        onKeyDown={aoTeclarGatilho}
        className={cn(
          'input w-full items-center justify-between gap-2 pr-3 text-left cursor-pointer',
          'focus-visible:ring-offset-2 ring-offset-background',
          aberto && 'border-primary ring-2 ring-ring ring-offset-2'
        )}
      >
        <span className={cn('truncate', !selecionada && 'text-muted-foreground')}>
          {selecionada?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-150', aberto && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {lista && createPortal(lista, document.body)}
    </div>
  )
}
