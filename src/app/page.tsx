'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Shield, Zap, Link2, Sparkles } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { UploadDropzone } from '@/components/upload/UploadDropzone'
import { FileList, FileItem } from '@/components/upload/FileList'
import { ProgressBar } from '@/components/upload/ProgressBar'
import { Button } from '@/components/ui/Button'
import { UserMenu } from '@/components/ui/UserMenu'
import { ThemeToggle } from '@/components/theme-toggle'
import { formatBytes } from '@/lib/utils'

// Guest limits (Legacy/Display only)
const GUEST_MAX_FILES = 2000
const GUEST_MAX_SIZE = 10 * 1024 * 1024 * 1024 // 10GB
// Logged user limits
const USER_MAX_FILES = 2000
const USER_MAX_SIZE = 10 * 1024 * 1024 * 1024 // 10GB

export default function HomePage() {
  const { data: session, status } = useSession()
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState('')
  
  const isLoggedIn = !!session?.user
  const isLoading = status === 'loading'
  
  // Use limits based on auth status
  const maxFiles = isLoggedIn ? USER_MAX_FILES : GUEST_MAX_FILES
  const maxSize = isLoggedIn ? USER_MAX_SIZE : GUEST_MAX_SIZE

  const totalSize = files.reduce((acc, item) => acc + item.file.size, 0)
  const totalCount = files.length

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      // Create a copy of previous files
      const updatedFiles = [...prev]
      // Keep track of which new files are not used to replace waiting ones
      const remainingNewFiles = [...newFiles]
      
      // Try to match new files with "waiting" files
      // We iterate through existing files and check if any waiting file matches a new file
      for (let i = 0; i < updatedFiles.length; i++) {
        if (updatedFiles[i].status === 'waiting') {
          // Find a match by name and size
          const matchIndex = remainingNewFiles.findIndex(
            f => f.name === updatedFiles[i].file.name && f.size === updatedFiles[i].file.size
          )
          
          if (matchIndex !== -1) {
            // Found a match! Replace the placeholder with the real file
            updatedFiles[i] = {
              ...updatedFiles[i],
              file: remainingNewFiles[matchIndex],
              status: 'pending'
            }
            // Remove from remaining list so we don't add it again
            remainingNewFiles.splice(matchIndex, 1)
          }
        }
      }
      
      // Create items for any completely new files
      const newItems: FileItem[] = remainingNewFiles.map(file => ({
        id: uuidv4(),
        file,
        status: 'pending',
      }))
      
      return [...updatedFiles, ...newItems]
    })
  }, [])

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  // Draft restoration
  useEffect(() => {
    if (isLoggedIn) {
      const draft = sessionStorage.getItem('pending_upload_draft')
      if (draft) {
        try {
          const { files: draftFiles } = JSON.parse(draft)
          if (draftFiles && draftFiles.length > 0) {
            // Restore as "waiting" items
            // We use a type assertion for the mock file since we don't have the full File object yet
            const placeholders = draftFiles.map((f: any) => ({
              id: uuidv4(),
              file: { name: f.name, size: f.size, type: f.type } as unknown as File,
              status: 'waiting',
            })) as FileItem[]
            
            setFiles(placeholders)
          }
        } catch (e) {
          console.error('Failed to parse draft', e)
        }
        sessionStorage.removeItem('pending_upload_draft')
      }
    }
  }, [isLoggedIn])

  const handleContinue = async () => {
    if (files.length === 0) return

    // Mandatory Login Check
    if (!isLoggedIn) {
      // Save draft metadata (we can't save actual File objects)
      const draft = {
        files: files.map(f => ({ name: f.file.name, size: f.file.size, type: f.file.type }))
      }
      sessionStorage.setItem('pending_upload_draft', JSON.stringify(draft))
      
      // Redirect to login
      window.location.href = '/login?callbackUrl=/'
      return
    }

    setUploadStatus('uploading')
    setUploadProgress(0)
    
    const uploadedFilesData = []

    try {
      // 1. Get presigned URLs for all files
      // We send simple metadata to get the URLs
      const presignResponse = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map(f => ({
            id: f.id,
            name: f.file.name,
            size: f.file.size,
            type: f.file.type
          }))
        })
      })

      if (!presignResponse.ok) {
        const error = await presignResponse.json()
        throw new Error(error.error || 'Erro ao preparar upload')
      }

      const { presignedUrls, transferId } = await presignResponse.json()

      // 2. Upload each file directly to S3
      for (let i = 0; i < files.length; i++) {
        const item = files[i]
        const presigned = presignedUrls.find((p: any) => p.originalId === item.id)
        
        if (!presigned) {
          throw new Error(`Erro ao obter URL para ${item.file.name}`)
        }

        // Update status message
        setUploadMessage(`Enviando ${i + 1} de ${files.length}: ${item.file.name}`)

        // Perform PUT upload to S3
        const uploadRes = await fetch(presigned.url, {
          method: 'PUT',
          body: item.file,
          headers: {
            'Content-Type': item.file.type || 'application/octet-stream',
            // If we had 'x-amz-tagging' in the presigned URL generation, we MUST send it here too.
            // Currently strict tagging is disabled in storage.ts to simplify CORS.
          }
        })

        if (!uploadRes.ok) {
          console.error('S3 Upload Error:', uploadRes.status, uploadRes.statusText)
          throw new Error(`Falha no envio de ${item.file.name}`)
        }

        // Success - store metadata
        uploadedFilesData.push({
          id: item.id,
          name: item.file.name,
          size: item.file.size,
          type: item.file.type,
          storageKey: presigned.storageKey,
          transferId: transferId // Keep track of the temp transfer ID
        })

        setUploadProgress(Math.round(((i + 1) / files.length) * 100))
      }

      setUploadStatus('processing')
      await new Promise(r => setTimeout(r, 500))
      setUploadStatus('complete')

      // Store REAL uploaded file data (with storage keys) in sessionStorage
      sessionStorage.setItem('uploadedFiles', JSON.stringify(uploadedFilesData))
      // Also store the transferId in case we need it? 
      // Actually /api/transfers/finalize expects `transferId` in the body now.
      // We should store it or attach it to every file?
      // The finalize endpoint expects `transferId` at the root of the body.
      // So let's store it separately or extract it from the first file in SendPage.
      // Better: store it in sessionStorage key 'currentTransferId'
      sessionStorage.setItem('currentTransferId', transferId)
      
      setTimeout(() => {
        window.location.href = '/send'
      }, 500)

    } catch (error: any) {
      console.error('Upload failed:', error)
      setUploadStatus('error')
      alert(error.message || 'Falha no upload dos arquivos. Tente novamente.')
    }
  }

  const canContinue = files.length > 0 && totalSize <= maxSize && totalCount <= maxFiles
  const isUploading = uploadStatus !== 'idle' && uploadStatus !== 'error'

  return (
    <div className="min-h-screen">
      {/* Draft Restoration Prompt */}

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Coletivo<span className="text-primary-500">Send</span>
            </span>
          </a>
          
          <div className="flex items-center gap-4">
            <ThemeToggle />
            
            {isLoading ? (
              // Loading skeleton
              <div className="w-24 h-10 rounded-full bg-muted animate-pulse" />
            ) : isLoggedIn ? (
              // User is logged in - show user menu
              <UserMenu />
            ) : (
              // User is not logged in - show login/signup buttons
              <>
                <a href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
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
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Compartilhe arquivos com um{' '}
              <span className="text-gradient bg-gradient-to-r from-primary-500 to-accent-500">
                link em segundos
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
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
                message={uploadMessage}
              />
            )}

            {/* Limits info */}
            {!isUploading && (
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  {isLoggedIn ? (
                    <span className="badge badge-info">Conta Premium</span>
                  ) : (
                    <span>
                      Limite gratuito de 10 GB.
                      <a href="/login" className="ml-2 text-primary-500 hover:underline">
                        Faça login para enviar
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
                <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} ColetivoSend. Compartilhamento seguro de arquivos.</p>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Termos</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
