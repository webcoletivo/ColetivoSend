'use client'

import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Sparkles, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Password strength
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }
  const passwordStrength = Object.values(passwordChecks).filter(Boolean).length

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Nome é obrigatório'
    if (!email) newErrors.email = 'E-mail é obrigatório'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'E-mail inválido'
    if (password.length < 8) newErrors.password = 'Senha deve ter pelo menos 8 caracteres'
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    setErrors({})
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setErrors({ submit: data.error || 'Erro ao criar conta' })
        return
      }
      
      // Redirect to verify email page
      window.location.href = '/verify-email?email=' + encodeURIComponent(email)
    } catch (error) {
      setErrors({ submit: 'Erro ao criar conta. Tente novamente.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    await signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl" />
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
            Crie sua conta
          </h1>
          <p className="text-surface-500">
            Desbloqueie todos os recursos premium
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-6 p-4 bg-primary-50 rounded-xl border border-primary-100">
          <p className="text-sm font-medium text-primary-700 mb-2">Com uma conta você pode:</p>
          <ul className="space-y-1 text-sm text-primary-600">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Enviar até 1GB por transfer
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Escolher a expiração do link
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Proteger com senha
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Ver histórico de envios
            </li>
          </ul>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Nome"
              placeholder="Como devemos te chamar?"
              value={name}
              onChange={e => setName(e.target.value)}
              error={errors.name}
            />

            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              error={errors.email}
            />

            <div className="space-y-2">
              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Crie uma senha forte"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  error={errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-surface-400 hover:text-surface-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password strength indicator */}
              {password && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= passwordStrength
                            ? passwordStrength <= 2
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-surface-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'length', label: '8+ caracteres' },
                      { key: 'uppercase', label: 'Maiúscula' },
                      { key: 'lowercase', label: 'Minúscula' },
                      { key: 'number', label: 'Número' },
                    ].map(check => (
                      <span
                        key={check.key}
                        className={`text-xs px-2 py-1 rounded-full transition-colors ${
                          passwordChecks[check.key as keyof typeof passwordChecks]
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-surface-100 text-surface-400'
                        }`}
                      >
                        {check.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {errors.submit && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm">
                {errors.submit}
              </div>
            )}

            <Button
              type="submit"
              loading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="w-full"
            >
              Criar conta
            </Button>
          </form>

          <p className="text-center text-xs text-surface-400 mt-4">
            Ao criar uma conta, você concorda com nossos{' '}
            <a href="/terms" className="text-primary-500 hover:underline">Termos</a> e{' '}
            <a href="/privacy" className="text-primary-500 hover:underline">Política de Privacidade</a>
          </p>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-surface-400">ou</span>
            </div>
          </div>

          <Button variant="secondary" className="w-full" onClick={handleGoogleSignup}>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Criar conta com Google
          </Button>

          <p className="text-center text-sm text-surface-500 mt-6">
            Já tem uma conta?{' '}
            <a href="/login" className="text-primary-500 font-medium hover:text-primary-600 transition-colors">
              Entrar
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
