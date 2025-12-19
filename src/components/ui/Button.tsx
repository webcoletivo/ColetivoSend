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
  const variants = {
    primary: `
      bg-gradient-to-r from-primary-500 to-primary-600 text-white 
      shadow-lg shadow-primary-500/25 
      hover:shadow-xl hover:shadow-primary-500/30 hover:-translate-y-0.5
      dark:from-slate-800 dark:to-slate-900 dark:border dark:border-white/10 dark:shadow-glow/20
      dark:hover:from-slate-700 dark:hover:to-slate-800 dark:hover:border-white/20
    `,
    secondary: `
      bg-card text-card-foreground border border-border shadow-sm 
      hover:shadow-md hover:bg-accent/5 hover:-translate-y-0.5 
      dark:bg-slate-900 dark:text-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/80
    `,
    ghost: 'text-muted-foreground hover:bg-accent/10 hover:text-foreground dark:hover:bg-white/5',
    danger: `
      bg-gradient-to-r from-red-500 to-red-600 text-white 
      shadow-lg shadow-red-500/25 
      hover:shadow-xl hover:shadow-red-500/30 hover:-translate-y-0.5
      dark:from-red-900/40 dark:to-red-950/40 dark:border dark:border-red-500/20
      dark:hover:from-red-800/40 dark:hover:to-red-900/40
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
