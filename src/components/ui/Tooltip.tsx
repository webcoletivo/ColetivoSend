'use client'

import React, { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  /** Texto curto exibido na dica (o nome acessível continua no aria-label do filho). */
  texto: string
  /** Lado em que a dica aparece em relação ao gatilho. */
  lado?: 'cima' | 'baixo'
  /** 'centro' centraliza sobre o gatilho; 'fim' alinha pela direita (gatilho encostado na borda). */
  alinhar?: 'centro' | 'fim'
  children: React.ReactNode
  className?: string
}

// Atraso do hover (padrão comum a todos os sistemas); foco por teclado é imediato.
const ATRASO_HOVER = 350

/**
 * Dica (tooltip) do padrão da plataforma — no lugar do `title=` nativo.
 * Visual invertido (fundo escuro no claro, claro no escuro), sem borda.
 *
 * - Abre no hover (mouse/caneta, após 350 ms) e no foco por teclado
 *   (:focus-visible, na hora); toque não abre (evita dica "presa" no celular).
 * - Some no Esc (WCAG 1.4.13), clique, blur e rolagem; não captura o ponteiro.
 * - É só visual: o nome acessível continua no `aria-label` do botão/link,
 *   por isso a dica fica `aria-hidden` (sem leitura duplicada).
 * - Só é renderizada aberta, para não gerar rolagem horizontal perto das bordas.
 */
export function Tooltip({ texto, lado = 'cima', alinhar = 'centro', children, className }: TooltipProps) {
  const [aberto, setAberto] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelar = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  const fechar = () => {
    cancelar()
    setAberto(false)
  }

  useEffect(() => cancelar, [])

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    const aoRolar = () => setAberto(false)
    document.addEventListener('keydown', aoTeclar)
    window.addEventListener('scroll', aoRolar, true)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      window.removeEventListener('scroll', aoRolar, true)
    }
  }, [aberto])

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return
        cancelar()
        timer.current = setTimeout(() => setAberto(true), ATRASO_HOVER)
      }}
      onPointerLeave={fechar}
      onPointerDown={fechar}
      onFocus={(e) => {
        const alvo = e.target as HTMLElement
        // Foco por clique não abre a dica; só o foco visível (teclado).
        try {
          if (alvo.matches(':focus-visible')) {
            cancelar()
            setAberto(true)
          }
        } catch { /* navegador antigo */ }
      }}
      onBlur={fechar}
    >
      {children}
      {aberto && (
        <span
          aria-hidden="true"
          className={cn(
            'dica pointer-events-none absolute z-[70] w-max whitespace-normal text-left',
            lado === 'cima' ? 'bottom-full mb-2' : 'top-full mt-2',
            alinhar === 'centro' ? 'left-1/2 -translate-x-1/2' : 'right-0'
          )}
        >
          {texto}
        </span>
      )}
    </span>
  )
}
