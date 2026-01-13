'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Copy, Trash2, MoreHorizontal,
  ExternalLink, FileIcon, Ban,
  Sparkles, Settings, LogOut, CheckCircle2, Loader2,
  Clock, CheckCircle, XCircle, AlertCircle
} from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { SkeletonTable, SkeletonStatCard } from '@/components/ui/Skeleton'
import { formatBytes, formatDate } from '@/lib/utils'
import { UserMenu } from '@/components/ui/UserMenu'
import { useToast } from '@/components/ui/Toast'
import { ThemeToggle } from '@/components/theme-toggle'

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
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch data
  const fetchData = React.useCallback(async () => {
    try {
      setIsRefreshing(true)

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
      showToast('Erro ao carregar dados', 'error')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    if (session?.user) {
      fetchData()
    }
  }, [session, fetchData])

  // Auth check
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (!session?.user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login?callbackUrl=/dashboard'
    }
    return null
  }

  const handleCopyLink = async (transfer: Transfer) => {
    const url = `${window.location.origin}/d/${transfer.shareToken}`
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
        showToast('Link revogado com sucesso', 'success')
        fetchData() // Refresh data
        setActiveMenu(null)
      } else {
        showToast('Erro ao revogar link', 'error')
      }
    } catch (error) {
      showToast('Erro ao revogar link', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este envio?')) return

    try {
      const res = await fetch(`/api/transfers/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        showToast('Envio excluído com sucesso', 'success')
        fetchData() // Refresh data
        setActiveMenu(null)
      } else {
        showToast('Erro ao excluir envio', 'error')
      }
    } catch (error) {
      showToast('Erro ao excluir envio', 'error')
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
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">
              Coletivo<span className="text-primary-500">Send</span>
            </span>
          </a>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meus envios</h1>
            <p className="text-muted-foreground">Gerencie todos os seus transfers</p>
          </div>

          <a href="/">
            <Button icon={<Plus className="w-4 h-4" />}>
              Novo envio
            </Button>
          </a>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
                className="card p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
                  <FileIcon className="w-6 h-6" />
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
                className="card p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
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
                className="card p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
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
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : transfers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-12 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <FileIcon className="w-10 h-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Você ainda não tem envios
            </h3>
            <p className="text-muted-foreground mb-6">
              Compartilhe arquivos e gerencie tudo por aqui
            </p>
            <a href="/">
              <Button icon={<Plus className="w-4 h-4" />}>
                Criar primeiro envio
              </Button>
            </a>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {/* Table header (desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
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
                  className="card p-4 hover:shadow-md transition-shadow"
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
                        icon={copiedId === transfer.id ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        disabled={transfer.status !== 'active'}
                        className={copiedId === transfer.id ? 'bg-emerald-500/10 text-emerald-500' : ''}
                      >
                        {copiedId === transfer.id ? 'Copiado' : 'Copiar'}
                      </Button>

                      <div className="relative">
                        <IconButton
                          variant="ghost"
                          onClick={() => setActiveMenu(activeMenu === transfer.id ? null : transfer.id)}
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </IconButton>

                        {activeMenu === transfer.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute right-0 top-full mt-1 w-48 bg-card rounded-xl shadow-lg border border-border py-2 z-10"
                          >
                            <a
                              href={`/d/${transfer.shareToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent/5 hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              Abrir link
                            </a>
                            {transfer.status === 'active' && (
                              <button
                                onClick={() => handleRevoke(transfer.id)}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-600 hover:bg-amber-500/10"
                              >
                                <Ban className="w-4 h-4" />
                                Revogar link
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(transfer.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}
