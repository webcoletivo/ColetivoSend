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
        {...(getRootProps() as any)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4',
          'p-8 md:p-12 lg:p-16 rounded-2xl border-2 border-dashed',
          'bg-background transition-all duration-300 cursor-pointer group',
          'dark:bg-secondary/10',
          isDragActive && !isDragReject && 'border-primary-500 bg-primary-500/5',
          isDragReject && 'border-destructive bg-destructive/5',
          !isDragActive && !disabled && 'border-border hover:border-primary-500 hover:bg-accent/5',
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
            'bg-primary-500/10 group-hover:bg-primary-500/20',
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

        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            {isDragActive ? 'Solte os arquivos aqui' : 'Arraste e solte seus arquivos'}
          </h3>
          <p className="text-muted-foreground">
            ou <span className="text-primary-500 font-medium">clique para selecionar</span>
          </p>
        </div>

        {/* Limits info */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground font-medium">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full">
            <FileUp className="w-3.5 h-3.5" />
            Arquivos ilimitados
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full">
             <Cloud className="w-3.5 h-3.5" />
             Máx. 10 GB
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
            className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive rounded-xl border border-destructive/20"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
