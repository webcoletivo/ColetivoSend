'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ThemeToggle } from '@/components/theme-toggle'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Digite um e-mail válido')
      return
    }

    setIsLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      // We always show success message for security (user enumeration prevention)
      // unless it's a server error (500)
      if (res.status === 500) {
        throw new Error('Erro interno do servidor')
      }

      setIsSent(true)
    } catch (error) {
      setError('Erro ao enviar e-mail. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50 dark:opacity-20" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-50 dark:opacity-20" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">
              Coletivo<span className="text-primary-500">Send</span>
            </span>
          </a>
        </div>

        <div className="card p-8">
          {!isSent ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Esqueceu a senha?
                </h1>
                <p className="text-muted-foreground">
                  Digite seu e-mail e enviaremos um link para redefinir.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  error={error}
                />

                <Button
                  type="submit"
                  loading={isLoading}
                  className="w-full"
                >
                  Enviar link de recuperação
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                E-mail enviado!
              </h2>
              <p className="text-muted-foreground mb-6">
                Verifique sua caixa de entrada em <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Não recebeu? Verifique o spam ou{' '}
                <button 
                  onClick={() => setIsSent(false)}
                  className="text-primary-500 hover:underline"
                >
                  tente novamente
                </button>
              </p>
            </div>
          )}

          <a 
            href="/login" 
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-6 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para login
          </a>
        </div>
      </motion.div>
    </div>
  )
}
