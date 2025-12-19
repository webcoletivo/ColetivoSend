'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, AlertCircle, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

import { formatBytes } from '@/lib/utils'

interface ProgressBarProps {
  progress: number // 0-100
  status: 'idle' | 'uploading' | 'processing' | 'complete' | 'error'
  message?: string
  bytesUploaded?: number
  totalBytes?: number
  estimatedTime?: string // Already formatted time string
}

export function ProgressBar({ 
  progress, 
  status, 
  message,
  bytesUploaded,
  totalBytes,
  estimatedTime
}: ProgressBarProps) {
  const statusConfig = {
    idle: {
      icon: Upload,
      color: 'from-muted-foreground/40 to-muted-foreground/20',
      bgColor: 'bg-muted',
      textColor: 'text-muted-foreground',
      label: 'Pronto para enviar',
    },
    uploading: {
      icon: Loader2,
      color: 'from-primary-500 to-primary-400',
      bgColor: 'bg-primary-500/10',
      textColor: 'text-primary-500',
      label: 'Enviando...',
    },
    processing: {
      icon: Loader2,
      color: 'from-amber-500 to-amber-400',
      bgColor: 'bg-amber-500/10',
      textColor: 'text-amber-500',
      label: 'Processando...',
    },
    complete: {
      icon: CheckCircle2,
      color: 'from-emerald-500 to-emerald-400',
      bgColor: 'bg-emerald-500/10',
      textColor: 'text-emerald-500',
      label: 'Concluído!',
    },
    error: {
      icon: AlertCircle,
      color: 'from-destructive to-destructive/80',
      bgColor: 'bg-destructive/10',
      textColor: 'text-destructive',
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
        <div className="flex items-center gap-2 overflow-hidden">
          <IconComponent
            className={cn(
              'w-5 h-5 shrink-0',
              config.textColor,
              (status === 'uploading' || status === 'processing') && 'animate-spin'
            )}
          />
          <span className={cn('font-medium truncate', config.textColor)}>
            {message || config.label}
          </span>
        </div>
        {status !== 'idle' && (
          <span className={cn('text-sm font-semibold shrink-0', config.textColor)}>
            {Math.round(progress)}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden backdrop-blur-sm">
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

      {/* Stats - Real progress feedback */}
      {(status === 'uploading' || status === 'processing') && (bytesUploaded !== undefined && totalBytes !== undefined) && (
        <div className="flex items-center justify-between text-[11px] font-medium opacity-80 uppercase tracking-wider overflow-hidden">
          <div className={config.textColor}>
            {formatBytes(bytesUploaded)} / {formatBytes(totalBytes)}
          </div>
          {estimatedTime && (
            <div className={config.textColor}>
              Restante: {estimatedTime}
            </div>
          )}
        </div>
      )}
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
          className="text-muted/30"
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
        <span className="text-2xl font-bold text-foreground">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  )
}
