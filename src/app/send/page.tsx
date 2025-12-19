'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Mail, Link2, Lock, Calendar, Send, Sparkles, Loader2, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select, Checkbox } from '@/components/ui/Input'
import { ThemeToggle } from '@/components/theme-toggle'
import { formatBytes } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast' // Assuming you have useToast hook
import { siteConfig } from '@/config/site'

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  storageKey?: string
}

export default function SendPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  
  // Auth state derived from session
  const isLoggedIn = status === 'authenticated'
  const isAuthLoading = status === 'loading'

  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [createdTransferId, setCreatedTransferId] = useState<string | null>(null)
  
  // Form state
  const [senderName, setSenderName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [expirationDays, setExpirationDays] = useState('7')
  const [hasPassword, setHasPassword] = useState(false)
  const [password, setPassword] = useState('')
  
  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load files from sessionStorage
    const storedFiles = sessionStorage.getItem('uploadedFiles')
    if (storedFiles) {
      setFiles(JSON.parse(storedFiles))
    } else {
      // Redirect back to home if no files
      window.location.href = '/'
    }
  }, [])

  // Auto-fill sender name if logged in
  useEffect(() => {
    if (session?.user?.name && !senderName) {
      setSenderName(session.user.name)
    }
  }, [session, senderName])

  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  const validate = () => {
    const newErrors: Record<string, string> = {}
    
    if (!senderName.trim()) {
      newErrors.senderName = 'Nome é obrigatório'
    }
    
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      newErrors.recipientEmail = 'E-mail inválido'
    }
    
    if (hasPassword && password.length < 4) {
      newErrors.password = 'Senha deve ter pelo menos 4 caracteres'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSendEmail = async (transferId: string) => {
    setEmailStatus('loading')
    try {
      const res = await fetch(`/api/transfers/${transferId}/email`, {
        method: 'POST'
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Falha ao enviar e-mail')

      setEmailStatus('success')
      showToast('E-mail enviado com sucesso!', 'success')
      
      // After email success, redirect
      setTimeout(() => {
        window.location.href = '/dashboard'
        sessionStorage.removeItem('uploadedFiles')
      }, 1500)
    } catch (err: any) {
      console.error('Email retry error:', err)
      setEmailStatus('error')
      showToast(err.message || 'Erro ao enviar e-mail', 'error')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validate()) return
    
    // If we already have a transfer ID and just need to retry email
    if (createdTransferId && emailStatus === 'error') {
      await handleSendEmail(createdTransferId)
      return
    }

    setIsLoading(true)
    setEmailStatus('idle')

    try {
      // Retrieve keys from sessionStorage
      const storedTransferId = sessionStorage.getItem('currentTransferId')
      if (!storedTransferId) throw new Error('Sessão de upload inválida')

      // 1. Finalize Transfer (DB records)
      const payload = {
        transferId: storedTransferId,
        senderName,
        recipientEmail,
        message,
        files,
        expirationDays: parseFloat(expirationDays),
        password: hasPassword ? password : null,
      }

      const res = await fetch('/api/transfers/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar envio')
      
      const newTransferId = data.transfer.id
      setCreatedTransferId(newTransferId)

      // Store transfer info for success page
      sessionStorage.setItem('lastTransfer', JSON.stringify({
        shareToken: data.transfer.shareToken,
        senderName,
        recipientEmail,
        message,
        files,
        expirationDays: parseFloat(expirationDays),
        hasPassword,
      }))
      
      // 2. If email is provided, call decoupled email endpoint
      if (recipientEmail) {
        await handleSendEmail(newTransferId)
      } else {
        showToast('Link criado com sucesso!', 'success')
        setTimeout(() => {
          window.location.href = '/dashboard'
          sessionStorage.removeItem('uploadedFiles')
        }, 1000)
      }

    } catch (error: any) {
      console.error('Error creating transfer:', error)
      setErrors({ submit: error.message || 'Erro ao criar envio. Tente novamente.' })
      showToast(error.message || 'Erro ao criar envio', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-6">
      {/* Header */}
      <header className="max-w-2xl mx-auto mb-8 flex items-center justify-between">
        <a 
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Voltar</span>
        </a>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              {siteConfig.name.split('Send')[0]}<span className="text-primary-500">Send</span>
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card p-6 md:p-8"
        >
          {/* Title */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Quase lá! Personalize o envio.
              </h1>
              <p className="text-muted-foreground">
                {files.length} arquivo{files.length !== 1 ? 's' : ''} • {formatBytes(totalSize)}
              </p>
            </div>
            {isLoggedIn && (
               <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-primary-500/10 text-primary-500 rounded-full text-xs font-medium border border-primary-500/20">
                 <Crown className="w-3 h-3" />
                 <span>Conta Autenticada</span>
               </div>
            )}
            {/* Removed Guest logic */}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sender name */}
            <Input
              label="Seu nome"
              placeholder="Como deseja ser identificado?"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              error={errors.senderName}
              required
            />

            {/* Recipient email */}
            <Input
              label="E-mail do destinatário (opcional)"
              type="email"
              placeholder="email@exemplo.com"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              error={errors.recipientEmail}
              hint="Deixe em branco para apenas gerar o link"
            />

            {/* Message */}
            <Textarea
              label="Mensagem (opcional)"
              placeholder="Adicione uma mensagem para o destinatário..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
            />

            {/* Expiration select */}
            <div>
              <label htmlFor="expirationDays" className="block text-sm font-medium text-foreground mb-1">
                Expiração do link
              </label>
              <select
                id="expirationDays"
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value)}
                className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground focus:ring-4 focus:border-primary-500 outline-none transition-all appearance-none cursor-pointer"
                disabled={!isLoggedIn}
              >
                <option value="0.0416">1 hora</option>
                <option value="1">1 dia</option>
                <option value="7">7 dias</option>
                <option value="30">30 dias</option>
              </select>
            </div>

            {/* Password protection */}
            <div className="space-y-3">
              <div className={!isLoggedIn ? 'opacity-50 pointer-events-none' : ''}>
                <Checkbox
                  label="Proteger com senha"
                  checked={hasPassword}
                  onChange={e => setHasPassword(e.target.checked)}
                />
              </div>
              
              <AnimatePresence>
                {hasPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Input
                      type="password"
                      placeholder="Digite uma senha"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      error={errors.password}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Limits info for guests */}

            {/* Error message */}
            {(errors.submit || emailStatus === 'error') && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex flex-col gap-2 text-sm text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Erro:</span> 
                  <span>{errors.submit || 'O link foi criado, mas houve um erro ao enviar o e-mail.'}</span>
                </div>
                {emailStatus === 'error' && (
                  <p className="text-xs opacity-80">
                    O destinatário pode não receber a notificação, mas você ainda pode copiar o link no dashboard.
                  </p>
                )}
              </div>
            )}

            {/* Submit button */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="submit"
                loading={isLoading || emailStatus === 'loading'}
                disabled={emailStatus === 'success'}
                icon={emailStatus === 'error' ? <Send className="w-4 h-4" /> : (recipientEmail ? <Mail className="w-4 h-4" /> : <Link2 className="w-4 h-4" />)}
                className="flex-1"
                variant={emailStatus === 'error' ? 'secondary' : 'primary'}
              >
                {emailStatus === 'loading' 
                  ? 'Enviando e-mail...' 
                  : isLoading 
                    ? 'Criando link...' 
                    : emailStatus === 'error' 
                      ? 'Tentar enviar e-mail novamente'
                      : emailStatus === 'success'
                        ? 'E-mail enviado!'
                        : (recipientEmail ? 'Enviar por e-mail' : 'Criar link')}
              </Button>
            </div>
          </form>
        </motion.div>
      </main>
    </div>
  )
}
