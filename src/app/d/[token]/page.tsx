'use client'

/**
 * Página pública de download (/send/d/<token>).
 *
 * Identidade visual do sistema unificado (dark #0C0B0A, card #131211,
 * acento laranja #FF6B1F) — autocontida, sem depender do tema do app.
 *
 * Download SEM abrir guias: as URLs presignadas já forçam
 * Content-Disposition: attachment, então uma âncora invisível baixa
 * direto; "baixar todos" dispara em sequência com pausa curta para o
 * navegador registrar cada arquivo.
 */

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Download, Lock, AlertCircle, Clock, Ban, FileImage,
  FileVideo, FileAudio, FileArchive, FileText, File, Loader2
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { formatBytes, formatDate } from '@/lib/utils'

type PageStatus = 'loading' | 'password' | 'ready' | 'expired' | 'revoked' | 'notfound' | 'error'

interface TransferFile {
  id: string
  originalName: string
  sizeBytes: number
  mimeType: string
  downloadUrl: string
}

interface TransferData {
  id: string
  senderName: string
  message: string | null
  expiresAt: string
  viewCount: number
  downloadCount: number
  files: TransferFile[]
  hasPassword?: boolean
}

const LARANJA = '#FF6B1F'

function IconeArquivo({ mimeType }: { mimeType: string }) {
  const cls = 'h-[18px] w-[18px] shrink-0'
  if (mimeType.startsWith('image/')) return <FileImage className={cls} aria-hidden />
  if (mimeType.startsWith('video/')) return <FileVideo className={cls} aria-hidden />
  if (mimeType.startsWith('audio/')) return <FileAudio className={cls} aria-hidden />
  if (/zip|rar|7z|tar|gzip|compressed/.test(mimeType)) return <FileArchive className={cls} aria-hidden />
  if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document'))
    return <FileText className={cls} aria-hidden />
  return <File className={cls} aria-hidden />
}

// Baixa sem abrir guia: âncora invisível + Content-Disposition attachment.
function dispararDownload(url: string) {
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0C0B0A] px-5 py-10 text-[#EDEAE6] antialiased">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-center">
          <Logo priority className="h-8 w-auto" />
        </header>
        {children}
        <p className="mt-8 text-center text-xs uppercase tracking-[0.18em] text-[#7A756E]">
          Grupo Coletivo · compartilhamento seguro de arquivos
        </p>
      </div>
    </div>
  )
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#262421] bg-[#131211] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
      <div className="h-1 w-full" style={{ background: LARANJA }} />
      {children}
    </div>
  )
}

