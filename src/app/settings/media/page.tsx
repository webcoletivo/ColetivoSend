'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
    Upload, Trash2, Edit2, Eye, EyeOff, GripVertical,
    Link as LinkIcon, Video, Image as ImageIcon, Plus,
    Save, X, AlertCircle, Check, Loader2, ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

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
    const [uploadTitle, setUploadTitle] = useState('')
    const [uploadDuration, setUploadDuration] = useState(6)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    // Edit state
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState<Partial<MediaItem>>({})

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
        if (!session?.user) {
            router.push('/login')
            return
        }
        fetchMedia()
    }, [session, status, router, fetchMedia])

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

        if (uploadIsPromo && !uploadPromoUrl) {
            setError('URL da propaganda é obrigatória')
            return
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

            const { uploadUrl, media } = await presignRes.json()

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

    // Delete
    const handleDelete = async (id: string) => {
        if (!confirm('Excluir esta mídia?')) return

        try {
            const res = await fetch(`/api/admin/media/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Erro ao excluir')
            setItems(prev => prev.filter(item => item.id !== id))
        } catch (e: any) {
            setError(e.message)
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
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Mídia de Fundo</h1>
                    <p className="text-muted-foreground">Gerencie vídeos e imagens da página inicial</p>
                </div>
                <Button onClick={() => setShowUpload(true)} icon={<Plus className="w-4 h-4" />}>
                    Adicionar mídia
                </Button>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
            )}

            {/* Upload form */}
            <AnimatePresence>
                {showUpload && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 p-6 bg-card border border-border rounded-xl overflow-hidden"
                    >
                        <h3 className="font-semibold mb-4">Nova mídia</h3>

                        <div className="space-y-4">
                            {/* File input */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Arquivo</label>
                                <input
                                    type="file"
                                    accept="video/*,image/*"
                                    onChange={handleFileSelect}
                                    className="input"
                                />
                            </div>

                            {uploadFile && (
                                <>
                                    {/* Title */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Título (opcional)</label>
                                        <input
                                            type="text"
                                            value={uploadTitle}
                                            onChange={(e) => setUploadTitle(e.target.value)}
                                            className="input"
                                            placeholder="Nome da mídia"
                                        />
                                    </div>

                                    {/* Type */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Tipo</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={!uploadIsPromo}
                                                    onChange={() => setUploadIsPromo(false)}
                                                />
                                                <span>{uploadType === 'video' ? 'Vídeo' : 'Imagem'}</span>
                                            </label>
                                            <label className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    checked={uploadIsPromo}
                                                    onChange={() => setUploadIsPromo(true)}
                                                />
                                                <span>Propaganda</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Promo URL */}
                                    {uploadIsPromo && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">URL da propaganda *</label>
                                            <input
                                                type="url"
                                                value={uploadPromoUrl}
                                                onChange={(e) => setUploadPromoUrl(e.target.value)}
                                                className="input"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    )}

                                    {/* Duration for images */}
                                    {uploadType === 'image' && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Duração (segundos)</label>
                                            <input
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
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                                    icon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
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
                        icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    >
                        Salvar ordem
                    </Button>
                </div>
            )}

            {/* Media list */}
            {items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mídia cadastrada</p>
                </div>
            ) : (
                <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-3">
                    {items.map((item) => (
                        <Reorder.Item
                            key={item.id}
                            value={item}
                            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 cursor-move"
                        >
                            <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                            {/* Preview */}
                            <div className="w-20 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                {item.url && (
                                    item.type === 'video' ? (
                                        <video src={item.url} className="w-full h-full object-cover" muted />
                                    ) : (
                                        <img src={item.url} alt={item.title || ''} className="w-full h-full object-cover" />
                                    )
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                {editingId === item.id ? (
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={editData.title ?? item.title ?? ''}
                                            onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                                            className="input text-sm"
                                            placeholder="Título"
                                        />
                                        {item.isPromotion && (
                                            <input
                                                type="url"
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
                                            {item.title || 'Sem título'}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            {item.type === 'video' ? (
                                                <Video className="w-3.5 h-3.5" />
                                            ) : (
                                                <ImageIcon className="w-3.5 h-3.5" />
                                            )}
                                            <span>{item.type === 'video' ? 'Vídeo' : 'Imagem'}</span>
                                            {item.isPromotion && (
                                                <>
                                                    <span>•</span>
                                                    <LinkIcon className="w-3.5 h-3.5" />
                                                    <span className="text-primary">Propaganda</span>
                                                </>
                                            )}
                                            {item.duration && (
                                                <>
                                                    <span>•</span>
                                                    <span>{item.duration}s</span>
                                                </>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {editingId === item.id ? (
                                    <>
                                        <button
                                            onClick={handleSaveEdit}
                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { setEditingId(null); setEditData({}) }}
                                            className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleToggleActive(item.id, item.isActive)}
                                            className={`p-2 rounded-lg ${item.isActive ? 'text-green-500 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-muted'}`}
                                            title={item.isActive ? 'Desativar' : 'Ativar'}
                                        >
                                            {item.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => { setEditingId(item.id); setEditData({}) }}
                                            className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        {item.isPromotion && item.promotionUrl && (
                                            <a
                                                href={item.promotionUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-muted-foreground hover:bg-muted rounded-lg"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                        )}
                                        <button
                                            onClick={() => handleDelete(item.id)}
                                            className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )}
        </div>
    )
}
