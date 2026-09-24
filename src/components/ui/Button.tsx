'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  ...props
}, ref) {
  // Vocabulário canônico do sistema unificado: sólidos, theme-aware via
  // tokens, sem gradiente/glow/translate/scale. Foco sempre com ring laranja.
  // Texto sobre laranja é escuro (--primary-foreground) nos dois temas.
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-400',
    secondary: 'bg-card text-foreground border border-border hover:bg-muted',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  }

  // Tokens: h-10 px-5 rounded-xl (md); sm/lg mantêm o mesmo raio.
  const sizes = {
    sm: 'h-9 px-4 text-sm rounded-lg gap-1.5',
    md: 'h-10 px-5 text-sm rounded-xl gap-2',
    lg: 'h-11 px-6 text-base rounded-xl gap-2.5',
  }

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>Aguarde...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  )
})

export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(function IconButton({
  children,
  variant = 'ghost',
  className,
  type = 'button',
  ...props
}, ref) {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-400',
    secondary: 'bg-card text-foreground border border-border hover:bg-muted',
    ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'text-destructive hover:bg-destructive/10',
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'p-2.5 rounded-lg transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})
