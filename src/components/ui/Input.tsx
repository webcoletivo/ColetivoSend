'use client'

import React from 'react'
import { cn } from '@/lib/utils'

// Vocabulário canônico de campos do sistema unificado: h-10, rounded-lg,
// bg-card, border-border e foco com ring laranja (theme-aware nos dois temas).
const fieldBase =
  'w-full rounded-lg border bg-card text-foreground placeholder:text-muted-foreground transition-colors duration-200 focus:outline-none focus:ring-2 disabled:bg-muted disabled:cursor-not-allowed'

const fieldFocus = 'border-border focus:border-primary focus:ring-ring'
const fieldError = 'border-destructive focus:border-destructive focus:ring-destructive'

const labelBase = 'block text-sm font-medium text-foreground'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className={labelBase}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          fieldBase,
          'h-10 px-4',
          error ? fieldError : fieldFocus,
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

export function Textarea({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className={labelBase}>
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          fieldBase,
          'px-4 py-2.5 resize-none',
          error ? fieldError : fieldFocus,
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {hint && !error && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export function Select({
  label,
  error,
  options,
  className,
  id,
  ...props
}: SelectProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-')

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className={labelBase}>
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          fieldBase,
          'h-10 px-4 appearance-none cursor-pointer',
          error ? fieldError : fieldFocus,
          className
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 1rem center',
          backgroundSize: '1rem',
          paddingRight: '2.5rem',
        }}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const inputId = id || label.toLowerCase().replace(/\s/g, '-')

  return (
    <label
      htmlFor={inputId}
      className="flex items-center gap-3 cursor-pointer group"
    >
      <div className="relative">
        <input
          type="checkbox"
          id={inputId}
          className={cn(
            'peer w-5 h-5 rounded-md border-2 border-border bg-card',
            'transition-colors duration-200 cursor-pointer appearance-none',
            'checked:bg-primary checked:border-primary',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            className
          )}
          {...props}
        />
        <svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </label>
  )
}
