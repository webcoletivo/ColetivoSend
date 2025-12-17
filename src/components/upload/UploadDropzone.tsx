'use client'

import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Cloud, FileUp, AlertCircle } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'

interface UploadDropzoneProps {
  onFilesAdded: (files: File[]) => void
  maxFiles: number
  maxSize: number // in bytes
  currentFileCount: number
  currentTotalSize: number
  disabled?: boolean
}

export function UploadDropzone({
  onFilesAdded,
  maxFiles,
  maxSize,
  currentFileCount,
  currentTotalSize,
  disabled = false,
}: UploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null)

    // Check for rejected files
    if (rejectedFiles.length > 0) {
      const reasons = rejectedFiles.map(f => f.errors[0]?.message).filter(Boolean)
      setError(reasons[0] || 'Alguns arquivos foram rejeitados')
      return
    }

    // Check file count limit
    if (currentFileCount + acceptedFiles.length > maxFiles) {
      setError(`Máximo de ${maxFiles} arquivos permitidos`)
      return
    }

    // Check total size limit
    const newTotalSize = acceptedFiles.reduce((acc, file) => acc + file.size, currentTotalSize)
    if (newTotalSize > maxSize) {
      setError(`Tamanho máximo de ${formatBytes(maxSize)} excedido`)
      return
    }

    onFilesAdded(acceptedFiles)
  }, [onFilesAdded, maxFiles, maxSize, currentFileCount, currentTotalSize])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    disabled,
    maxSize,
    multiple: true,
  })

  const remainingFiles = maxFiles - currentFileCount
  const remainingSize = maxSize - currentTotalSize

  return (
    <div className="space-y-4">
      <motion.div
        {...getRootProps()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4',
          'p-8 md:p-12 lg:p-16 rounded-2xl border-2 border-dashed',
          'bg-gradient-to-b from-surface-50 to-white',
          'transition-all duration-300 cursor-pointer group',
          'dark:from-surface-800 dark:to-surface-900',
          isDragActive && !isDragReject && 'border-primary-500 bg-gradient-to-b from-primary-50 to-white dark:from-primary-950/50',
          isDragReject && 'border-red-500 bg-red-50',
          !isDragActive && !disabled && 'border-surface-300 hover:border-primary-400 hover:bg-gradient-to-b hover:from-primary-50/50 hover:to-white dark:border-surface-600 dark:hover:border-primary-500',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        
        {/* Animated icon */}
        <motion.div
          animate={{ 
            y: isDragActive ? -10 : 0,
            scale: isDragActive ? 1.1 : 1,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center',
            'bg-gradient-to-br from-primary-100 to-primary-50',
            'group-hover:from-primary-200 group-hover:to-primary-100',
            'dark:from-primary-900/50 dark:to-primary-800/30',
            'transition-colors duration-300'
          )}
        >
          <motion.div
            animate={{ y: isDragActive ? [0, -5, 0] : 0 }}
            transition={{ repeat: isDragActive ? Infinity : 0, duration: 0.8 }}
          >
            {isDragActive ? (
              <Cloud className="w-10 h-10 text-primary-500" />
            ) : (
              <Upload className="w-10 h-10 text-primary-500" />
            )}
          </motion.div>
        </motion.div>

        {/* Text content */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100">
            {isDragActive ? 'Solte os arquivos aqui' : 'Arraste e solte seus arquivos'}
          </h3>
          <p className="text-surface-500 dark:text-surface-400">
            ou <span className="text-primary-500 font-medium">clique para selecionar</span>
          </p>
        </div>

        {/* Limits info */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-surface-400">
          <span className="flex items-center gap-1.5">
            <FileUp className="w-4 h-4" />
            Até {remainingFiles} arquivo{remainingFiles !== 1 ? 's' : ''}
          </span>
          <span className="w-1 h-1 rounded-full bg-surface-300" />
          <span>
            Máx. {formatBytes(remainingSize)}
          </span>
        </div>

        {/* Decorative elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
          <motion.div
            animate={{
              opacity: isDragActive ? 0.5 : 0.2,
              scale: isDragActive ? 1.2 : 1,
            }}
            className="absolute top-0 right-0 w-64 h-64 bg-primary-400 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              opacity: isDragActive ? 0.3 : 0.1,
              scale: isDragActive ? 1.2 : 1,
            }}
            className="absolute bottom-0 left-0 w-48 h-48 bg-accent-400 rounded-full blur-3xl"
          />
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl border border-red-200"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
