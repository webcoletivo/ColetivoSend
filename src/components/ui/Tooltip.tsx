'use client'

import React, { useEffect, useState } from 'react'
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

/**
 * Dica (tooltip) do padrão da plataforma — no lugar do `title=` nativo.
 *
 * - Abre no hover (mouse/caneta) e no foco por teclado (:focus-visible);
 *   toque não abre (evita dica "presa" no celular).
 * - Esc fecha (WCAG 1.4.13); não captura o ponteiro.
 * - É só visual: o nome acessível continua no `aria-label` do botão/link,
 *   por isso a dica fica `aria-hidden` (sem leitura duplicada).
 * - Só é renderizada aberta, para não gerar rolagem horizontal perto das bordas.
 */
export function Tooltip({ texto, lado = 'cima', alinhar = 'centro', children, className }: TooltipProps) {
  const [aberto, setAberto] = useState(false)

  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [aberto])

  return (
    <span
      className={cn('relative inline-flex', className)}
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setAberto(true) }}
      onPointerLeave={() => setAberto(false)}
      onFocus={(e) => {
        const alvo = e.target as HTMLElement
        // Foco por clique não abre a dica; só o foco visível (teclado).
        try { if (alvo.matches(':focus-visible')) setAberto(true) } catch { /* navegador antigo */ }
      }}
      onBlur={() => setAberto(false)}
    >
      {children}
      {aberto && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border',
            'bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md',
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
