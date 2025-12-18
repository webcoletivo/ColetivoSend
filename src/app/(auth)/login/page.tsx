'use client'

import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate
    const newErrors: Record<string, string> = {}
    if (!email) newErrors.email = 'E-mail é obrigatório'
    if (!password) newErrors.password = 'Senha é obrigatória'
    
    // If 2FA is required, validate OTP
    if (requires2FA && !totpCode) {
      newErrors.totpCode = 'Código de verificação é obrigatório'
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    setErrors({})
    
    try {
      const result = await signIn('credentials', {
        email,
        password,
        totpCode: requires2FA ? totpCode : undefined,
        redirect: false,
      })
      
      if (result?.error) {
        // Check if 2FA is required
        if (result.error === '2FA_REQUIRED' || result.error.includes('2FA_REQUIRED')) {
          setRequires2FA(true)
          setErrors({})
        } else if (result.error.includes('verifique seu email')) {
          setErrors({ submit: result.error })
          setTimeout(() => {
            window.location.href = `/verify-email?email=${encodeURIComponent(email)}`
          }, 2000)
        } else if (result.error.includes('2FA inválido')) {
          setErrors({ totpCode: result.error })
        } else {
          setErrors({ submit: result.error })
        }
      } else if (result?.ok) {
        // Redirect to dashboard on success
        window.location.href = '/dashboard'
      }
    } catch (error) {
      setErrors({ submit: 'Erro ao fazer login. Tente novamente.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl" />
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
            <span className="text-2xl font-bold text-surface-900">
              Coletivo<span className="text-primary-500">Send</span>
            </span>
          </a>
          <h1 className="text-2xl font-bold text-surface-900 mb-2">
            Bem-vindo de volta
          </h1>
          <p className="text-surface-500">
            Entre para gerenciar seus envios
          </p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={errors.email}
            />

            {/* Password */}
            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                error={errors.password}
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

            {/* 2FA OTP Input - shown when required */}
            {requires2FA && (
              <div className="space-y-2">
                <div className="p-3 bg-primary-50 text-primary-700 rounded-lg border border-primary-200 text-sm mb-3">
                  <strong>Autenticação de dois fatores ativa.</strong>
                  <br />
                  Digite o código do seu aplicativo autenticador.
                </div>
                <Input
                  label="Código de verificação (6 dígitos)"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  error={errors.totpCode}
                  autoFocus
                />
              </div>
            )}

            {/* Forgot password */}
            <div className="text-right">
              <a 
                href="/forgot-password" 
                className="text-sm text-primary-500 hover:text-primary-600 transition-colors"
              >
                Esqueceu a senha?
              </a>
            </div>

            {/* Error message */}
            {errors.submit && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm">
                {errors.submit}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              loading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="w-full"
            >
              Entrar
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-surface-400">ou</span>
            </div>
          </div>

          {/* Google login */}
          <Button
            variant="secondary"
            onClick={handleGoogleLogin}
            className="w-full"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </Button>

          {/* Sign up link */}
          <p className="text-center text-sm text-surface-500 mt-6">
            Não tem uma conta?{' '}
            <a href="/signup" className="text-primary-500 font-medium hover:text-primary-600 transition-colors">
              Criar conta
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
