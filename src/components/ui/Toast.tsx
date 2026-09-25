'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

// Fecha sozinho em 5 s (pausa enquanto o ponteiro ou o foco estão no aviso).
const DURACAO = 5000

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

// Status só no ícone (16 px): verde sucesso, vermelho erro, texto2 info.
const ICONES: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-700 dark:text-red-400" />,
  info: <Info className="w-4 h-4 text-muted-foreground" />,
}

function ItemToast({ toast, onClose }: { toast: Toast; onClose: (id: string) => void }) {
  const reduzir = useReducedMotion()
  const restante = useRef(DURACAO)
  const inicio = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausas = useRef({ ponteiro: false, foco: false })

  const retomar = useCallback(() => {
    if (timer.current) return
    inicio.current = Date.now()
    timer.current = setTimeout(() => onClose(toast.id), restante.current)
  }, [onClose, toast.id])

  const pausar = useCallback(() => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    restante.current = Math.max(1000, restante.current - (Date.now() - inicio.current))
  }, [])

  useEffect(() => {
    retomar()
    return () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }
  }, [retomar])

  const atualizar = () => {
    const p = pausas.current
    if (p.ponteiro || p.foco) pausar()
    else retomar()
  }

  return (
    <motion.div
      layout={!reduzir}
      initial={reduzir ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduzir ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      role={toast.type === 'error' ? 'alert' : 'status'}
      onPointerEnter={() => { pausas.current.ponteiro = true; atualizar() }}
      onPointerLeave={() => { pausas.current.ponteiro = false; atualizar() }}
      onFocus={() => { pausas.current.foco = true; atualizar() }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        pausas.current.foco = false
        atualizar()
      }}
      className="superficie-flutuante pointer-events-auto flex items-start gap-3 py-3 pl-4 pr-2"
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0">{ICONES[toast.type]}</span>
      <span className="min-w-0 flex-1 py-px text-sm font-medium leading-5 text-foreground break-words">
        {toast.message}
      </span>
      <button
        type="button"
        onClick={() => onClose(toast.id)}
        aria-label="Fechar aviso"
        className="-my-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--realce-opcao)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Canto inferior direito; no celular, largura total com margem de 16 px. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[380px]">
        <AnimatePresence>
          {toasts.map(toast => (
            <ItemToast key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function Toaster() {
  return null // Using context-based approach instead
}

// Simple export for standalone use
export function toast(message: string, type: ToastType = 'info') {
  // This will be replaced by context in actual usage
  console.log(`Toast [${type}]: ${message}`)
}
