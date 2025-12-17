'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, AlertCircle, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  progress: number // 0-100
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  message?: string
}

export function ProgressBar({ progress, status, message }: ProgressBarProps) {
  const statusConfig = {
    idle: {
      icon: Upload,
      color: 'from-surface-400 to-surface-300',
      bgColor: 'bg-surface-100',
      textColor: 'text-surface-500',
      label: 'Pronto para enviar',
    },
    uploading: {
      icon: Loader2,
      color: 'from-primary-500 to-primary-400',
      bgColor: 'bg-primary-50',
      textColor: 'text-primary-600',
      label: 'Enviando...',
    },
    processing: {
      icon: Loader2,
      color: 'from-amber-500 to-amber-400',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
      label: 'Processando...',
    },
    complete: {
      icon: CheckCircle2,
      color: 'from-emerald-500 to-emerald-400',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      label: 'Concluído!',
    },
    error: {
      icon: AlertCircle,
      color: 'from-red-500 to-red-400',
      bgColor: 'bg-red-50',
      textColor: 'text-red-600',
      label: 'Erro no envio',
    },
  }

  const config = statusConfig[status]
  const IconComponent = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl p-4 space-y-3 transition-colors duration-300',
        config.bgColor
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconComponent
            className={cn(
              'w-5 h-5',
              config.textColor,
              (status === 'uploading' || status === 'processing') && 'animate-spin'
            )}
          />
          <span className={cn('font-medium', config.textColor)}>
            {message || config.label}
          </span>
        </div>
        {status !== 'idle' && (
          <span className={cn('text-sm font-semibold', config.textColor)}>
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/50 rounded-full overflow-hidden backdrop-blur-sm">
        <motion.div
          className={cn('h-full rounded-full bg-gradient-to-r', config.color)}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ 
            duration: 0.5, 
            ease: [0.16, 1, 0.3, 1]
          }}
        />
      </div>
    </motion.div>
  )
}

interface ProgressCircleProps {
  progress: number
  size?: number
  strokeWidth?: number
  status: 'uploading' | 'processing' | 'complete' | 'error'
}

export function ProgressCircle({ 
  progress, 
  size = 120, 
  strokeWidth = 8, 
  status 
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  const colors = {
    uploading: 'stroke-primary-500',
    processing: 'stroke-amber-500',
    complete: 'stroke-emerald-500',
    error: 'stroke-red-500',
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="w-full h-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-200"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={colors[status]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          style={{
            strokeDasharray: circumference,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-surface-900">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  )
}
