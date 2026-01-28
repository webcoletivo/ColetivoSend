/**
 * Upload Manager - Handles chunked file uploads with retry and resume
 */

export interface UploadConfig {
    chunkSize: number
    maxConcurrentChunks: number
    maxRetries: number
    retryDelay: number
}

export interface UploadProgress {
    fileId: string
    fileName: string
    fileSize: number
    uploadedBytes: number
    uploadedChunks: number
    totalChunks: number
    percentage: number
    speed: number // bytes per second
    estimatedTimeRemaining: number // seconds
    status: 'idle' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled'
    error?: string
}

export interface UploadSession {
    sessionId: string
    uploadId: string
    storageKey: string
    chunkSize: number
    totalParts: number
}

export interface ChunkUploadResult {
    partNumber: number
    ETag: string
    size: number
}

class UploadError extends Error {
    constructor(
        message: string,
        public code: string,
        public recoverable: boolean = true,
        public action?: string
    ) {
        super(message)
        this.name = 'UploadError'
    }
}

export class UploadManager {
    private config: UploadConfig
    private activeUploads: Map<string, AbortController> = new Map()
    private progressCallbacks: Map<string, (progress: UploadProgress) => void> = new Map()
    private uploadStates: Map<string, UploadProgress> = new Map()

    constructor(config?: Partial<UploadConfig>) {
        this.config = {
            chunkSize: parseInt(process.env.NEXT_PUBLIC_UPLOAD_CHUNK_SIZE_MB || '2') * 1024 * 1024,
            maxConcurrentChunks: parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_CONCURRENT_CHUNKS || '3'),
            maxRetries: parseInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_RETRIES || '3'),
            retryDelay: 1000,
            ...config,
        }
        console.log('[UploadManager] v2.0 direct-to-storage active (Chunk: 2MB)')
    }

    /**
     * Upload a file with chunking
     */
    async uploadFile(
        file: File,
        transferId: string,
        fileId: string,
        onProgress?: (progress: UploadProgress) => void
    ): Promise<{ storageKey: string; size: number }> {
        // Check if upload can be resumed
        const savedProgress = this.loadProgress(fileId)
        let session: UploadSession

        if (savedProgress && savedProgress.status === 'paused') {
            // Resume existing upload
            session = {
                sessionId: savedProgress.fileId, // We'll need to store sessionId in progress
                uploadId: '',
                storageKey: '',
                chunkSize: this.config.chunkSize,
                totalParts: Math.ceil(file.size / this.config.chunkSize),
            }
        } else {
            // Initialize new upload
            session = await this.initializeUpload(transferId, fileId, file)
        }

        // Register progress callback
        if (onProgress) {
            this.progressCallbacks.set(fileId, onProgress)
        }

        // Initialize progress state
        const progress: UploadProgress = {
            fileId,
            fileName: file.name,
            fileSize: file.size,
            uploadedBytes: 0,
            uploadedChunks: 0,
            totalChunks: session.totalParts,
            percentage: 0,
            speed: 0,
            estimatedTimeRemaining: 0,
            status: 'uploading',
        }

        this.uploadStates.set(fileId, progress)
        this.updateProgress(fileId, progress)

        try {
            // Upload chunks
            await this.uploadChunks(file, session, fileId)

            // Complete upload
            const result = await this.completeUpload(session.sessionId)

            // Update final progress
            progress.status = 'completed'
            progress.percentage = 100
            this.updateProgress(fileId, progress)
            this.clearProgress(fileId)

            return result
        } catch (error: any) {
            progress.status = 'error'
            progress.error = error.message
            this.updateProgress(fileId, progress)
            this.saveProgress(fileId, progress)
            throw error
        }
    }

    /**
     * Initialize upload session
     */
    private async initializeUpload(
        transferId: string,
        fileId: string,
        file: File
    ): Promise<UploadSession> {
        const response = await fetch('/api/upload/chunk/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transferId,
                fileId,
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type || 'application/octet-stream',
            }),
        })

        if (!response.ok) {
            const data = await response.json()

            if (response.status === 401) {
                throw new UploadError('Sessão expirada', 'AUTH_ERROR', true, 'refresh')
            }

            throw new UploadError(
                data.error || 'Erro ao inicializar upload',
                'INIT_ERROR',
                false
            )
        }

        const data = await response.json()
        return {
            sessionId: data.sessionId,
            uploadId: data.uploadId,
            storageKey: data.storageKey,
            chunkSize: data.chunkSize,
            totalParts: data.totalParts,
        }
    }

    /**
     * Upload all chunks with concurrency control
     */
    private async uploadChunks(
        file: File,
        session: UploadSession,
        fileId: string
    ): Promise<void> {
        const totalChunks = session.totalParts
        const uploadedParts: Set<number> = new Set()

        // Check for already uploaded parts (resume)
        try {
            const statusResponse = await fetch(`/api/upload/chunk/${session.sessionId}`)
            if (statusResponse.ok) {
                const statusData = await statusResponse.json()
                statusData.uploadedPartNumbers?.forEach((partNum: number) => {
                    uploadedParts.add(partNum)
                })
            }
        } catch (e) {
            // Ignore errors, start fresh
        }

        const startTime = Date.now()
        let lastUpdateTime = startTime

        // Create chunk upload queue
        const chunkQueue: number[] = []
        for (let i = 1; i <= totalChunks; i++) {
            if (!uploadedParts.has(i)) {
                chunkQueue.push(i)
            }
        }

        // Upload chunks with concurrency limit
        const uploadPromises: Promise<void>[] = []
        let activeUploads = 0

        const uploadNextChunk = async (): Promise<void> => {
            while (chunkQueue.length > 0 && activeUploads < this.config.maxConcurrentChunks) {
                const partNumber = chunkQueue.shift()!
                activeUploads++

                const uploadPromise = this.uploadChunkWithRetry(
                    file,
                    session,
                    partNumber,
                    fileId
                ).then(() => {
                    activeUploads--
                    uploadedParts.add(partNumber)

                    // Update progress
                    const progress = this.uploadStates.get(fileId)!
                    const uploadedBytes = uploadedParts.size * session.chunkSize
                    const now = Date.now()
                    const elapsed = (now - startTime) / 1000
                    const speed = uploadedBytes / elapsed

                    progress.uploadedChunks = uploadedParts.size
                    progress.uploadedBytes = Math.min(uploadedBytes, file.size)
                    progress.percentage = Math.round((uploadedParts.size / totalChunks) * 100)
                    progress.speed = speed

                    if (speed > 0) {
                        const remainingBytes = file.size - progress.uploadedBytes
                        progress.estimatedTimeRemaining = Math.round(remainingBytes / speed)
                    }

                    this.updateProgress(fileId, progress)

                    // Continue uploading
                    return uploadNextChunk()
                })

                uploadPromises.push(uploadPromise)
            }
        }

        // Start initial batch
        await uploadNextChunk()

        // Wait for all uploads to complete
        await Promise.all(uploadPromises)
    }

    /**
     * Upload a single chunk with retry logic
     */
    private async uploadChunkWithRetry(
        file: File,
        session: UploadSession,
        partNumber: number,
        fileId: string,
        attempt: number = 1
    ): Promise<ChunkUploadResult> {
        const start = (partNumber - 1) * session.chunkSize
        const end = Math.min(start + session.chunkSize, file.size)
        const chunk = file.slice(start, end)

        try {
            const abortController = new AbortController()
            this.activeUploads.set(`${fileId}-${partNumber}`, abortController)

            // 1. Get presigned URL
            const presignResponse = await fetch(
                `/api/upload/chunk/${session.sessionId}/presign?partNumber=${partNumber}`,
                { signal: abortController.signal }
            )

            if (!presignResponse.ok) {
                const data = await presignResponse.json()
                if (presignResponse.status === 401) {
                    await this.refreshAuthToken()
                    return this.uploadChunkWithRetry(file, session, partNumber, fileId, attempt)
                }
                throw new Error(data.error || 'Erro ao obter URL de upload')
            }

            const { url, storageType } = await presignResponse.json()

            // 2. Upload to storage (S3/R2 direct or local fallback)
            const uploadHeaders: Record<string, string> = {
                'Content-Type': 'application/octet-stream',
            }

            // Headers specific to our local backend if that's the fallback
            if (storageType === 'local') {
                uploadHeaders['x-part-number'] = partNumber.toString()
            }

            const uploadResponse = await fetch(url, {
                method: 'PUT',
                headers: uploadHeaders,
                body: chunk,
                signal: abortController.signal,
            })

            if (!uploadResponse.ok) {
                if (uploadResponse.status === 413) {
                    throw new Error('Payload muito grande. O tamanho do chunk deve ser reduzido.')
                }
                throw new Error(`Erro no upload para storage: ${uploadResponse.statusText}`)
            }

            // 3. Get ETag (required for multipart completion)
            let ETag = uploadResponse.headers.get('ETag')

            // If local fallback, ETag comes in JSON response
            if (storageType === 'local') {
                const data = await uploadResponse.json()
                ETag = data.ETag
            }

            // Clean ETag (S3 returns it with double quotes)
            ETag = ETag ? ETag.replace(/"/g, '') : ''

            // 4. Report upload to backend
            const reportResponse = await fetch(`/api/upload/chunk/${session.sessionId}/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partNumber,
                    ETag,
                    size: chunk.size,
                }),
                signal: abortController.signal,
            })

            this.activeUploads.delete(`${fileId}-${partNumber}`)

            if (!reportResponse.ok) {
                const data = await reportResponse.json()
                throw new Error(data.error || 'Erro ao registrar chunk no servidor')
            }

            return {
                partNumber,
                ETag,
                size: chunk.size,
            }
        } catch (error: any) {
            this.activeUploads.delete(`${fileId}-${partNumber}`)

            // Check if cancelled
            if (error.name === 'AbortError') {
                throw new UploadError('Upload cancelado', 'CANCELLED', false)
            }

            // Retry logic
            if (attempt < this.config.maxRetries) {
                console.warn(`Retrying part ${partNumber}, attempt ${attempt + 1}/${this.config.maxRetries}`)
                const delay = this.config.retryDelay * Math.pow(2, attempt - 1)
                await new Promise((resolve) => setTimeout(resolve, delay))
                return this.uploadChunkWithRetry(file, session, partNumber, fileId, attempt + 1)
            }

            throw new UploadError(
                `Falha ao enviar chunk ${partNumber} após ${this.config.maxRetries} tentativas: ${error.message}`,
                'CHUNK_ERROR',
                true,
                'retry'
            )
        }
    }

    /**
     * Complete multipart upload
     */
    private async completeUpload(
        sessionId: string
    ): Promise<{ storageKey: string; size: number }> {
        const response = await fetch(`/api/upload/chunk/${sessionId}/complete`, {
            method: 'POST',
        })

        if (!response.ok) {
            const data = await response.json()
            throw new UploadError(
                data.error || 'Erro ao finalizar upload',
                data.code || 'COMPLETE_ERROR',
                true
            )
        }

        const data = await response.json()
        return {
            storageKey: data.storageKey,
            size: data.size,
        }
    }

    /**
     * Pause upload
     */
    pauseUpload(fileId: string): void {
        const progress = this.uploadStates.get(fileId)
        if (progress) {
            progress.status = 'paused'
            this.updateProgress(fileId, progress)
            this.saveProgress(fileId, progress)

            // Abort active chunk uploads
            this.activeUploads.forEach((controller, key) => {
                if (key.startsWith(fileId)) {
                    controller.abort()
                    this.activeUploads.delete(key)
                }
            })
        }
    }

    /**
     * Cancel upload
     */
    async cancelUpload(fileId: string, sessionId: string): Promise<void> {
        const progress = this.uploadStates.get(fileId)
        if (progress) {
            progress.status = 'cancelled'
            this.updateProgress(fileId, progress)
            this.clearProgress(fileId)

            // Abort active uploads
            this.activeUploads.forEach((controller, key) => {
                if (key.startsWith(fileId)) {
                    controller.abort()
                    this.activeUploads.delete(key)
                }
            })

            // Abort on server
            try {
                await fetch(`/api/upload/chunk/${sessionId}`, { method: 'DELETE' })
            } catch (e) {
                console.error('Failed to abort upload on server:', e)
            }
        }
    }

    /**
     * Refresh authentication token
     */
    private async refreshAuthToken(): Promise<void> {
        // In NextAuth, the session is automatically refreshed
        // We just need to trigger a session update
        // This is handled by the middleware and session callbacks
        console.log('Token refresh triggered')
    }

    /**
     * Update progress and notify callback
     */
    private updateProgress(fileId: string, progress: UploadProgress): void {
        this.uploadStates.set(fileId, progress)
        const callback = this.progressCallbacks.get(fileId)
        if (callback) {
            callback(progress)
        }
    }

    /**
     * Save progress to localStorage
     */
    private saveProgress(fileId: string, progress: UploadProgress): void {
        try {
            localStorage.setItem(`upload_progress_${fileId}`, JSON.stringify(progress))
        } catch (e) {
            console.warn('Failed to save upload progress:', e)
        }
    }

    /**
     * Load progress from localStorage
     */
    private loadProgress(fileId: string): UploadProgress | null {
        try {
            const saved = localStorage.getItem(`upload_progress_${fileId}`)
            return saved ? JSON.parse(saved) : null
        } catch (e) {
            return null
        }
    }

    /**
     * Clear progress from localStorage
     */
    private clearProgress(fileId: string): void {
        try {
            localStorage.removeItem(`upload_progress_${fileId}`)
        } catch (e) {
            console.warn('Failed to clear upload progress:', e)
        }
    }
}

// Singleton instance
let uploadManagerInstance: UploadManager | null = null

export function getUploadManager(): UploadManager {
    if (!uploadManagerInstance) {
        uploadManagerInstance = new UploadManager()
    }
    return uploadManagerInstance
}
