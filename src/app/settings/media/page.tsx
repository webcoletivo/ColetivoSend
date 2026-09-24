'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
    Upload, Trash2, Edit2, Eye, EyeOff, GripVertical,
    Link as LinkIcon, Video, Image as ImageIcon, Plus,
    Save, X, AlertCircle, Check, Loader2, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatBytes } from '@/lib/utils'

interface MediaItem {
    id: string
    title: string | null
    type: 'video' | 'image'
    isPromotion: boolean
    promotionUrl: string | null
    storageKey: string
    mimeType: string
    sizeBytes: number
    duration: number | null
    order: number
    isActive: boolean
    url?: string
}

// Botões de ícone: todos nomeados (aria-label) — a auditoria achou 8 sem nome.
const BOTAO_ICONE =
    'p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

// Mensagem própria para a URL da propaganda (null = válida).
function validarUrlPropaganda(valor: string): string | null {
    const url = valor.trim()
    if (!url) return 'Informe a URL da propaganda.'
    try {
        const { protocol } = new URL(url)
        if (protocol !== 'http:' && protocol !== 'https:') throw new Error('protocolo')
    } catch {
        return 'Informe uma URL válida, começando com https://'
    }
    return null
}

export default function MediaManagementPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    const [items, setItems] = useState<MediaItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Upload state
    const [showUpload, setShowUpload] = useState(false)
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [uploadType, setUploadType] = useState<'video' | 'image'>('video')
    const [uploadIsPromo, setUploadIsPromo] = useState(false)
    const [uploadPromoUrl, setUploadPromoUrl] = useState('')
    // Validação própria (inline) da URL da propaganda — sem bolha nativa
    const [erroUrl, setErroUrl] = useState<string | null>(null)
    const inputArquivoRef = useRef<HTMLInputElement>(null)
    const inputUrlRef = useRef<HTMLInputElement>(null)
    const [uploadTitle, setUploadTitle] = useState('')
    const [uploadDuration, setUploadDuration] = useState(6)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState<Partial<MediaItem>>({})

    // Diálogo de exclusão (no lugar do confirm() nativo)
    const [excluindo, setExcluindo] = useState<MediaItem | null>(null)
    const [excluindoOcupado, setExcluindoOcupado] = useState(false)

    // Fetch media
    const fetchMedia = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/media')
            if (res.status === 401 || res.status === 403) {
                router.push('/')
                return
            }
            if (!res.ok) throw new Error('Erro ao carregar mídia')
            const data = await res.json()
            setItems(data)
            setError(null)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsLoading(false)
        }
    }, [router])

    useEffect(() => {
        if (status === 'loading') return
        // Sem sessão, o layout de settings já leva à ponte SSO e volta para cá.
        if (!session?.user) return
        fetchMedia()
    }, [session, status, fetchMedia])

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadFile(file)

        // Auto-detect type
        if (file.type.startsWith('video/')) {
            setUploadType('video')
        } else if (file.type.startsWith('image/')) {
            setUploadType('image')
        }
    }

    // Upload handler
    const handleUpload = async () => {
        if (!uploadFile) return

        if (uploadIsPromo) {
            const erro = validarUrlPropaganda(uploadPromoUrl)
            if (erro) {
                setErroUrl(erro)
                inputUrlRef.current?.focus()
                return
            }
        }

        setIsUploading(true)
        setUploadProgress(0)

        try {
            // Get presigned URL
            const presignRes = await fetch('/api/admin/media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: uploadTitle || null,
                    type: uploadType,
                    isPromotion: uploadIsPromo,
                    promotionUrl: uploadIsPromo ? uploadPromoUrl : null,
                    fileName: uploadFile.name,
                    mimeType: uploadFile.type,
                    sizeBytes: uploadFile.size,
                    duration: uploadType === 'image' ? uploadDuration : null
                })
            })

            if (!presignRes.ok) {
                const err = await presignRes.json()
                throw new Error(err.error || 'Erro ao preparar upload')
            }

            const { uploadUrl, media: criada } = await presignRes.json()

            // Upload to S3
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        setUploadProgress((e.loaded / e.total) * 100)
                    }
                }
                xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Falha no upload'))
                xhr.onerror = () => reject(new Error('Erro de rede'))
                xhr.open('PUT', uploadUrl)
                xhr.setRequestHeader('Content-Type', uploadFile.type)
                xhr.send(uploadFile)
            })

            // Confirmação: o servidor confere tipo (assinatura) e tamanho no
            // próprio objeto e só então ativa a mídia — se não confere, apaga.
            const confirmaRes = await fetch(`/api/admin/media/${criada.id}/confirmar`, { method: 'POST' })
            if (!confirmaRes.ok) {
                const err = await confirmaRes.json().catch(() => ({}))
                throw new Error(err.error || 'Arquivo recusado na confirmação')
            }

            // Refresh list
            await fetchMedia()

            // Reset form
            setShowUpload(false)
            setUploadFile(null)
            setUploadTitle('')
            setUploadIsPromo(false)
            setUploadPromoUrl('')
            setUploadDuration(6)

        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsUploading(false)
            setUploadProgress(0)
        }
    }

    // Toggle active
    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            const res = await fetch(`/api/admin/media/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive })
            })
            if (!res.ok) throw new Error('Erro ao atualizar')

            setItems(prev => prev.map(item =>
                item.id === id ? { ...item, isActive: !isActive } : item
            ))
        } catch (e: any) {
            setError(e.message)
        }
    }

    // Delete (confirmado no diálogo)
    const confirmarExclusao = async () => {
        if (!excluindo) return
        const alvo = excluindo
        setExcluindoOcupado(true)
        try {
            const res = await fetch(`/api/admin/media/${alvo.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erro ao excluir')
            setItems(prev => prev.filter(item => item.id !== alvo.id))
        } catch (e: any) {
            setError(e.message)
        } finally {
            setExcluindoOcupado(false)
            setExcluindo(null)
        }
    }

    // Save edit
    const handleSaveEdit = async () => {
        if (!editingId) return

        try {
            const res = await fetch(`/api/admin/media/${editingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editData)
            })
            if (!res.ok) throw new Error('Erro ao salvar')

            const updated = await res.json()
            setItems(prev => prev.map(item =>
                item.id === editingId ? { ...item, ...updated } : item
            ))
            setEditingId(null)
            setEditData({})
        } catch (e: any) {
            setError(e.message)
        }
    }

    // Save order
    const handleSaveOrder = async () => {
        setIsSaving(true)
        try {
            const res = await fetch('/api/admin/media/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map((item, index) => ({ id: item.id, order: index }))
                })
            })
            if (!res.ok) throw new Error('Erro ao reordenar')
            setHasChanges(false)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setIsSaving(false)
        }
    }

    // Reorder handler
    const handleReorder = (newItems: MediaItem[]) => {
        setItems(newItems)
        setHasChanges(true)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Carregando">
                <Loader2 className="w-8 h-8 animate-spin text-primary" aria-hidden="true" />
            </div>
        )
    }

    // Container/padding vêm do layout de settings (max-w-7xl px-6 py-8)
    return (
        <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Mídia de Fundo</h1>
                    <p className="text-muted-foreground">Gerencie vídeos e imagens da página inicial</p>
                </div>
                <Button
                    onClick={() => setShowUpload(true)}
                    icon={<Plus className="w-4 h-4" aria-hidden="true" />}
                    aria-expanded={showUpload}
                    aria-controls="form-nova-midia"
                >
                    Adicionar mídia
                </Button>
            </div>

            {/* Error */}
            {error && (
                <div role="alert" className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5" aria-hidden="true" />
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => setError(null)}
                        aria-label="Fechar aviso"
                        className={`ml-auto ${BOTAO_ICONE} hover:bg-destructive/10`}
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            )}

            {/* Upload form */}
            <AnimatePresence>
                {showUpload && (
                    <motion.div
                        id="form-nova-midia"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 p-6 bg-card border border-border rounded-xl overflow-hidden"
                    >
                        <div className="mb-4 flex items-center gap-3">
                            <p className="rotulo-mono">
                                Nova mídia
                            </p>
                            <div className="h-px flex-1 bg-border" aria-hidden="true" />
                        </div>

                        <div className="space-y-4">
                            {/* Arquivo: botão próprio; o input nativo fica escondido
                                (sem o "Escolher arquivo" do navegador) e é aberto pelo botão. */}
                            <div>
                                <p id="midia-arquivo-rotulo" className="rotulo-campo">Arquivo</p>
                                <input
                                    ref={inputArquivoRef}
                                    id="midia-arquivo-input"
                                    type="file"
                                    accept="video/*,image/*"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                />
                                <button
                                    type="button"
                                    id="midia-arquivo"
                                    onClick={() => inputArquivoRef.current?.click()}
                                    disabled={isUploading}
                                    aria-labelledby="midia-arquivo-rotulo midia-arquivo-estado"
                                    className="flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                                        <Upload className="w-4 h-4" />
                                    </span>
                                    <span id="midia-arquivo-estado" className="min-w-0 flex-1">
                                        {uploadFile ? (
                                            <>
                                                <span className="block truncate font-medium text-foreground">{uploadFile.name}</span>
                                                <span className="block text-xs text-muted-foreground">{formatBytes(uploadFile.size)} · clique para trocar</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="block font-medium text-foreground">Escolher arquivo</span>
                                                <span className="block text-xs text-muted-foreground">Vídeo ou imagem</span>
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>

                            {uploadFile && (
                                <>
                                    {/* Title */}
                                    <div>
                                        <label htmlFor="midia-titulo" className="rotulo-campo">Título <span className="font-normal text-muted-foreground">(opcional)</span></label>
                                        <input
                                            id="midia-titulo"
                                            type="text"
                                            value={uploadTitle}
                                            onChange={(e) => setUploadTitle(e.target.value)}
                                            className="input"
                                            placeholder="Nome da mídia"
                                        />
                                    </div>

                                    {/* Type */}
                                    <fieldset>
                                        <legend className="rotulo-campo">Tipo</legend>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 text-sm text-foreground">
                                                <input
                                                    type="radio"
                                                    name="midia-tipo"
                                                    className="accent-primary"
                                                    checked={!uploadIsPromo}
                                                    onChange={() => { setUploadIsPromo(false); setErroUrl(null) }}
                                                />
                                                <span>{uploadType === 'video' ? 'Vídeo' : 'Imagem'}</span>
                                            </label>
                                            <label className="flex items-center gap-2 text-sm text-foreground">
                                                <input
                                                    type="radio"
                                                    name="midia-tipo"
                                                    className="accent-primary"
                                                    checked={uploadIsPromo}
                                                    onChange={() => setUploadIsPromo(true)}
                                                />
                                                <span>Propaganda</span>
                                            </label>
                                        </div>
                                    </fieldset>

                                    {/* Promo URL */}
                                    {uploadIsPromo && (
                                        <div>
                                            <label htmlFor="midia-url" className="rotulo-campo">URL da propaganda <span aria-hidden="true">*</span></label>
                                            <input
                                                ref={inputUrlRef}
                                                id="midia-url"
                                                type="url"
                                                aria-required="true"
                                                aria-invalid={erroUrl ? true : undefined}
                                                aria-describedby={erroUrl ? 'midia-url-erro' : undefined}
                                                value={uploadPromoUrl}
                                                onChange={(e) => { setUploadPromoUrl(e.target.value); setErroUrl(null) }}
                                                className={`input ${erroUrl ? 'border-destructive focus-visible:border-destructive' : ''}`}
                                                placeholder="https://..."
                                            />
                                            {erroUrl && (
                                                <p id="midia-url-erro" className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive">
                                                    <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                                                    {erroUrl}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Duration for images */}
                                    {uploadType === 'image' && (
                                        <div>
                                            <label htmlFor="midia-duracao" className="rotulo-campo">Duração (segundos)</label>
                                            <input
                                                id="midia-duracao"
                                                type="number"
                                                value={uploadDuration}
                                                onChange={(e) => setUploadDuration(parseInt(e.target.value) || 6)}
                                                min={1}
                                                max={60}
                                                className="input w-24"
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Progress */}
                            {isUploading && (
                                <div
                                    className="h-2 bg-muted rounded-full overflow-hidden"
                                    role="progressbar"
                                    aria-label="Progresso do envio"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(uploadProgress)}
                                >
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    onClick={handleUpload}
                                    disabled={!uploadFile || isUploading}
                                    icon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Upload className="w-4 h-4" aria-hidden="true" />}
                                >
                                    {isUploading ? 'Enviando...' : 'Enviar'}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowUpload(false)}
                                    disabled={isUploading}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Save order button */}
            {hasChanges && (
                <div className="mb-4 flex justify-end">
                    <Button
                        onClick={handleSaveOrder}
                        disabled={isSaving}
                        icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
                    >
                        Salvar ordem
                    </Button>
                </div>
            )}

            {/* Media list */}
            <div className="mb-3 flex items-center gap-3">
                <p className="rotulo-mono">
                    Mídias
                </p>
                <div className="h-px flex-1 bg-border" aria-hidden="true" />
            </div>
            {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" aria-hidden="true" />
                    <p>Nenhuma mídia cadastrada</p>
                </div>
            ) : (
                <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-3" aria-label="Mídias de fundo (arraste para reordenar)">
                    {items.map((item) => {
                        const nome = item.title || 'Sem título'
                        return (
                            <Reorder.Item
                                key={item.id}
                                value={item}
                                className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 cursor-move"
                            >
                                <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />

                                {/* Preview */}
                                <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0" aria-hidden="true">
                                    {item.url && (
                                        item.type === 'video' ? (
                                            <video src={item.url} className="w-full h-full object-cover" muted preload="metadata" />
                                        ) : (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={item.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                                        )
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    {editingId === item.id ? (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                aria-label="Título da mídia"
                                                value={editData.title ?? item.title ?? ''}
                                                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit() }}
                                                className="input text-sm"
                                                placeholder="Título"
                                            />
                                            {item.isPromotion && (
                                                <input
                                                    type="url"
                                                    aria-label="URL da propaganda"
                                                    value={editData.promotionUrl ?? item.promotionUrl ?? ''}
                                                    onChange={(e) => setEditData({ ...editData, promotionUrl: e.target.value })}
                                                    className="input text-sm"
                                                    placeholder="URL da propaganda"
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="font-medium text-foreground truncate">
                                                {nome}
                                            </p>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {item.type === 'video' ? (
                                                    <Video className="w-3.5 h-3.5" aria-hidden="true" />
                                                ) : (
                                                    <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                                )}
                                                <span>{item.type === 'video' ? 'Vídeo' : 'Imagem'}</span>
                                                {item.isPromotion && (
                                                    <>
                                                        <span aria-hidden="true">•</span>
                                                        <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
                                                        <span className="font-medium text-foreground">Propaganda</span>
                                                    </>
                                                )}
                                                {item.duration && (
                                                    <>
                                                        <span aria-hidden="true">•</span>
                                                        <span>{item.duration}s</span>
                                                    </>
                                                )}
                                                {!item.isActive && (
                                                    <>
                                                        <span aria-hidden="true">•</span>
                                                        <span className="badge badge-info">Inativa</span>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Actions — a lixeira é sempre o último botão da linha */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {editingId === item.id ? (
                                        <>
                                            <Tooltip texto="Salvar">
                                                <button
                                                    type="button"
                                                    onClick={handleSaveEdit}
                                                    aria-label={`Salvar alterações de ${nome}`}
                                                    className={`${BOTAO_ICONE} text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10`}
                                                >
                                                    <Check className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </Tooltip>
                                            <Tooltip texto="Cancelar" alinhar="fim">
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingId(null); setEditData({}) }}
                                                    aria-label="Cancelar edição"
                                                    className={`${BOTAO_ICONE} text-muted-foreground hover:bg-muted hover:text-foreground`}
                                                >
                                                    <X className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </Tooltip>
                                        </>
                                    ) : (
                                        <>
                                            <Tooltip texto={item.isActive ? 'Desativar' : 'Ativar'}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(item.id, item.isActive)}
                                                    className={`${BOTAO_ICONE} ${item.isActive ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                                    aria-label={item.isActive ? `Desativar ${nome}` : `Ativar ${nome}`}
                                                    aria-pressed={item.isActive}
                                                >
                                                    {item.isActive ? <Eye className="w-4 h-4" aria-hidden="true" /> : <EyeOff className="w-4 h-4" aria-hidden="true" />}
                                                </button>
                                            </Tooltip>
                                            <Tooltip texto="Editar">
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingId(item.id); setEditData({}) }}
                                                    aria-label={`Editar ${nome}`}
                                                    className={`${BOTAO_ICONE} text-muted-foreground hover:bg-muted hover:text-foreground`}
                                                >
                                                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </Tooltip>
                                            {item.isPromotion && item.promotionUrl && (
                                                <Tooltip texto="Abrir propaganda">
                                                    <a
                                                        href={item.promotionUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        aria-label={`Abrir link da propaganda ${nome} (nova guia)`}
                                                        className={`${BOTAO_ICONE} text-muted-foreground hover:bg-muted hover:text-foreground`}
                                                    >
                                                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                                                    </a>
                                                </Tooltip>
                                            )}
                                            <Tooltip texto="Excluir" alinhar="fim">
                                                <button
                                                    type="button"
                                                    onClick={() => setExcluindo(item)}
                                                    aria-label={`Excluir ${nome}`}
                                                    className={`${BOTAO_ICONE} text-destructive hover:bg-destructive/10`}
                                                >
                                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            </Tooltip>
                                        </>
                                    )}
                                </div>
                            </Reorder.Item>
                        )
                    })}
                </Reorder.Group>
            )}

            <ConfirmDialog
                open={excluindo !== null}
                title="Excluir esta mídia?"
                description={`"${excluindo?.title || 'Sem título'}" sai da página inicial na hora e o arquivo é apagado. Não dá para desfazer.`}
                confirmLabel="Excluir mídia"
                busy={excluindoOcupado}
                onConfirm={confirmarExclusao}
                onCancel={() => { if (!excluindoOcupado) setExcluindo(null) }}
            />
        </div>
    )
}