export default function DownloadPage() {
  const params = useParams<{ token: string }>()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [transfer, setTransfer] = useState<TransferData | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [desbloqueando, setDesbloqueando] = useState(false)
  const [baixandoTodos, setBaixandoTodos] = useState(false)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<number>(0)

  useEffect(() => {
    const fetchTransfer = async () => {
      try {
        const res = await fetch(`/api/transfer/${params.token}`)
        const data = await res.json()
        if (res.status === 404) return setStatus('notfound')
        if (res.status === 410) return setStatus(data.code === 'expired' ? 'expired' : 'revoked')
        if (!res.ok) throw new Error('Erro ao carregar')
        if (data.hasPassword) {
          setStatus('password')
        } else {
          setTransfer(data)
          setStatus('ready')
        }
      } catch {
        setStatus('error')
      }
    }
    fetchTransfer()
  }, [params.token])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 1) return setPasswordError('Digite a senha')
    setDesbloqueando(true)
    setPasswordError('')
    try {
      const unlockRes = await fetch(`/api/transfer/${params.token}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await unlockRes.json()
      if (unlockRes.ok) {
        setTransfer(data)
        setStatus('ready')
      } else {
        setPasswordError(data.error || 'Senha incorreta')
      }
    } catch {
      setPasswordError('Erro de conexão')
    } finally {
      setDesbloqueando(false)
    }
  }

  const handleDownloadFile = (file: TransferFile) => {
    setBaixando(file.id)
    dispararDownload(file.downloadUrl)
    setTimeout(() => setBaixando(null), 900)
  }

  const handleDownloadAll = async () => {
    if (!transfer || baixandoTodos) return
    setBaixandoTodos(true)
    try {
      for (const [i, file] of transfer.files.entries()) {
        setProgresso(i + 1)
        dispararDownload(file.downloadUrl)
        // pausa para o navegador registrar cada download — nada de guias
        if (i < transfer.files.length - 1) await new Promise(r => setTimeout(r, 700))
      }
    } finally {
      setBaixandoTodos(false)
      setProgresso(0)
    }
  }

  const totalSize = transfer?.files?.reduce((acc, f) => acc + f.sizeBytes, 0) || 0

  if (status === 'loading') {
    return (
      <Moldura>
        <Cartao>
          <div className="flex flex-col items-center gap-4 px-8 py-16">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: LARANJA }} aria-hidden />
            <p className="text-sm text-[#A39D95]">Carregando envio…</p>
          </div>
        </Cartao>
      </Moldura>
    )
  }

  if (status === 'notfound' || status === 'expired' || status === 'revoked' || status === 'error') {
    const config = {
      notfound: { icon: AlertCircle, title: 'Link não encontrado', desc: 'Este link de download não existe ou foi removido.' },
      expired: { icon: Clock, title: 'Link expirado', desc: 'Este link de download expirou e não está mais disponível.' },
      revoked: { icon: Ban, title: 'Link desativado', desc: 'Este link foi desativado pelo remetente.' },
      error: { icon: AlertCircle, title: 'Erro no servidor', desc: 'Não foi possível carregar o envio. Tente novamente.' },
    }[status]
    const Icone = config.icon
    return (
      <Moldura>
        <Cartao>
          <div className="flex flex-col items-center px-8 py-14 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#33302C] bg-[#1B1917]">
              <Icone className="h-6 w-6 text-[#A39D95]" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold">{config.title}</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#A39D95]">{config.desc}</p>
          </div>
        </Cartao>
      </Moldura>
    )
  }

  if (status === 'password') {
    return (
      <Moldura>
        <Cartao>
          <div className="px-7 py-9 sm:px-9">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgba(255,107,31,0.12)' }}>
              <Lock className="h-5 w-5" style={{ color: LARANJA }} aria-hidden />
            </div>
            <h1 className="text-xl font-semibold">Envio protegido por senha</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#A39D95]">
              O conteúdo deste envio só aparece depois da senha.
            </p>
            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <input
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-[#33302C] bg-[#1B1917] px-4 py-3 text-sm text-[#EDEAE6] outline-none transition-colors placeholder:text-[#7A756E] focus:border-[#FF6B1F]"
              />
              {passwordError && <p className="text-sm text-[#F0665C]">{passwordError}</p>}
              <button
                type="submit"
                disabled={desbloqueando}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#131211] transition-opacity disabled:opacity-60"
                style={{ background: LARANJA }}
              >
                {desbloqueando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Acessar arquivos
              </button>
            </form>
          </div>
        </Cartao>
      </Moldura>
    )
  }

  return (
    <Moldura>
      <Cartao>
        {/* Cabeçalho do envio */}
        <div className="border-b border-[#262421] px-7 py-7 sm:px-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7A756E]">
            Enviado por
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight">{transfer?.senderName}</h1>
          {transfer?.message && (
            <div className="mt-4 rounded-xl border border-[#262421] bg-[#1B1917] px-4 py-3">
              <p className="text-sm leading-relaxed text-[#C9C3BB]">“{transfer.message}”</p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#A39D95]">
            <span>
              {transfer?.files.length} arquivo{transfer?.files.length !== 1 ? 's' : ''} · {formatBytes(totalSize)}
            </span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-[#33302C]" />
            <span>Expira em {formatDate(transfer?.expiresAt || '')}</span>
          </div>
        </div>

        {/* Lista de arquivos */}
        <ul className="divide-y divide-[#201E1B] px-3 py-2 sm:px-4">
          {transfer?.files.map(file => {
            const ocupado = baixando === file.id
            return (
              <li key={file.id} className="group flex items-center gap-4 px-3 py-3.5 sm:px-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#33302C] bg-[#1B1917]"
                  style={{ color: LARANJA }}
                >
                  <IconeArquivo mimeType={file.mimeType} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.originalName}</p>
                  <p className="text-xs text-[#7A756E]">{formatBytes(file.sizeBytes)}</p>
                </div>
                <button
                  onClick={() => handleDownloadFile(file)}
                  disabled={ocupado || baixandoTodos}
                  aria-label={`Baixar ${file.originalName}`}
                  className="flex items-center gap-1.5 rounded-lg border border-[#33302C] px-3 py-2 text-xs font-semibold text-[#C9C3BB] transition-colors hover:border-[#FF6B1F] hover:text-[#FF6B1F] disabled:opacity-50"
                >
                  {ocupado
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    : <Download className="h-3.5 w-3.5" aria-hidden />}
                  Baixar
                </button>
              </li>
            )
          })}
        </ul>

        {/* Baixar tudo */}
        <div className="px-7 pb-7 pt-2 sm:px-9">
          <button
            onClick={handleDownloadAll}
            disabled={baixandoTodos}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-[#131211] transition-opacity hover:opacity-90 disabled:opacity-70"
            style={{ background: LARANJA }}
          >
            {baixandoTodos ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Baixando {progresso} de {transfer?.files.length}…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                Baixar todos os arquivos
              </>
            )}
          </button>
          <p className="mt-3 text-center text-xs text-[#7A756E]">
            Os arquivos são baixados direto, um a um — sem abrir novas guias.
          </p>
        </div>
      </Cartao>
    </Moldura>
  )
}
