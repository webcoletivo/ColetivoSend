'use client'

import React, { Suspense } from 'react'
import { motion } from 'framer-motion'
import { Mail, Sparkles, RefreshCw, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { showToast } = useToast()
  
  const email = searchParams.get('email') || ''
  const token = searchParams.get('token')
  
  const [isVerifying, setIsVerifying] = React.useState(!!token)
  const [verificationStatus, setVerificationStatus] = React.useState<'pending' | 'success' | 'error'>(token ? 'pending' : 'pending')
  const [error, setError] = React.useState('')
  const [isResending, setIsResending] = React.useState(false)
  const [resendCooldown, setResendCooldown] = React.useState(0)
  const verificationStarted = React.useRef(false)

  // Handle automatic verification if token is present
  React.useEffect(() => {
    if (token && !verificationStarted.current) {
      verificationStarted.current = true
      verifyEmail()
    }
  }, [token])

  const verifyEmail = async () => {
    try {
      const res = await fetch('/api/auth/verify-email/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        setVerificationStatus('success')
        showToast('E-mail verificado com sucesso!', 'success')
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        const data = await res.json()
        setVerificationStatus('error')
        setError(data.error || 'Erro ao verificar e-mail')
      }
    } catch (err) {
      setVerificationStatus('error')
      setError('Erro de conexão')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!email) {
      showToast('E-mail não encontrado no link', 'error')
      return
    }

    setIsResending(true)
    try {
      const res = await fetch('/api/auth/verify-email/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        showToast('Novo e-mail enviado!', 'success')
        setResendCooldown(60) // 1 minute cooldown
      } else {
        const data = await res.json()
        showToast(data.error || 'Erro ao enviar e-mail', 'error')
      }
    } catch (err) {
      showToast('Erro de conexão', 'error')
    } finally {
      setIsResending(false)
    }
  }

  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md text-center"
    >
      {/* Logo */}
      <a href="/" className="inline-flex items-center gap-2 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-bold text-surface-900">
          Flow<span className="text-primary-500">Send</span>
        </span>
      </a>

      <div className="card p-8">
        {verificationStatus === 'success' ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900 mb-3">
              E-mail Verificado!
            </h1>
            <p className="text-surface-500 mb-8">
              Sua conta foi ativada com sucesso. Você será redirecionado para o login em instantes.
            </p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Ir para o Login
            </Button>
          </motion.div>
        ) : verificationStatus === 'error' ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-surface-900 mb-3">
              Falha na Verificação
            </h1>
            <p className="text-surface-500 mb-8">{error}</p>
            <div className="space-y-3">
              <Button onClick={() => router.push('/signup')} variant="secondary" className="w-full">
                Criar nova conta
              </Button>
              <Link href="/" className="text-sm text-surface-400 hover:text-surface-600">
                Voltar ao Início
              </Link>
            </div>
          </div>
        ) : (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6"
            >
              {isVerifying ? (
                <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
              ) : (
                <Mail className="w-10 h-10 text-primary-500" />
              )}
            </motion.div>

            <h1 className="text-2xl font-bold text-surface-900 mb-3">
              {isVerifying ? 'Verificando...' : 'Verifique seu e-mail'}
            </h1>
            <p className="text-surface-500 mb-6">
              {email ? (
                <>
                  Enviamos um link de verificação para
                  <br />
                  <strong className="text-surface-700">{email}</strong>
                </>
              ) : (
                'Procure pelo e-mail de verificação que enviamos para você.'
              )}
            </p>

            <div className="space-y-4">
              <p className="text-sm text-surface-400">
                Clique no link do e-mail para ativar sua conta.
              </p>
              
              <Button
                variant="secondary"
                onClick={handleResend}
                loading={isResending}
                disabled={resendCooldown > 0 || !email}
                icon={resendCooldown === 0 && <RefreshCw className="w-4 h-4" />}
                className="w-full"
              >
                {resendCooldown > 0 ? `Aguarde ${resendCooldown}s` : 'Reenviar e-mail'}
              </Button>
            </div>

            <p className="text-xs text-surface-400 mt-6">
              Não recebeu? Verifique a pasta de spam.
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <Suspense fallback={
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      }>
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
