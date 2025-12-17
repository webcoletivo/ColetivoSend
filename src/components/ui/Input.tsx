'use client'

import React from 'react'
import { cn } from '@/lib/utils'

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
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-700 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full px-4 py-3 rounded-xl border bg-white text-surface-900 placeholder:text-surface-400',
          'transition-all duration-200',
          'focus:outline-none focus:ring-4',
          error 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' 
            : 'border-surface-200 focus:border-primary-500 focus:ring-primary-500/10',
          'disabled:bg-surface-100 disabled:cursor-not-allowed',
          'dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-sm text-surface-500">{hint}</p>
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
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-700 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          'w-full px-4 py-3 rounded-xl border bg-white text-surface-900 placeholder:text-surface-400',
          'transition-all duration-200 resize-none',
          'focus:outline-none focus:ring-4',
          error 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' 
            : 'border-surface-200 focus:border-primary-500 focus:ring-primary-500/10',
          'disabled:bg-surface-100 disabled:cursor-not-allowed',
          'dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
      {hint && !error && (
        <p className="text-sm text-surface-500">{hint}</p>
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
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-surface-700 dark:text-surface-300"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={cn(
          'w-full px-4 py-3 rounded-xl border bg-white text-surface-900',
          'transition-all duration-200 appearance-none cursor-pointer',
          'focus:outline-none focus:ring-4',
          error 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' 
            : 'border-surface-200 focus:border-primary-500 focus:ring-primary-500/10',
          'dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100',
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
        <p className="text-sm text-red-500">{error}</p>
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
            'peer w-5 h-5 rounded-md border-2 border-surface-300 bg-white',
            'transition-all duration-200 cursor-pointer appearance-none',
            'checked:bg-primary-500 checked:border-primary-500',
            'focus:outline-none focus:ring-4 focus:ring-primary-500/20',
            'dark:bg-surface-800 dark:border-surface-600',
            className
          )}
          {...props}
        />
        <svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm text-surface-700 group-hover:text-surface-900 dark:text-surface-300">
        {label}
      </span>
    </label>
  )
}
