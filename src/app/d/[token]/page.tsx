'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Download, Lock, Calendar, User, FileIcon,
  AlertCircle, Clock, Ban, Sparkles, FileImage,
  FileVideo, FileAudio, FileArchive, FileText, File
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatBytes, formatDate } from '@/lib/utils'

type PageStatus = 'loading' | 'password' | 'ready' | 'expired' | 'revoked' | 'notfound' | 'error'

interface TransferFile {
  id: string
  originalName: string
  sizeBytes: number
  mimeType: string
  downloadUrl: string
}

interface TransferData {
  id: string
  senderName: string
  message: string | null
  expiresAt: string
  viewCount: number
  downloadCount: number
  files: TransferFile[]
  hasPassword?: boolean
}

function getFileIconComponent(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('video/')) return FileVideo
  if (mimeType.startsWith('audio/')) return FileAudio
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return FileArchive
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) return FileText
  return File
}

function getIconColor(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'text-pink-500 bg-pink-500/10'
  if (mimeType.startsWith('video/')) return 'text-purple-500 bg-purple-500/10'
  if (mimeType.startsWith('audio/')) return 'text-emerald-500 bg-emerald-500/10'
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-amber-500 bg-amber-500/10'
  if (mimeType.includes('pdf')) return 'text-red-500 bg-red-500/10'
  return 'text-primary-500 bg-primary-500/10'
}

import { useParams } from 'next/navigation'

