'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Menu "…" acessível (padrão WAI-ARIA menu button): gatilho com
 * aria-haspopup/aria-expanded, lista role=menu com itens role=menuitem,
 * setas/Home/End movem o foco, Esc ou Tab fecham e devolvem o foco ao
 * gatilho, clique fora fecha. Itens podem ser link (abre em nova guia) ou
 * ação; `tom` só muda a cor (aviso/perigo).
 */
export interface ItemMenuAcoes {
    label: string
    icon?: React.ReactNode
    onSelect?: () => void
    href?: string
    tom?: 'normal' | 'aviso' | 'perigo'
}

interface MenuAcoesProps {
    label: string
    items: ItemMenuAcoes[]
    /** Controle externo (opcional): útil para fechar após uma ação assíncrona. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string
}

const TONS: Record<NonNullable<ItemMenuAcoes['tom']>, string> = {
    normal: 'text-foreground hover:bg-muted focus-visible:bg-muted',
    aviso: 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 focus-visible:bg-amber-500/10',
    perigo: 'text-red-700 dark:text-red-400 hover:bg-red-500/10 focus-visible:bg-red-500/10',
}

export function MenuAcoes({ label, items, open: openProp, onOpenChange, className }: MenuAcoesProps) {
    const [openInterno, setOpenInterno] = useState(false)
    const open = openProp ?? openInterno
    const setOpen = (v: boolean) => {
        setOpenInterno(v)
        onOpenChange?.(v)
    }

    const menuId = useId()
    const gatilhoRef = useRef<HTMLButtonElement>(null)
    const raizRef = useRef<HTMLDivElement>(null)
    const itensRef = useRef<(HTMLElement | null)[]>([])

    // Ao abrir, foco no primeiro item; clique fora fecha.
    useEffect(() => {
        if (!open) return
        itensRef.current[0]?.focus()
        const fora = (e: MouseEvent) => {
            if (!raizRef.current?.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', fora)
        return () => document.removeEventListener('mousedown', fora)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const fechar = (devolverFoco = true) => {
        setOpen(false)
        if (devolverFoco) gatilhoRef.current?.focus()
    }

    const moverFoco = (delta: number) => {
        const lista = itensRef.current.filter(Boolean) as HTMLElement[]
        if (!lista.length) return
        const atual = lista.indexOf(document.activeElement as HTMLElement)
        const proximo = atual === -1 ? 0 : (atual + delta + lista.length) % lista.length
        lista[proximo].focus()
    }

    const onKeyDownMenu = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                moverFoco(1)
                break
            case 'ArrowUp':
                e.preventDefault()
                moverFoco(-1)
                break
            case 'Home':
                e.preventDefault()
                itensRef.current[0]?.focus()
                break
            case 'End':
                e.preventDefault()
                itensRef.current[itensRef.current.length - 1]?.focus()
                break
            case 'Escape':
                e.preventDefault()
                fechar()
                break
            case 'Tab':
                fechar(false)
                break
        }
    }

    const onKeyDownGatilho = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
        }
    }

    return (
        <div ref={raizRef} className={cn('relative', className)}>
            <IconButton
                ref={gatilhoRef}
                type="button"
                variant="ghost"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen(!open)}
                onKeyDown={onKeyDownGatilho}
            >
                <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            </IconButton>

            {open && (
                <motion.div
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.12 }}
                    onKeyDown={onKeyDownMenu}
                    className="absolute right-0 top-full mt-1 w-48 bg-popover text-popover-foreground rounded-xl shadow-lg border border-border py-2 z-20"
                >
                    {items.map((item, i) => {
                        const classes = cn(
                            'w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors outline-none',
                            TONS[item.tom ?? 'normal'],
                        )
                        if (item.href) {
                            return (
                                <a
                                    key={item.label}
                                    ref={(el) => { itensRef.current[i] = el }}
                                    role="menuitem"
                                    tabIndex={-1}
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={classes}
                                    onClick={() => fechar(false)}
                                >
                                    {item.icon}
                                    {item.label}
                                </a>
                            )
                        }
                        return (
                            <button
                                key={item.label}
                                ref={(el) => { itensRef.current[i] = el }}
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                className={classes}
                                onClick={() => {
                                    fechar()
                                    item.onSelect?.()
                                }}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        )
                    })}
                </motion.div>
            )}
        </div>
    )
}
