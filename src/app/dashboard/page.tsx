'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Copy, Trash2,
  ExternalLink, FileIcon, Ban,
  Settings, CheckCircle2, Loader2,
  Clock, CheckCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'
import { MenuAcoes } from '@/components/ui/MenuAcoes'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { SkeletonTable, SkeletonStatCard } from '@/components/ui/Skeleton'
import { formatBytes, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/Toast'
import { BASE_PATH, entrarPelaPlataforma } from '@/lib/sso-client'

// Links públicos precisam do basePath: <a> puro e window.location.origin não
// ganham o prefixo /send automaticamente (só o <Link> do Next ganha).

// Views/downloads mudam por ação de quem recebe o link: atualização leve em
// segundo plano, só com a aba visível, mais refetch ao voltar para a aba.
const INTERVALO_ATUALIZACAO_MS = 30_000

interface Transfer {
  id: string
  senderName: string
  recipientEmail: string | null
  status: 'active' | 'expired' | 'revoked'
  expiresAt: string
  createdAt: string
  shareToken: string
  viewCount: number
  downloadCount: number
  totalSizeBytes: number
  fileCount: number
}

interface DashboardStats {
  total: number
  active: number
  expired: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()

  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [stats, setStats] = useState<DashboardStats>({ total: 0, active: 0, expired: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  // Diálogo de exclusão (no lugar do confirm() nativo)
  const [excluindo, setExcluindo] = useState<Transfer | null>(null)
  const [excluindoOcupado, setExcluindoOcupado] = useState(false)
  const buscando = useRef(false)
  const logado = !!session?.user

  // Busca lista + resumo. `silencioso` = atualização em segundo plano: sem
  // toast de erro (uma oscilação de rede não pode ficar avisando a cada ciclo).
  const fetchData = React.useCallback(async (silencioso = false) => {
    if (buscando.current) return
    buscando.current = true
    try {
      const [statsRes, transfersRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/transfers?limit=50') // Initial limit
      ])

      if (statsRes.ok && transfersRes.ok) {
        const statsData = await statsRes.json()
        const transfersData = await transfersRes.json()

        setStats(statsData)
        setTransfers(transfersData.transfers)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      if (!silencioso) showToast('Erro ao carregar dados', 'error')
    } finally {
      buscando.current = false
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (logado) fetchData()
  }, [logado, fetchData])

  // Polling leve + refetch ao voltar para a aba, só enquanto ela está visível.
  useEffect(() => {
    if (!logado) return
    const atualizar = () => {
      if (document.visibilityState === 'visible') fetchData(true)
    }
    const timer = window.setInterval(atualizar, INTERVALO_ATUALIZACAO_MS)
    document.addEventListener('visibilitychange', atualizar)
    window.addEventListener('focus', atualizar)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', atualizar)
      window.removeEventListener('focus', atualizar)
    }
  }, [logado, fetchData])

  // Sessão local caiu no meio do uso: volta pela ponte SSO (que revalida a
  // sessão central e devolve para cá) — navegação inteira de propósito.
  useEffect(() => {
    if (status === 'unauthenticated') entrarPelaPlataforma(`${BASE_PATH}/dashboard`)
  }, [status])

  // Auth check
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando">
        <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!session?.user) return null

  const handleCopyLink = async (transfer: Transfer) => {
    const url = `${window.location.origin}${BASE_PATH}/d/${transfer.shareToken}`
    await navigator.clipboard.writeText(url)
    setCopiedId(transfer.id)
    showToast('Link copiado!', 'success')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/api/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revoked' })
      })

      if (res.ok) {
        // Reflete na hora no estado local; o refetch silencioso confirma com o servidor.
        setTransfers(prev => prev.map(t => (t.id === id ? { ...t, status: 'revoked' } : t)))
        setStats(prev => ({ ...prev, active: Math.max(0, prev.active - 1) }))
        showToast('Link revogado com sucesso', 'success')
        fetchData(true)
      } else {
        showToast('Erro ao revogar link', 'error')
      }
    } catch (error) {
      showToast('Erro ao revogar link', 'error')
    }
  }

  const confirmarExclusao = async () => {
    if (!excluindo) return
    const alvo = excluindo
    setExcluindoOcupado(true)
    try {
      const res = await fetch(`/api/transfers/${alvo.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setTransfers(prev => prev.filter(t => t.id !== alvo.id))
        setStats(prev => ({
          total: Math.max(0, prev.total - 1),
          active: alvo.status === 'active' ? Math.max(0, prev.active - 1) : prev.active,
          expired: alvo.status === 'expired' ? Math.max(0, prev.expired - 1) : prev.expired,
        }))
        showToast('Envio excluído com sucesso', 'success')
        fetchData(true)
      } else {
        showToast('Erro ao excluir envio', 'error')
      }
    } catch (error) {
      showToast('Erro ao excluir envio', 'error')
    } finally {
      setExcluindoOcupado(false)
      setExcluindo(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success">Ativo</span>
      case 'expired':
        return <span className="badge badge-warning">Expirado</span>
      case 'revoked':
        return <span className="badge badge-danger">Revogado</span>
      default:
        return <span className="badge badge-info">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="ColetivoSend — página inicial">
            <Logo priority className="h-9 w-auto" />
          </Link>

          <div className="flex items-center gap-4">
            {/* Unificação: identidade e saída vivem na barra da plataforma.
                Mídia de fundo é configuração do Send (admin). */}
            <Tooltip texto="Mídia de fundo (admin)" lado="baixo" alinhar="fim">
              <Link
                href="/settings/media"
                aria-label="Mídia de fundo (admin)"
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </Link>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meus envios</h1>
            <p className="text-muted-foreground">Gerencie todos os seus envios</p>
          </div>

          {/* Link com a cara de botão (botão dentro de link é inválido/ambíguo p/ leitor de tela) */}
          <Link href="/" className="btn btn-primary">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Novo envio
          </Link>
        </div>

        {/* Stats cards */}
        <div className="mb-3 flex items-center gap-3">
          <p className="rotulo-mono">
            Resumo
          </p>
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          {isLoading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-muted border border-border text-primary flex items-center justify-center" aria-hidden="true">
                  <FileIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de envios</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-muted border border-border text-emerald-600 dark:text-emerald-400 flex items-center justify-center" aria-hidden="true">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-muted border border-border text-amber-600 dark:text-amber-400 flex items-center justify-center" aria-hidden="true">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expirados</p>
                  <p className="text-2xl font-bold text-foreground">{stats.expired}</p>
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* Transfers list */}
        <div className="mb-3 flex items-center gap-3">
          <p className="rotulo-mono">
            Envios
          </p>
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
        </div>
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : transfers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-12 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6" aria-hidden="true">
              <FileIcon className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Você ainda não tem envios
            </h3>
            <p className="text-muted-foreground mb-6">
              Compartilhe arquivos e gerencie tudo por aqui
            </p>
            <Link href="/" className="btn btn-primary">
              <Plus className="w-4 h-4" aria-hidden="true" />
              Criar primeiro envio
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-2 text-sm font-medium text-muted-foreground" aria-hidden="true">
              <div className="col-span-4">Envio</div>
              <div className="col-span-2">Arquivos</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Métricas</div>
              <div className="col-span-2 text-right">Ações</div>
            </div>

            {/* Transfer rows */}
            <AnimatePresence>
              {transfers.map((transfer, index) => (
                <motion.div
                  key={transfer.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card p-5 transition-colors hover:bg-muted/30"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    {/* Info */}
                    <div className="md:col-span-4">
                      <p className="font-medium text-foreground truncate">
                        {transfer.recipientEmail || `Envio de ${transfer.senderName}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(transfer.createdAt)}
                      </p>
                    </div>

                    {/* Files */}
                    <div className="md:col-span-2">
                      <p className="text-sm text-foreground">
                        {transfer.fileCount} arquivo{transfer.fileCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatBytes(transfer.totalSizeBytes)}</p>
                    </div>

                    {/* Status */}
                    <div className="md:col-span-2">
                      {getStatusBadge(transfer.status)}
                      <p className="text-xs text-muted-foreground mt-1">
                        {transfer.status === 'active'
                          ? `Expira ${formatDate(transfer.expiresAt)}`
                          : transfer.status === 'expired'
                            ? `Expirou ${formatDate(transfer.expiresAt)}`
                            : 'Link desativado'}
                      </p>
                    </div>

                    {/* Metrics */}
                    <div className="md:col-span-2 flex gap-4">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-foreground">{transfer.viewCount}</p>
                        <p className="text-xs text-muted-foreground">Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-foreground">{transfer.downloadCount}</p>
                        <p className="text-xs text-muted-foreground">Downloads</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="md:col-span-2 flex justify-end gap-2 relative">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleCopyLink(transfer)}
                        icon={copiedId === transfer.id ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                        disabled={transfer.status !== 'active'}
                        className={copiedId === transfer.id ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : ''}
                      >
                        {copiedId === transfer.id ? 'Copiado' : 'Copiar'}
                      </Button>

                      <MenuAcoes
                        label="Mais ações"
                        items={[
                          {
                            label: 'Abrir link',
                            icon: <ExternalLink className="w-4 h-4" aria-hidden="true" />,
                            href: `${BASE_PATH}/d/${transfer.shareToken}`,
                          },
                          ...(transfer.status === 'active'
                            ? [{
                              label: 'Revogar link',
                              icon: <Ban className="w-4 h-4" aria-hidden="true" />,
                              tom: 'aviso' as const,
                              onSelect: () => handleRevoke(transfer.id),
                            }]
                            : []),
                          {
                            label: 'Excluir',
                            icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                            tom: 'perigo' as const,
                            onSelect: () => setExcluindo(transfer),
                          },
                        ]}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir este envio?"
        description="O link de download deixa de funcionar na hora e os arquivos são apagados do armazenamento. Não dá para desfazer."
        confirmLabel="Excluir envio"
        busy={excluindoOcupado}
        onConfirm={confirmarExclusao}
        onCancel={() => { if (!excluindoOcupado) setExcluindo(null) }}
      />
    </div>
  )
}
