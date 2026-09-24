'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Clock, X, Check, Lock, Copy, RefreshCw, UserRound } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { UploadDropzone } from '@/components/upload/UploadDropzone'
import { FileList, FileItem } from '@/components/upload/FileList'
import { ProgressBar } from '@/components/upload/ProgressBar'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { formatBytes } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { getUploadManager, UploadProgress as UploadProgressType } from '@/lib/upload/UploadManager'
import { BASE_PATH, caminhoSso, entrarPelaPlataforma } from '@/lib/sso-client'

// Limits configuration
const MAX_FILES = parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILES || '2000')
const MAX_SIZE = parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_SIZE_MB || '10240') * 1024 * 1024

const EXPIRY_OPTIONS = [
    { value: 0.0416, label: '1 hora' },
    { value: 1, label: '1 dia' },
    { value: 7, label: '7 dias' },
    { value: 30, label: '30 dias' },
]

// E-mail "bom o bastante" para virar chip; o servidor valida de novo.
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Separa um texto colado/digitado em e-mails válidos e inválidos. */
function separarEmails(texto: string): { validos: string[]; invalidos: string[] } {
    const validos: string[] = []
    const invalidos: string[] = []
    for (const parte of texto.split(/[,;\s]+/)) {
        const email = parte.trim().toLowerCase()
        if (!email) continue
        if (EMAIL_VALIDO.test(email)) validos.push(email)
        else invalidos.push(email)
    }
    return { validos, invalidos }
}

interface TransferCardProps {
    className?: string
}

