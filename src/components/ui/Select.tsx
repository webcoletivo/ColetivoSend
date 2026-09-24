'use client'

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OpcaoSelect<T extends string | number> {
  value: T
  label: string
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
  className?: string
}

// Altura estimada da lista para decidir se abre para cima (sem espaço abaixo).
const ALTURA_LISTA = 240

/**
 * Seleção do padrão da plataforma — no lugar do <select> nativo (cuja lista
 * aberta é UI do navegador/SO). Padrão WAI-ARIA "select-only combobox":
 * botão com aria-haspopup="listbox"/aria-expanded, lista role="listbox" com
 * role="option"/aria-selected e aria-activedescendant.
 *
 * Teclado: ↑/↓/Enter/Espaço abrem; na lista ↑/↓, Home/End, Enter/Espaço
 * escolhem, Esc fecha, Tab fecha, digitar pula para a opção. Clique fora
 * fecha. Ao escolher ou fechar com Esc, o foco volta ao botão.
 */
export function Select<T extends string | number>({
  id,
  rotuloId,
  value,
  onChange,
  opcoes,
  disabled,
  className,
}: SelectProps<T>) {
  const base = useId()
  const listaId = `${base}-lista`
  const idOpcao = (i: number) => `${base}-opcao-${i}`

  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [paraCima, setParaCima] = useState(false)

  const raizRef = useRef<HTMLDivElement>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const busca = useRef({ texto: '', ate: 0 })
  // Espaço escolhe no keydown da lista e o foco volta ao botão; o keyup do
  // mesmo Espaço dispararia um "clique" de teclado no botão e reabriria.
  const fechouEm = useRef(0)

  const indiceSelecionado = Math.max(0, opcoes.findIndex(o => o.value === value))
  const selecionada = opcoes[indiceSelecionado]

  const abrir = useCallback((indice?: number) => {
    if (disabled) return
    const r = gatilhoRef.current?.getBoundingClientRect()
    if (r) {
      const abaixo = window.innerHeight - r.bottom
      setParaCima(abaixo < ALTURA_LISTA && r.top > abaixo)
    }
    setAtivo(indice ?? indiceSelecionado)
    setAberto(true)
  }, [disabled, indiceSelecionado])

  const fechar = useCallback((devolverFoco: boolean) => {
    setAberto(false)
    fechouEm.current = Date.now()
    if (devolverFoco) gatilhoRef.current?.focus()
  }, [])

  const escolher = useCallback((i: number) => {
    const opcao = opcoes[i]
    if (opcao && opcao.value !== value) onChange(opcao.value)
    fechar(true)
  }, [opcoes, value, onChange, fechar])

  // Lista aberta recebe o foco (aria-activedescendant aponta a opção ativa).
  useEffect(() => {
    if (aberto) listaRef.current?.focus()
  }, [aberto])

  // Mantém a opção ativa visível na lista.
  useEffect(() => {
    if (!aberto) return
    document.getElementById(idOpcao(ativo))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, ativo])

  // Clique/toque fora fecha (sem roubar o foco de onde a pessoa clicou).
  useEffect(() => {
    if (!aberto) return
    const aoApontar = (e: PointerEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) fechar(false)
    }
    document.addEventListener('pointerdown', aoApontar)
    return () => document.removeEventListener('pointerdown', aoApontar)
  }, [aberto, fechar])

  // Digitar para pular: acumula letras por ~0,5 s e busca pelo começo do rótulo.
  const pular = (tecla: string, inicio: number): number | null => {
    const agora = Date.now()
    const b = busca.current
    b.texto = (agora > b.ate ? '' : b.texto) + tecla.toLowerCase()
    b.ate = agora + 500
    const n = opcoes.length
    // Mesma letra repetida percorre as opções que começam com ela.
    const repetida = b.texto.length > 1 && b.texto.split('').every(c => c === b.texto[0])
    const alvo = repetida ? b.texto[0] : b.texto
    const desde = repetida || b.texto.length === 1 ? inicio + 1 : inicio
    for (let k = 0; k < n; k++) {
      const i = (desde + k) % n
      if (opcoes[i].label.toLowerCase().startsWith(alvo)) return i
    }
    return null
  }

  const aoTeclarGatilho = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      abrir()
    } else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = pular(e.key, indiceSelecionado)
      if (i !== null) {
        e.preventDefault()
        abrir(i)
      }
    }
  }

  const aoTeclarLista = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const ultimo = opcoes.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setAtivo(a => Math.min(ultimo, a + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setAtivo(a => Math.max(0, a - 1))
        break
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        setAtivo(0)
        break
      case 'End':
      case 'PageDown':
        e.preventDefault()
        setAtivo(ultimo)
        break
      case 'Enter':
      case ' ':
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
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = pular(e.key, ativo)
          if (i !== null) {
            e.preventDefault()
            setAtivo(i)
          }
        }
    }
  }

  return (
    <div ref={raizRef} className={cn('relative', className)}>
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
          aberto && 'border-primary ring-2 ring-ring'
        )}
      >
        <span className="truncate">{selecionada?.label}</span>
        <ChevronDown
          className={cn('w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <ul
          ref={listaRef}
          id={listaId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={rotuloId}
          aria-activedescendant={idOpcao(ativo)}
          onKeyDown={aoTeclarLista}
          className={cn(
            'absolute right-0 z-50 min-w-full max-h-60 overflow-auto rounded-lg border border-border',
            'bg-popover p-1 text-sm text-popover-foreground shadow-lg focus:outline-none',
            paraCima ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          {opcoes.map((opcao, i) => {
            const marcada = i === indiceSelecionado
            return (
              <li
                key={String(opcao.value)}
                id={idOpcao(i)}
                role="option"
                aria-selected={marcada}
                onPointerMove={() => setAtivo(i)}
                onClick={() => escolher(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 py-2',
                  i === ativo && 'bg-muted',
                  marcada ? 'font-semibold text-foreground' : 'text-foreground'
                )}
              >
                <span>{opcao.label}</span>
                {marcada && <Check className="w-4 h-4 text-primary" aria-hidden="true" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