export default function DownloadPage() {
  const params = useParams<{ token: string }>()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [transfer, setTransfer] = useState<TransferData | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransfer = async () => {
      try {
        const res = await fetch(`/api/transfer/${params.token}`)
        const data = await res.json()

        if (res.status === 404) {
          setStatus('notfound')
          return
        }

        if (res.status === 410) {
          setStatus(data.code === 'expired' ? 'expired' : 'revoked')
          return
        }

        if (!res.ok) {
          throw new Error('Erro ao carregar')
        }

        if (data.hasPassword) {
          setStatus('password')
        } else {
          setTransfer(data)
          setStatus('ready')
        }
      } catch (error) {
        console.error('Error fetching transfer:', error)
        setStatus('error')
      }
    }

    fetchTransfer()
  }, [params.token])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 1) {
      setPasswordError('Digite a senha')
      return
    }

    try {
      // First verify password
      const verifyRes = await fetch(`/api/transfer/${params.token}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (!verifyRes.ok) {
        const error = await verifyRes.json()
        setPasswordError(error.error || 'Senha incorreta')
        return
      }

      // If verified, unlock and get data
      // For simplicity using a separate unlock endpoint or just refetching logic 
      // where logic is: authenticated requests get data. 
      // For now, let's call the unlock endpoint we created or just reuse logic.
      // Actually, let's just use the `unlock` endpoint if we made one, or assume the verify 
      // endpoint could return data.
      // Reviewing previous step: I created `unlock` endpoint.

      const unlockRes = await fetch(`/api/transfer/${params.token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      const data = await unlockRes.json()

      if (unlockRes.ok) {
        setTransfer(data)
        setStatus('ready')
      } else {
        setPasswordError('Erro ao desbloquear')
      }

    } catch (error) {
      setPasswordError('Erro de conexão')
    }
  }

  const handleDownloadAll = async () => {
    if (!transfer) return
    setDownloadingAll(true)

    // In a real app, we might bundle them or just trigger all
    // For now, trigger them one by one (or just the first few)
    for (const file of transfer.files) {
      window.open(file.downloadUrl, '_blank')
      await new Promise(r => setTimeout(r, 500)) // Slight delay between bubbles
    }

    setDownloadingAll(false)
  }

  const handleDownloadFile = async (file: TransferFile) => {
    setDownloadingFile(file.id)
    window.open(file.downloadUrl, '_blank')
    setTimeout(() => setDownloadingFile(null), 500)
  }

  const totalSize = transfer?.files?.reduce((acc, f) => acc + f.sizeBytes, 0) || 0

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  // Error states
  if (status === 'notfound' || status === 'expired' || status === 'revoked' || status === 'error') {
    const errorConfig = {
      notfound: {
        icon: AlertCircle,
        title: 'Link não encontrado',
        description: 'Este link de download não existe ou foi removido.',
        color: 'text-muted-foreground/50',
      },
      expired: {
        icon: Clock,
        title: 'Link expirado',
        description: 'Este link de download expirou e não está mais disponível.',
        color: 'text-amber-500',
      },
      revoked: {
        icon: Ban,
        title: 'Link desativado',
        description: 'Este link foi desativado pelo remetente.',
        color: 'text-red-500',
      },
      error: {
        icon: AlertCircle,
        title: 'Erro no servidor',
        description: 'Não foi possível carregar o envio. Tente novamente.',
        color: 'text-red-500',
      }
    }

    const config = errorConfig[status]
    const IconComponent = config.icon

    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center"
        >
          <div className={`w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6`}>
            <IconComponent className={`w-10 h-10 ${config.color}`} />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">{config.title}</h1>
          <p className="text-muted-foreground mb-8">{config.description}</p>
          <a href="/">
            <Button variant="primary">
              Ir para o início
            </Button>
          </a>
        </motion.div>
      </div>
    )
  }

  // Password prompt
  if (status === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-primary-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Arquivos protegidos
            </h1>
            <p className="text-muted-foreground mb-6">
              Este envio está protegido por senha. Digite a senha para acessar.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                error={passwordError}
              />
              <Button type="submit" className="w-full">
                Acessar arquivos
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    )
  }

  // Ready - show files
  return (
    <div className="min-h-screen py-12 px-6 bg-background">
      {/* Header */}
      <header className="max-w-2xl mx-auto text-center mb-8">
        <a href="/" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Coletivo<span className="text-primary-500">Send</span>
          </span>
        </a>
      </header>

      <main className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 md:p-8 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white/70 text-sm">Enviado por</p>
                <p className="font-semibold text-lg">{transfer?.senderName}</p>
              </div>
            </div>

            {transfer?.message && (
              <div className="p-4 bg-white/10 rounded-xl backdrop-blur-sm">
                <p className="text-white/90 text-sm italic">&quot;{transfer.message}&quot;</p>
              </div>
            )}
          </div>

          {/* Info bar */}
          <div className="px-6 md:px-8 py-4 bg-muted/30 border-b border-border flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-foreground">
                {transfer?.files.length} arquivo{transfer?.files.length !== 1 ? 's' : ''}
              </span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="text-foreground">{formatBytes(totalSize)}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Expira em {formatDate(transfer?.expiresAt || '')}</span>
            </div>
          </div>

          {/* File list */}
          <div className="p-6 md:p-8 space-y-3">
            {transfer?.files.map((file, index) => {
              const IconComponent = getFileIconComponent(file.mimeType)
              const iconClass = getIconColor(file.mimeType)
              const isDownloading = downloadingFile === file.id

              return (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl hover:bg-accent/5 transition-colors group"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconClass}`}>
                    <IconComponent className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{file.originalName}</p>
                    <p className="text-sm text-muted-foreground">{formatBytes(file.sizeBytes)}</p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    loading={isDownloading}
                    onClick={() => handleDownloadFile(file)}
                    icon={<Download className="w-4 h-4" />}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  >
                    Baixar
                  </Button>
                </motion.div>
              )
            })}
          </div>

          {/* Download all button */}
          <div className="p-6 md:p-8 pt-0">
            <Button
              variant="primary"
              loading={downloadingAll}
              onClick={handleDownloadAll}
              icon={<Download className="w-5 h-5" />}
              className="w-full py-4 text-base"
            >
              Baixar todos os arquivos
            </Button>
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          Enviado com{' '}
          <a href="/" className="text-primary-500 hover:underline">ColetivoSend</a>
        </p>
      </main>
    </div>
  )
}

