'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, ArrowRight, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Link inválido ou expirado.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem')
      setStatus('error')
      return
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter pelo menos 6 caracteres')
      setStatus('error')
      return
    }

    setIsLoading(true)
    setStatus('idle')
    setErrorMessage('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha')
      }

      setStatus('success')
    } catch (error: any) {
      setStatus('error')
      setErrorMessage(error.message || 'Ocorreu um erro. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
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
            <span className="text-2xl font-bold text-surface-900">
              Coletivo<span className="text-primary-500">Send</span>
            </span>
          </a>
        </div>

        <div className="card p-8">
          {status === 'success' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-surface-900 mb-2">
                Senha redefinida!
              </h2>
              <p className="text-surface-500 mb-6">
                Sua senha foi alterada com sucesso. Você já pode fazer login.
              </p>
              <a href="/login">
                <Button className="w-full">
                  Ir para o Login
                </Button>
              </a>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-primary-500" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 mb-2">
                  Nova Senha
                </h1>
                <p className="text-surface-500">
                  Crie uma senha forte para sua conta.
                </p>
              </div>

              {status === 'error' && errorMessage && (
                 <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 flex items-center gap-2 text-sm">
                   <AlertCircle className="w-5 h-5 flex-shrink-0" />
                   <span>{errorMessage}</span>
                 </div>
              )}

              {(!token) ? null : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="relative">
                    <Input
                      label="Nova Senha"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                     <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-9 text-surface-400 hover:text-surface-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                  </div>

                  <Input
                    label="Confirmar Senha"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />

                  <Button
                    type="submit"
                    loading={isLoading}
                    className="w-full"
                    icon={<ArrowRight className="w-4 h-4" />}
                    iconPosition="right"
                  >
                    Redefinir Senha
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    }>
      <ResetPasswordForm />
    </React.Suspense>
  )
}
