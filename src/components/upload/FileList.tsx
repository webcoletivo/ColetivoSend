'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileIcon, FileImage, FileVideo, FileAudio, FileArchive, FileText, File } from 'lucide-react'
import { formatBytes, getFileIcon } from '@/lib/utils'
import { IconButton } from '@/components/ui/Button'

export interface FileItem {
  id: string
  file: File
  progress?: number
  status: 'pending' | 'uploading' | 'complete' | 'error' | 'waiting'
  error?: string
}

interface FileListProps {
  files: FileItem[]
  onRemove: (id: string) => void
  maxFiles: number
  maxSize: number
  readonly?: boolean
}

function getFileIconComponent(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('video/')) return FileVideo
  if (mimeType.startsWith('audio/')) return FileAudio
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return FileArchive
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) return FileText
  return File
}

function getIconColor(mimeType: string, status: FileItem['status']) {
  if (status === 'waiting') return 'text-amber-500 bg-amber-100 border-dashed border-amber-300'
  
  if (mimeType.startsWith('image/')) return 'text-pink-500 bg-pink-100'
  if (mimeType.startsWith('video/')) return 'text-purple-500 bg-purple-100'
  if (mimeType.startsWith('audio/')) return 'text-emerald-500 bg-emerald-100'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-amber-500 bg-amber-100'
  if (mimeType.includes('pdf')) return 'text-red-500 bg-red-100'
  return 'text-primary-500 bg-primary-100'
}

export function FileList({ files, onRemove, maxFiles, maxSize, readonly = false }: FileListProps) {
  const totalSize = files.reduce((acc, item) => acc + item.file.size, 0)
  const totalCount = files.length

  if (files.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Summary bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-surface-100 rounded-xl dark:bg-surface-800">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-surface-700 dark:text-surface-300">
            {totalCount} arquivo{totalCount !== 1 ? 's' : ''}
          </span>
          <span className="w-1 h-1 rounded-full bg-surface-300" />
          <span className="text-surface-500">
            {formatBytes(totalSize)} de {formatBytes(maxSize)}
          </span>
        </div>
        <div className="text-xs text-surface-400">
          {maxFiles - totalCount} restante{maxFiles - totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Size progress bar */}
      <div className="progress h-1.5">
        <motion.div
          className="progress-bar"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min((totalSize / maxSize) * 100, 100)}%` }}
          style={{
            background: totalSize > maxSize * 0.9 
              ? 'linear-gradient(to right, #f59e0b, #ef4444)'
              : 'linear-gradient(to right, #6366f1, #8b5cf6)'
          }}
        />
      </div>

      {/* File list */}
      <div className="space-y-2 max-h-64 overflow-y-auto scroll-smooth-container pr-1">
        <AnimatePresence mode="popLayout">
          {files.map((item, index) => {
            const IconComponent = getFileIconComponent(item.file.type)
            const iconClass = getIconColor(item.file.type, item.status)

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ 
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 300,
                  damping: 25
                }}
                className={`group flex items-center gap-3 p-3 bg-white rounded-xl border transition-colors dark:bg-surface-800 dark:border-surface-700 ${
                  item.status === 'waiting' 
                    ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50' 
                    : 'border-surface-100 hover:border-surface-200'
                }`}
              >
                {/* File icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconClass}`}>
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 truncate dark:text-surface-100">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-surface-400">
                    {formatBytes(item.file.size)}
                    {item.status === 'uploading' && item.progress !== undefined && (
                      <span className="ml-2 text-primary-500">
                        • {Math.round(item.progress)}%
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span className="ml-2 text-red-500">• Erro</span>
                    )}
                    {item.status === 'complete' && (
                      <span className="ml-2 text-emerald-500">• Enviado</span>
                    )}
                    {item.status === 'waiting' && (
                      <span className="ml-2 text-amber-600 font-medium">• Re-selecione este arquivo</span>
                    )}
                  </p>
                </div>

                {/* Progress bar for uploading files */}
                {item.status === 'uploading' && item.progress !== undefined && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-200 rounded-b-xl overflow-hidden">
                    <motion.div
                      className="h-full bg-primary-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Remove button */}
                {!readonly && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <IconButton
                      variant="ghost"
                      onClick={() => onRemove(item.id)}
                      className="text-surface-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </IconButton>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
