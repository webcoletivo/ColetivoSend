'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Shield, 
  Smartphone, 
  Key,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  Download,
  Eye,
  EyeOff,
  Lock,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function SecurityPage() {
  const { data: session } = useSession()
  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasPassword, setHasPassword] = useState(false)

  // 2FA setup state
  const [showSetup, setShowSetup] = useState(false)
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'recovery'>('qr')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  // Disable 2FA state
  const [showDisable, setShowDisable] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [isDisabling, setIsDisabling] = useState(false)

  // Fetch user security status
  useEffect(() => {
    async function fetchSecurityStatus() {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setTwoFactorEnabled(data.twoFactorEnabled)
          setHasPassword(data.hasPassword)
        }
      } catch (error) {
        console.error('Error fetching security status:', error)
      } finally {
        setIsLoading(false)
      }
    }
    if (session?.user) {
      fetchSecurityStatus()
    }
  }, [session])

  const handleStartSetup = async () => {
    setError('')
    setShowSetup(true)
    setSetupStep('qr')
    
    try {
      const res = await fetch('/api/user/2fa', { method: 'POST' })
      const data = await res.json()
      
      if (res.ok) {
        setQrCodeUrl(data.qrCodeUrl)
        setSecret(data.secret)
      } else {
        setError(data.error || 'Erro ao gerar QR code')
        setShowSetup(false)
      }
    } catch (error) {
      setError('Erro ao iniciar configuração')
      setShowSetup(false)
    }
  }

  const handleVerifyCode = async () => {
    if (verifyCode.length !== 6) {
      setError('O código deve ter 6 dígitos')
      return
    }

    setIsVerifying(true)
    setError('')

    try {
      const res = await fetch('/api/user/2fa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setRecoveryCodes(data.recoveryCodes)
        setSetupStep('recovery')
      } else {
        setError(data.error || 'Código inválido')
      }
    } catch (error) {
      setError('Erro ao verificar código')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleFinishSetup = () => {
    setTwoFactorEnabled(true)
    setShowSetup(false)
    setVerifyCode('')
    setQrCodeUrl('')
    setSecret('')
    setRecoveryCodes([])
    setSetupStep('qr')
  }

  const handleDisable2FA = async () => {
    if (!hasPassword && !disablePassword) {
      setError('Senha é necessária para desativar 2FA')
      return
    }

    setIsDisabling(true)
    setError('')

    try {
      const res = await fetch('/api/user/2fa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disablePassword }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setTwoFactorEnabled(false)
        setShowDisable(false)
        setDisablePassword('')
      } else {
        setError(data.error || 'Erro ao desativar 2FA')
      }
    } catch (error) {
      setError('Erro ao desativar 2FA')
    } finally {
      setIsDisabling(false)
    }
  }

  const copyRecoveryCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
  }

  const downloadRecoveryCodes = () => {
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'coletivosend-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 2FA Card */}
      <div className="card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              Autenticação de dois fatores (2FA)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione uma camada extra de segurança à sua conta usando um app autenticador.
            </p>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            twoFactorEnabled 
              ? 'bg-emerald-500/10 text-emerald-500' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {twoFactorEnabled ? 'Ativado' : 'Desativado'}
          </div>
        </div>

        {/* Error message */}
        {error && !showSetup && !showDisable && (
          <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 2FA Status */}
        {!showSetup && !showDisable && (
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-foreground">
                {twoFactorEnabled 
                  ? 'App autenticador configurado' 
                  : 'Nenhum app autenticador configurado'}
              </span>
            </div>
            {twoFactorEnabled ? (
                <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDisable(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Desativar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStartSetup}
              >
                Ativar 2FA
              </Button>
            )}
          </div>
        )}

        {/* Setup Flow */}
        <AnimatePresence>
          {showSetup && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border mt-6 pt-6"
            >
              {/* Step 1: QR Code */}
              {setupStep === 'qr' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">
                    1. Escaneie o QR code
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Use um app autenticador como Google Authenticator, Authy ou Microsoft Authenticator.
                  </p>
                  
                  <div className="flex justify-center py-4">
                    {qrCodeUrl ? (
                      <img 
                        src={qrCodeUrl} 
                        alt="QR Code" 
                        className="w-48 h-48 rounded-lg border border-border bg-white p-2"
                      />
                    ) : (
                      <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                      </div>
                    )}
                  </div>

                  {secret && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Ou digite manualmente:</p>
                      <code className="text-sm font-mono text-foreground break-all">{secret}</code>
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowSetup(false)
                        setError('')
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={() => setSetupStep('verify')}>
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Verify */}
              {setupStep === 'verify' && (
                <div className="space-y-4">
                  <h3 className="font-medium text-foreground">
                    2. Digite o código de verificação
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Insira o código de 6 dígitos do seu app autenticador.
                  </p>

                  <div className="max-w-xs">
                    <Input
                      label="Código de verificação"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-widest font-mono"
                      maxLength={6}
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => setSetupStep('qr')}
                    >
                      Voltar
                    </Button>
                    <Button 
                      onClick={handleVerifyCode}
                      loading={isVerifying}
                      disabled={verifyCode.length !== 6}
                    >
                      Verificar
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Recovery Codes */}
              {setupStep === 'recovery' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="w-5 h-5" />
                    <h3 className="font-medium">2FA ativado com sucesso!</h3>
                  </div>
                  
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Key className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-600">
                          Salve seus códigos de recuperação
                        </p>
                        <p className="text-sm text-amber-600/80 mt-1">
                          Se você perder acesso ao seu app autenticador, use um destes códigos para entrar na sua conta.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-4 bg-muted/30 rounded-xl font-mono text-sm">
                    {recoveryCodes.map((code, i) => (
                      <div key={i} className="p-2 bg-card rounded border border-border">
                        {code}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={copyRecoveryCodes}
                      icon={<Copy className="w-4 h-4" />}
                    >
                      Copiar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={downloadRecoveryCodes}
                      icon={<Download className="w-4 h-4" />}
                    >
                      Baixar
                    </Button>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={handleFinishSetup}>
                      Concluir
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Disable 2FA Flow */}
        <AnimatePresence>
          {showDisable && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-border mt-6 pt-6 space-y-4"
            >
              <h3 className="font-medium text-foreground">
                Desativar autenticação de dois fatores
              </h3>
              <p className="text-sm text-muted-foreground">
                Digite sua senha para confirmar a desativação do 2FA.
              </p>

              <Input
                label="Senha"
                type="password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                placeholder="••••••••"
              />

              {error && (
                <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowDisable(false)
                    setDisablePassword('')
                    setError('')
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDisable2FA}
                  loading={isDisabling}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Desativar 2FA
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Additional Info */}
      <div className="card p-6">
        <h3 className="font-medium text-foreground mb-4">Por que usar 2FA?</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Protege sua conta mesmo se sua senha for comprometida</span>
          </li>
          <li className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Adiciona uma camada extra de verificação no login</span>
          </li>
          <li className="flex items-start gap-3">
            <Smartphone className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
            <span>Códigos são gerados offline no seu dispositivo</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
