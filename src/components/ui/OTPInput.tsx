'use client'

import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react'
import { cn } from '@/lib/utils'

interface OTPInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  error?: string
  autoFocus?: boolean
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  autoFocus = true,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const hasCompletedRef = useRef(false)

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length)
  }, [length])

  // Auto focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  // Reset completion flag when value is cleared
  useEffect(() => {
    if (value.length < length) {
      hasCompletedRef.current = false
    }
  }, [value, length])

  // Handle value change and auto-complete (with single-flight guard)
  useEffect(() => {
    if (value.length === length && onComplete && !hasCompletedRef.current) {
      hasCompletedRef.current = true
      onComplete(value)
    }
  }, [value, length, onComplete])

  const focusInput = (index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]?.focus()
      inputRefs.current[index]?.select()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const inputValue = e.target.value.replace(/\D/g, '')
    
    if (inputValue.length === 0) {
      // Clear this digit
      const newValue = value.slice(0, index) + value.slice(index + 1)
      onChange(newValue.padEnd(index, ' ').slice(0, length))
      return
    }

    if (inputValue.length === 1) {
      // Single digit entered
      const newValue = value.slice(0, index) + inputValue + value.slice(index + 1)
      onChange(newValue.slice(0, length))
      
      // Move to next input
      if (index < length - 1) {
        focusInput(index + 1)
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      
      if (value[index]) {
        // Clear current digit
        const newValue = value.slice(0, index) + value.slice(index + 1)
        onChange(newValue)
      } else if (index > 0) {
        // Move to previous input and clear it
        const newValue = value.slice(0, index - 1) + value.slice(index)
        onChange(newValue)
        focusInput(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      focusInput(index + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    
    if (pastedData) {
      onChange(pastedData)
      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, length - 1)
      focusInput(nextIndex)
    }
  }

  const handleFocus = (index: number) => {
    inputRefs.current[index]?.select()
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-center gap-2 sm:gap-3">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            onFocus={() => handleFocus(index)}
            disabled={disabled}
            className={cn(
              'w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold',
              'rounded-xl border-2 transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-red-300 bg-red-50 text-red-600 focus:border-red-500'
                : 'border-surface-200 bg-white text-surface-900 focus:border-primary-500',
              value[index] && !error && 'border-primary-300 bg-primary-50'
            )}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>
      
      {error && (
        <p className="text-center text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
