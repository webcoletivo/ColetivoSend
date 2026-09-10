'use client'

import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  // loading prop is already used by some libraries/elements ? no, but just in case
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  ...props
}: ButtonProps) {
  // Padrão de botão do sistema unificado: primário laranja sólido com texto
  // escuro, sem gradiente nem glow (mesma linguagem da plataforma e da
  // página pública de download).
  const variants = {
    primary: `
      bg-[#FF6B1F] text-[#131211]
      hover:bg-[#FF8340]
      focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF6B1F]
    `,
    secondary: `
      bg-card text-foreground border border-border
      hover:bg-muted
    `,
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: `
      bg-[#E5484D] text-white
      hover:bg-[#F0665C]
    `,
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm rounded-lg gap-1.5',
    md: 'px-6 py-3 text-sm rounded-xl gap-2',
    lg: 'px-8 py-4 text-base rounded-xl gap-2.5',
  }

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-300 ease-out disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Aguarde...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </motion.button>
  )
}

export function IconButton({
  children,
  variant = 'ghost',
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 dark:bg-slate-800 dark:border dark:border-white/10 dark:hover:bg-slate-700',
    secondary: 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800',
    ghost: 'text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100',
    danger: 'text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/20',
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={cn(
        'p-2.5 rounded-lg transition-all duration-200',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
