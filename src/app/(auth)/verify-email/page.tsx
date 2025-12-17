'use client'

import React, { Suspense } from 'react'
import { motion } from 'framer-motion'
import { Mail, Sparkles, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSearchParams } from 'next/navigation'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || 'seu e-mail'

  const handleResend = async () => {
    // Simulate resend
    await new Promise(r => setTimeout(r, 1000))
  }

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
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6"
        >
          <Mail className="w-10 h-10 text-primary-500" />
        </motion.div>

        <h1 className="text-2xl font-bold text-surface-900 mb-3">
          Verifique seu e-mail
        </h1>
        <p className="text-surface-500 mb-6">
          Enviamos um link de verificação para
          <br />
          <strong className="text-surface-700">{email}</strong>
        </p>

        <div className="space-y-4">
          <p className="text-sm text-surface-400">
            Clique no link do e-mail para ativar sua conta.
          </p>
          
          <Button
            variant="secondary"
            onClick={handleResend}
            icon={<RefreshCw className="w-4 h-4" />}
            className="w-full"
          >
            Reenviar e-mail
          </Button>
        </div>

        <p className="text-xs text-surface-400 mt-6">
          Não recebeu? Verifique a pasta de spam.
        </p>
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
