'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Link2, Mail, Plus, QrCode, Sparkles, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatBytes } from '@/lib/utils'

interface TransferData {
  shareToken: string
  senderName: string
  recipientEmail?: string
  message?: string
  files: { id: string; name: string; size: number; type: string }[]
  expirationDays: number
  hasPassword: boolean
}

export default function SuccessPage() {
  const [transfer, setTransfer] = useState<TransferData | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem('lastTransfer')
    if (stored) {
      setTransfer(JSON.parse(stored))
      // Clear session storage
      sessionStorage.removeItem('uploadedFiles')
      sessionStorage.removeItem('lastTransfer')
    } else {
      window.location.href = '/'
    }
  }, [])

  if (!transfer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const downloadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/d/${transfer.shareToken}`
  const totalSize = transfer.files.reduce((acc, f) => acc + f.size, 0)
  const expirationDate = new Date()
  expirationDate.setDate(expirationDate.getDate() + transfer.expirationDays)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  return (
    <div className="min-h-screen py-12 px-6">
      {/* Header */}
      <header className="max-w-lg mx-auto text-center mb-8">
        <a href="/" className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-foreground">
            Coletivo<span className="text-primary-500">Send</span>
          </span>
        </a>
      </header>

      <main className="max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="card p-8 text-center"
        >
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.6, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30"
          >
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Link pronto para compartilhar!
            </h1>
            <p className="text-muted-foreground">
              {transfer.files.length} arquivo{transfer.files.length !== 1 ? 's' : ''} • {formatBytes(totalSize)}
            </p>
          </motion.div>

          {/* Link display */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8"
          >
            <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-xl border border-border">
              <Link2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                value={downloadUrl}
                readOnly
                className="flex-1 bg-transparent text-foreground text-sm truncate focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                className={copied ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ''}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 flex flex-col sm:flex-row gap-3"
          >
            <Button
              variant="secondary"
              onClick={() => setShowQR(!showQR)}
              icon={<QrCode className="w-4 h-4" />}
              className="flex-1"
            >
              {showQR ? 'Ocultar QR' : 'Ver QR Code'}
            </Button>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button
                variant="secondary"
                icon={<ExternalLink className="w-4 h-4" />}
                className="w-full"
              >
                Abrir link
              </Button>
            </a>
          </motion.div>

          {/* QR Code */}
          {showQR && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 p-6 bg-card rounded-xl border border-border"
            >
              {/* Placeholder QR - in real app, use qrcode library */}
              <div className="w-48 h-48 mx-auto bg-muted rounded-lg flex items-center justify-center">
                <QrCode className="w-24 h-24 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Escaneie para acessar os arquivos
              </p>
            </motion.div>
          )}

          {/* Info cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 grid grid-cols-2 gap-4 text-left"
          >
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Expira em</p>
              <p className="font-medium text-foreground mt-1">
                {expirationDate.toLocaleDateString('pt-BR', { 
                  day: 'numeric', 
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div className="p-4 bg-muted/30 rounded-xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Proteção</p>
              <p className="font-medium text-foreground mt-1">
                {transfer.hasPassword ? 'Com senha' : 'Sem senha'}
              </p>
            </div>
          </motion.div>

          {/* Email sent notice */}
          {transfer.recipientEmail && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-6 flex items-center gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100"
            >
              <Mail className="w-5 h-5 text-primary-500" />
              <p className="text-sm text-primary-700">
                E-mail enviado para <strong>{transfer.recipientEmail}</strong>
              </p>
            </motion.div>
          )}

          {/* New upload button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 pt-6 border-t border-surface-200"
          >
            <a href="/">
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                className="w-full"
              >
                Criar novo envio
              </Button>
            </a>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}
