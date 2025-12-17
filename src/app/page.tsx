'use client'

import React, { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Zap, Link2, Sparkles } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { UploadDropzone } from '@/components/upload/UploadDropzone'
import { FileList, FileItem } from '@/components/upload/FileList'
import { ProgressBar } from '@/components/upload/ProgressBar'
import { Button } from '@/components/ui/Button'
import { UserMenu } from '@/components/ui/UserMenu'
import { formatBytes } from '@/lib/utils'

// Guest limits
const GUEST_MAX_FILES = 10
const GUEST_MAX_SIZE = 50 * 1024 * 1024 // 50MB
// Logged user limits
const USER_MAX_FILES = 20
const USER_MAX_SIZE = 1024 * 1024 * 1024 // 1GB

export default function HomePage() {
  const { data: session, status } = useSession()
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  
  const isLoggedIn = !!session?.user
  const isLoading = status === 'loading'
  
  // Use limits based on auth status
  const maxFiles = isLoggedIn ? USER_MAX_FILES : GUEST_MAX_FILES
  const maxSize = isLoggedIn ? USER_MAX_SIZE : GUEST_MAX_SIZE

  const totalSize = files.reduce((acc, item) => acc + item.file.size, 0)
  const totalCount = files.length

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    const fileItems: FileItem[] = newFiles.map(file => ({
      id: uuidv4(),
      file,
      status: 'pending',
    }))
    setFiles(prev => [...prev, ...fileItems])
  }, [])

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleContinue = async () => {
    if (files.length === 0) return

    // Simulate upload process
    setUploadStatus('uploading')
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 200))
      setUploadProgress(i)
    }

    setUploadStatus('processing')
    await new Promise(r => setTimeout(r, 1000))
    
    setUploadStatus('complete')

    // Store files in sessionStorage and redirect to send page
    sessionStorage.setItem('uploadedFiles', JSON.stringify(
      files.map(f => ({
        id: f.id,
        name: f.file.name,
        size: f.file.size,
        type: f.file.type,
      }))
    ))
    
    // Redirect to configuration page
    setTimeout(() => {
      window.location.href = '/send'
    }, 500)
  }

  const canContinue = files.length > 0 && totalSize <= maxSize && totalCount <= maxFiles
  const isUploading = uploadStatus !== 'idle' && uploadStatus !== 'error'

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-surface-900">
              Coletivo<span className="text-primary-500">Send</span>
            </span>
          </a>
          
          <div className="flex items-center gap-4">
            {isLoading ? (
              // Loading skeleton
              <div className="w-24 h-10 rounded-full bg-surface-200 animate-pulse" />
            ) : isLoggedIn ? (
              // User is logged in - show user menu
              <UserMenu />
            ) : (
              // User is not logged in - show login/signup buttons
              <>
                <a href="/login" className="text-sm font-medium text-surface-600 hover:text-surface-900 transition-colors">
                  Entrar
                </a>
                <a href="/signup">
                  <Button variant="secondary" size="sm">
                    Criar conta
                  </Button>
                </a>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12"
          >
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-surface-900 mb-6 leading-tight">
              Compartilhe arquivos com um{' '}
              <span className="text-gradient bg-gradient-to-r from-primary-500 to-accent-500">
                link em segundos
              </span>
            </h1>
            <p className="text-lg md:text-xl text-surface-500 max-w-2xl mx-auto">
              Sem complicação. Sem cadastro obrigatório. Com segurança.
            </p>
          </motion.div>

          {/* Upload Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="card p-6 md:p-8 space-y-6"
          >
            {/* Dropzone */}
            {!isUploading && (
              <UploadDropzone
                onFilesAdded={handleFilesAdded}
                maxFiles={maxFiles}
                maxSize={maxSize}
                currentFileCount={totalCount}
                currentTotalSize={totalSize}
              />
            )}

            {/* File list */}
            {files.length > 0 && !isUploading && (
              <FileList
                files={files}
                onRemove={handleRemoveFile}
                maxFiles={maxFiles}
                maxSize={maxSize}
              />
            )}

            {/* Upload progress */}
            {isUploading && (
              <ProgressBar
                progress={uploadProgress}
                status={uploadStatus}
              />
            )}

            {/* Limits info */}
            {!isUploading && (
              <div className="flex items-center justify-between text-sm">
                <div className="text-surface-400">
                  {isLoggedIn ? (
                    <span className="badge badge-info">Conta Premium</span>
                  ) : (
                    <span>
                      Limite: {GUEST_MAX_FILES} arquivos, {formatBytes(GUEST_MAX_SIZE)}
                      <a href="/signup" className="ml-2 text-primary-500 hover:underline">
                        Criar conta para mais
                      </a>
                    </span>
                  )}
                </div>
                
                {files.length > 0 && (
                  <Button
                    onClick={handleContinue}
                    disabled={!canContinue}
                    icon={<ArrowRight className="w-4 h-4" />}
                    iconPosition="right"
                  >
                    Continuar
                  </Button>
                )}
              </div>
            )}
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="grid md:grid-cols-3 gap-6 mt-12"
          >
            {[
              {
                icon: Zap,
                title: 'Rápido',
                description: 'Upload direto, sem intermediários. Seus arquivos sobem em segundos.',
              },
              {
                icon: Shield,
                title: 'Seguro',
                description: 'Criptografia de ponta a ponta. Links expiram automaticamente.',
              },
              {
                icon: Link2,
                title: 'Simples',
                description: 'Um link único para compartilhar. Sem instalação necessária.',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                className="text-center p-6"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-100 text-primary-500 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-surface-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-surface-500">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-surface-200">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-surface-400">
          <p>© {new Date().getFullYear()} ColetivoSend. Compartilhamento seguro de arquivos.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-surface-600 transition-colors">Privacidade</a>
            <a href="/terms" className="hover:text-surface-600 transition-colors">Termos</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
