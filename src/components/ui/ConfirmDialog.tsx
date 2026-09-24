'use client'

import React, { useEffect, useId, useRef } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

/**
 * Diálogo de confirmação do padrão da plataforma (no lugar do confirm()
 * nativo): título em pergunta, consequência explicada, "Não dá para desfazer"
 * quando for o caso. Acessível: role=alertdialog, foco entra no "Cancelar",
 * Esc cancela, Tab circula só entre os dois botões, clique fora cancela.
 */
interface ConfirmDialogProps {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    cancelLabel?: string
    /** Variante do botão de confirmar (destrutivo por padrão). */
    variant?: 'danger' | 'primary'
    busy?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = 'Cancelar',
    variant = 'danger',
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const tituloId = useId()
    const descricaoId = useId()
    const cancelarRef = useRef<HTMLButtonElement>(null)
    const confirmarRef = useRef<HTMLButtonElement>(null)
    const focoAnterior = useRef<HTMLElement | null>(null)

    // Foco entra no diálogo ao abrir e volta para onde estava ao fechar.
    useEffect(() => {
        if (!open) return
        focoAnterior.current = document.activeElement as HTMLElement | null
        cancelarRef.current?.focus()
        return () => {
            focoAnterior.current?.focus?.()
        }
    }, [open])

    if (!open) return null

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault()
            if (!busy) onCancel()
            return
        }
        if (e.key === 'Tab') {
            // só dois pontos de foco: circula entre eles
            e.preventDefault()
            const alvo = document.activeElement === cancelarRef.current ? confirmarRef.current : cancelarRef.current
            alvo?.focus()
        }
    }

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onCancel()
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby={tituloId}
                aria-describedby={descricaoId}
                onKeyDown={onKeyDown}
                className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-6 space-y-5 animate-scale-in"
            >
                <div className="flex items-start gap-4">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                        <h2 id={tituloId} className="text-lg font-semibold text-foreground leading-snug">
                            {title}
                        </h2>
                        <p id={descricaoId} className="text-sm text-muted-foreground leading-relaxed">
                            {description}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <Button ref={cancelarRef} type="button" variant="secondary" onClick={onCancel} disabled={busy}>
                        {cancelLabel}
                    </Button>
                    <Button
                        ref={confirmarRef}
                        type="button"
                        variant={variant}
                        onClick={onConfirm}
                        disabled={busy}
                        icon={busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : undefined}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    )
}