export function TransferCard({ className = '' }: TransferCardProps) {
    const { data: session, status } = useSession()
    const { showToast } = useToast()
    const isLoggedIn = !!session?.user
    const isLoadingAuth = status === 'loading'

    // Remetente = conta da plataforma (nome vem do SSO; o servidor confirma
    // na finalização). Não é editável: o envio sai sempre em nome de quem
    // está logado.
    const nomeRemetente = session?.user?.name?.trim() || session?.user?.email || ''
    const emailRemetente = session?.user?.email || ''

    // Form state
    const [files, setFiles] = useState<FileItem[]>([])
    const [recipientEmails, setRecipientEmails] = useState<string[]>([])
    const [emailInput, setEmailInput] = useState('')
    const [emailErro, setEmailErro] = useState<string | null>(null)
    const [message, setMessage] = useState('')
    const [expiryDays, setExpiryDays] = useState(7)
    const emailInputRef = useRef<HTMLInputElement>(null)

    // Password state
    const [hasPassword, setHasPassword] = useState(false)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')

    // Upload state
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'finalize' | 'complete' | 'error'>('idle')
    const [uploadMessage, setUploadMessage] = useState('')
    const [bytesUploadedMap, setBytesUploadedMap] = useState<Record<string, number>>({})
    const [estimatedTime, setEstimatedTime] = useState('')

    // Result state
    const [transferResult, setTransferResult] = useState<{
        shareToken: string,
        expiresAt: string,
        recipientCount: number
    } | null>(null)

    // Derived state
    const totalSize = files.reduce((acc, item) => acc + item.file.size, 0)
    const totalCount = files.length
    const totalBytesUploaded = Object.values(bytesUploadedMap).reduce((acc, bytes) => acc + bytes, 0)
    // Progresso geral derivado do mapa de bytes (o callback de upload não vê
    // o estado atual dos outros arquivos — derivar evita a barra voltar).
    const uploadProgress = totalSize > 0 ? Math.min(100, (totalBytesUploaded / totalSize) * 100) : 0
    const canContinue = files.length > 0 && totalSize <= MAX_SIZE && totalCount <= MAX_FILES
    const isUploading = uploadStatus === 'uploading' || uploadStatus === 'processing' || uploadStatus === 'finalize'
    const isSuccess = uploadStatus === 'complete' && transferResult

    // Password validation
    const senhaCurta = password.length > 0 && password.length < 6
    const senhasDiferentes = confirmPassword.length > 0 && password !== confirmPassword
    const isPasswordValid = !hasPassword || (password.length >= 6 && password === confirmPassword)

    // Load draft if exists (e.g. returning from login)
    useEffect(() => {
        const draftStr = sessionStorage.getItem('pending_upload_draft')
        if (draftStr) {
            try {
                const draft = JSON.parse(draftStr)
                if (draft.recipientEmails) setRecipientEmails(draft.recipientEmails)
                if (draft.message) setMessage(draft.message)
                if (draft.expiryDays) setExpiryDays(draft.expiryDays)

                // Clear draft after loading
                sessionStorage.removeItem('pending_upload_draft')

                if (isLoggedIn) {
                    showToast('Rascunho recuperado. Por favor, selecione os arquivos novamente.', 'info')
                }
            } catch (e) {
                console.error('Failed to parse draft', e)
            }
        }
    }, [isLoggedIn, showToast])

    // Reset when starting fresh
    const handleNewTransfer = () => {
        setFiles([])
        setRecipientEmails([])
        setEmailInput('')
        setEmailErro(null)
        setMessage('')
        setExpiryDays(7)
        setHasPassword(false)
        setPassword('')
        setConfirmPassword('')
        setUploadStatus('idle')
        setUploadMessage('')
        setBytesUploadedMap({})
        setTransferResult(null)
    }

    // File handlers
    const handleFilesAdded = useCallback((newFiles: File[]) => {
        if (!isLoggedIn) {
            entrarPelaPlataforma(BASE_PATH)
            return
        }

        setFiles(prev => {
            const updatedFiles = [...prev]
            const remainingNewFiles = [...newFiles]

            // Match with waiting files
            for (let i = 0; i < updatedFiles.length; i++) {
                if (updatedFiles[i].status === 'waiting') {
                    const matchIndex = remainingNewFiles.findIndex(
                        f => f.name === updatedFiles[i].file.name && f.size === updatedFiles[i].file.size
                    )

                    if (matchIndex !== -1) {
                        updatedFiles[i] = {
                            ...updatedFiles[i],
                            file: remainingNewFiles[matchIndex],
                            status: 'pending'
                        }
                        remainingNewFiles.splice(matchIndex, 1)
                    }
                }
            }

            const newItems: FileItem[] = remainingNewFiles.map(file => ({
                id: uuidv4(),
                file,
                status: 'pending',
            }))

            return [...updatedFiles, ...newItems]
        })
    }, [isLoggedIn])

    const handleRemoveFile = useCallback((id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id))
    }, [])

    // Email handlers — o texto pendente vira chip com Enter, vírgula, ponto e
    // vírgula, Tab/clique fora (blur) e também ao clicar em "Transferir".
    /** Consome o texto do campo; devolve a lista final ou null se houver e-mail inválido. */
    const consumirEmailPendente = (): string[] | null => {
        const texto = emailInput.trim()
        if (!texto) {
            setEmailErro(null)
            return recipientEmails
        }
        const { validos, invalidos } = separarEmails(texto)
        const lista = Array.from(new Set([...recipientEmails, ...validos]))
        setRecipientEmails(lista)
        if (invalidos.length) {
            setEmailInput(invalidos.join(', '))
            setEmailErro(`E-mail inválido: ${invalidos.join(', ')}`)
            return null
        }
        setEmailInput('')
        setEmailErro(null)
        return lista
    }

    const removeEmail = (email: string) => {
        setRecipientEmails(prev => prev.filter(e => e !== email))
        emailInputRef.current?.focus()
    }

    const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
            e.preventDefault()
            consumirEmailPendente()
        } else if (e.key === 'Backspace' && emailInput === '' && recipientEmails.length) {
            // apaga o último chip como num campo de tags
            setRecipientEmails(prev => prev.slice(0, -1))
        }
    }

    // Upload & Finalize handler with chunked upload
    const handleTransfer = async () => {
        if (!isLoggedIn) {
            entrarPelaPlataforma(BASE_PATH)
            return
        }

        if (files.length === 0) return

        // O que está digitado no campo de e-mail conta: vira chip agora ou
        // barra o envio com aviso (antes, o clique não fazia nada visível).
        const destinatarios = consumirEmailPendente()
        if (destinatarios === null) {
            showToast('Corrija o e-mail do destinatário antes de transferir', 'error')
            emailInputRef.current?.focus()
            return
        }

        if (!isPasswordValid) {
            showToast('Verifique a senha antes de continuar', 'error')
            return
        }

        setUploadStatus('uploading')
        setBytesUploadedMap({})
        setEstimatedTime('')
        const uploadedFilesData = []

        // Generate transfer ID
        const transferId = uuidv4()
        const uploadManager = getUploadManager()

        try {
            // Upload files with chunking
            for (let i = 0; i < files.length; i++) {
                const item = files[i]
                setUploadMessage(`Enviando ${i + 1} de ${files.length}: ${item.file.name}`)

                // Upload file with progress callback
                const result = await uploadManager.uploadFile(
                    item.file,
                    transferId,
                    item.id,
                    (progress: UploadProgressType) => {
                        // Update progress for this file
                        setBytesUploadedMap(prev => ({
                            ...prev,
                            [item.id]: progress.uploadedBytes
                        }))

                        // Update estimated time
                        if (progress.estimatedTimeRemaining > 0) {
                            const seconds = progress.estimatedTimeRemaining
                            if (seconds > 60) {
                                setEstimatedTime(`${Math.floor(seconds / 60)}m ${seconds % 60}s`)
                            } else {
                                setEstimatedTime(`${seconds}s`)
                            }
                        }
                    }
                )

                uploadedFilesData.push({
                    id: item.id,
                    name: item.file.name,
                    size: item.file.size,
                    type: item.file.type,
                    storageKey: result.storageKey
                })
            }

            // 3. Finalize Transfer
            setUploadStatus('finalize')
            setUploadMessage('Finalizando envio...')

            const finalizePayload = {
                transferId,
                // nome de exibição da plataforma (o servidor reconfirma no verify)
                senderName: (nomeRemetente || emailRemetente.split('@')[0] || 'Usuário').slice(0, 100),
                recipientEmail: destinatarios.length > 0 ? destinatarios.join(',') : null,
                message,
                files: uploadedFilesData,
                expirationDays: expiryDays,
                password: hasPassword ? password : null
            }

            const finalizeRes = await fetch('/api/transfers/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalizePayload)
            })

            const finalizeData = await finalizeRes.json()
            if (!finalizeRes.ok) throw new Error(finalizeData.error || 'Erro ao finalizar envio')

            // 4. Send Emails (if recipients exist)
            if (destinatarios.length > 0) {
                setUploadMessage('Enviando e-mails...')
                await fetch(`/api/transfers/${finalizeData.transfer.id}/email`, { method: 'POST' }).catch(console.warn)
            }

            setTransferResult({
                shareToken: finalizeData.transfer.shareToken,
                expiresAt: finalizeData.transfer.expiresAt,
                recipientCount: destinatarios.length
            })

            setUploadStatus('complete')

        } catch (error: any) {
            console.error('Upload failed:', error)
            setUploadStatus('error')

            // Better error messages
            let errorMessage = 'Falha no upload'
            if (error.code === 'AUTH_ERROR') {
                errorMessage = 'Sessão expirada. Por favor, faça login novamente.'
            } else if (error.code === 'NETWORK_ERROR') {
                errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.'
            } else if (error.message) {
                errorMessage = error.message
            }

            setUploadMessage(errorMessage)
        }
    }

    // Success View
    if (isSuccess && transferResult) {
        const shareLink = `${window.location.origin}${BASE_PATH}/d/${transferResult.shareToken}`

        return (
            <div className={`transfer-card w-full max-w-md ${className}`}>
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2" aria-hidden="true">
                        <Check className="w-8 h-8" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">Envio concluído!</h2>
                        <p className="text-muted-foreground" role="status">
                            {transferResult.recipientCount > 0
                                ? `E-mail enviado para ${transferResult.recipientCount} destinatário(s).`
                                : 'Seus arquivos estão prontos para compartilhar.'}
                        </p>
                    </div>

                    <div className="w-full space-y-2">
                        <label htmlFor="link-download" className="rotulo-campo text-left">Link de download</label>
                        <div className="flex gap-2">
                            <input
                                id="link-download"
                                readOnly
                                value={shareLink}
                                onFocus={(e) => e.currentTarget.select()}
                                className="input flex-1 font-mono text-xs"
                            />
                            <Button
                                onClick={() => {
                                    navigator.clipboard.writeText(shareLink)
                                    showToast('Link copiado!', 'success')
                                }}
                                className="shrink-0"
                                aria-label="Copiar link de download"
                            >
                                <Copy className="w-4 h-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground pt-2">
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" aria-hidden="true" />
                            <span>
                                Expira em {EXPIRY_OPTIONS.find(o => o.value === expiryDays)?.label}
                            </span>
                        </div>
                        {hasPassword && (
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                                <Lock className="w-4 h-4" aria-hidden="true" />
                                <span>Protegido com senha</span>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 w-full">
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleNewTransfer}
                            icon={<RefreshCw className="w-4 h-4" aria-hidden="true" />}
                        >
                            Enviar mais arquivos
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={`transfer-card w-full max-w-md ${className}`}>
            {/* Login Overlay if not logged in */}
            {!isLoadingAuth && !isLoggedIn && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 rounded-xl">
                    <Lock className="w-12 h-12 text-primary mb-2" aria-hidden="true" />
                    <h3 className="text-2xl font-bold">Faça login para enviar</h3>
                    <p className="text-muted-foreground text-sm max-w-xs">
                        Para garantir a segurança e qualidade dos envios (até 10GB), é necessário estar logado.
                    </p>
                    {/* Ponte SSO (navegação inteira de propósito: grava cookie e volta) */}
                    <a href={caminhoSso(BASE_PATH)} className="btn btn-primary w-full max-w-[200px]">
                        Entrar / Criar Conta
                    </a>
                </div>
            )}

            <div className={`p-6 md:p-8 space-y-5 ${!isLoggedIn ? 'opacity-30 pointer-events-none filter blur-[1px]' : ''}`}>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Enviar arquivos</h2>
                    {files.length > 0 && !isUploading && (
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                                {formatBytes(totalSize)}
                            </span>
                            <button
                                type="button"
                                onClick={() => setFiles([])} // Quick clear
                                className="text-xs font-medium text-red-700 dark:text-red-400 hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                Limpar
                            </button>
                        </div>
                    )}
                </div>

                {/* Upload area */}
                {!isUploading && (
                    <>
                        <UploadDropzone
                            onFilesAdded={handleFilesAdded}
                            maxFiles={MAX_FILES}
                            maxSize={MAX_SIZE}
                            currentFileCount={totalCount}
                            currentTotalSize={totalSize}
                        />

                        {/* File list */}
                        {files.length > 0 && (
                            <FileList
                                files={files}
                                onRemove={handleRemoveFile}
                                maxFiles={MAX_FILES}
                                maxSize={MAX_SIZE}
                            />
                        )}
                    </>
                )}

                {/* Progress */}
                {(isUploading || uploadStatus === 'error') && (
                    <div className="py-8">
                        <ProgressBar
                            progress={uploadProgress}
                            status={uploadStatus === 'error' ? 'error' : (uploadStatus === 'processing' || uploadStatus === 'finalize') ? 'processing' : 'uploading'}
                            message={uploadMessage}
                            bytesUploaded={totalBytesUploaded}
                            totalBytes={totalSize}
                            estimatedTime={estimatedTime}
                        />
                        {uploadStatus === 'error' && (
                            <Button
                                variant="secondary"
                                className="w-full mt-4"
                                onClick={() => setUploadStatus('idle')}
                            >
                                Tentar novamente
                            </Button>
                        )}
                    </div>
                )}

                {/* Form fields */}
                {!isUploading && files.length > 0 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">

                        {/* Recipient emails */}
                        <div>
                            <label htmlFor="destinatarios" className="rotulo-campo">
                                E-mail para <span className="font-normal text-muted-foreground">(opcional — sem e-mail, só o link)</span>
                            </label>
                            <div
                                className={`flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg border min-h-[42px] focus-within:ring-2 focus-within:ring-ring transition-all cursor-text ${emailErro ? 'border-destructive' : 'border-border'}`}
                                onClick={() => emailInputRef.current?.focus()}
                            >
                                {recipientEmails.map(email => (
                                    <span key={email} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 bg-muted text-foreground text-sm rounded-md border border-border animate-in zoom-in duration-200">
                                        {email}
                                        <button
                                            type="button"
                                            onClick={() => removeEmail(email)}
                                            aria-label={`Remover ${email}`}
                                            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            <X className="w-3 h-3" aria-hidden="true" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    ref={emailInputRef}
                                    id="destinatarios"
                                    type="email"
                                    multiple
                                    autoComplete="email"
                                    value={emailInput}
                                    onChange={(e) => { setEmailInput(e.target.value); if (emailErro) setEmailErro(null) }}
                                    onKeyDown={handleEmailKeyDown}
                                    onBlur={() => consumirEmailPendente()}
                                    placeholder={recipientEmails.length ? '' : 'adicionar@email.com'}
                                    aria-invalid={emailErro ? true : undefined}
                                    aria-describedby={emailErro ? 'destinatarios-erro' : 'destinatarios-dica'}
                                    className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                                />
                            </div>
                            {emailErro ? (
                                <p id="destinatarios-erro" role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-400">{emailErro}</p>
                            ) : (
                                <p id="destinatarios-dica" className="mt-1.5 text-xs text-muted-foreground">Vários e-mails: separe por vírgula ou Enter.</p>
                            )}
                        </div>

                        {/* Sender (conta da plataforma, não editável) */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <UserRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span>
                                Enviado por <span className="font-medium text-foreground">{nomeRemetente || 'você'}</span>
                                {emailRemetente && nomeRemetente !== emailRemetente && (
                                    <span className="text-muted-foreground"> · {emailRemetente}</span>
                                )}
                            </span>
                        </div>

                        {/* Message */}
                        <div>
                            <label htmlFor="mensagem" className="rotulo-campo">Mensagem</label>
                            <textarea
                                id="mensagem"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Mensagem (opcional)"
                                maxLength={500}
                                rows={2}
                                className="input h-auto resize-none"
                            />
                        </div>

                        <div className="h-px bg-border my-4" aria-hidden="true" />

                        {/* Settings: Expiry & Password */}
                        <div className="space-y-4">
                            {/* Expiry Selector: listbox próprio (sem a lista nativa do navegador), altura h-10 dos inputs */}
                            <div className="flex items-center justify-between gap-4">
                                <label id="expiracao-rotulo" htmlFor="expiracao" className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Clock className="w-4 h-4" aria-hidden="true" />
                                    <span>Expira em</span>
                                </label>
                                <Select
                                    id="expiracao"
                                    rotuloId="expiracao-rotulo"
                                    value={expiryDays}
                                    onChange={setExpiryDays}
                                    opcoes={EXPIRY_OPTIONS}
                                    className="min-w-[8rem]"
                                />
                            </div>

                            {/* Password Toggle (checkbox real, rotulado) */}
                            <div>
                                <label className={`inline-flex items-center gap-2 text-sm cursor-pointer select-none ${hasPassword ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                    <input
                                        type="checkbox"
                                        checked={hasPassword}
                                        onChange={(e) => setHasPassword(e.target.checked)}
                                        className="w-4 h-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <Lock className="w-4 h-4" aria-hidden="true" />
                                    <span>Proteger com senha</span>
                                </label>

                                <AnimatePresence>
                                    {hasPassword && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                                            animate={{ height: 'auto', opacity: 1, marginTop: 12 }}
                                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                            className="overflow-hidden space-y-3"
                                        >
                                            <div>
                                                <label htmlFor="senha" className="rotulo-campo">Senha <span className="font-normal text-muted-foreground">(mínimo 6 caracteres)</span></label>
                                                <input
                                                    id="senha"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    aria-invalid={senhaCurta || undefined}
                                                    aria-describedby={senhaCurta ? 'senha-erro' : undefined}
                                                    className={`input text-sm ${senhaCurta ? 'border-destructive' : ''}`}
                                                />
                                                {senhaCurta && (
                                                    <p id="senha-erro" className="mt-1.5 text-xs text-red-700 dark:text-red-400">Mínimo de 6 caracteres</p>
                                                )}
                                            </div>
                                            <div>
                                                <label htmlFor="confirmar-senha" className="rotulo-campo">Confirmar senha</label>
                                                <input
                                                    id="confirmar-senha"
                                                    type="password"
                                                    autoComplete="new-password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    aria-invalid={senhasDiferentes || undefined}
                                                    aria-describedby={senhasDiferentes ? 'confirmar-senha-erro' : undefined}
                                                    className={`input text-sm ${senhasDiferentes ? 'border-destructive' : ''}`}
                                                />
                                                {senhasDiferentes && (
                                                    <p id="confirmar-senha-erro" className="mt-1.5 text-xs text-red-700 dark:text-red-400">As senhas não conferem</p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={handleTransfer}
                                disabled={!canContinue || isLoadingAuth}
                                className="w-full"
                                size="lg"
                                icon={<Send className="w-4 h-4" aria-hidden="true" />}
                                iconPosition="left"
                            >
                                Transferir Arquivos
                            </Button>
                        </div>
                    </div>
                )}

                {/* Initial CTA when no files */}
                {!isUploading && files.length === 0 && (
                    <div className="text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                            {isLoggedIn ? (
                                'Arraste arquivos ou clique para selecionar'
                            ) : (
                                <>
                                    <a href={caminhoSso(BASE_PATH)} className="text-foreground font-medium underline decoration-primary underline-offset-4">Faça login</a> para enviar arquivos
                                </>
                            )}
                        </p>
                        {/* muted-foreground pleno: /70 dava 2,9:1 */}
                        <p className="text-xs text-muted-foreground">
                            Até 10 GB por transferência
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
