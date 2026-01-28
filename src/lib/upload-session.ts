import {
    S3Client,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    ListPartsCommand,
} from '@aws-sdk/client-s3'
import prisma from '@/lib/db'
import crypto from 'crypto'
import { getPresignedPartUrl } from '@/lib/storage'

const STORAGE_TYPE = (process.env.STORAGE_TYPE || 'local').trim().toLowerCase()
const BUCKET_NAME = process.env.AWS_S3_BUCKET || process.env.AWS_BUCKET_NAME || ''

const s3Client = STORAGE_TYPE === 's3' ? new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
    endpoint: process.env.AWS_ENDPOINT,
    forcePathStyle: !!process.env.AWS_ENDPOINT,
}) : null

export interface InitMultipartResult {
    sessionId: string
    uploadId: string
    storageKey: string
    chunkSize: number
    totalParts: number
}

export interface UploadPartResult {
    partNumber: number
    ETag: string
    size: number
}

export interface UploadProgress {
    sessionId: string
    fileName: string
    fileSize: number
    uploadedParts: number
    totalParts: number
    uploadedBytes: number
    status: string
}

/**
 * Initialize a multipart upload session
 */
export async function initializeMultipartUpload(
    userId: string | null,
    transferId: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    mimeType: string
): Promise<InitMultipartResult> {
    const chunkSize = parseInt(process.env.UPLOAD_CHUNK_SIZE_MB || '2') * 1024 * 1024
    const totalParts = Math.ceil(fileSize / chunkSize)

    // Sanitize filename for storage
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const storageKey = `transfers/${transferId}/${fileId}-${sanitizedName}`

    let uploadId = ''

    if (STORAGE_TYPE === 's3' && s3Client) {
        // Initialize S3 multipart upload
        const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: storageKey,
            ContentType: mimeType,
        })

        const response = await s3Client.send(command)
        uploadId = response.UploadId || ''

        if (!uploadId) {
            throw new Error('Failed to initialize S3 multipart upload')
        }
    } else {
        // For local storage, generate a mock upload ID
        uploadId = `local-${crypto.randomBytes(16).toString('hex')}`
    }

    // Create upload session in database
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.UPLOAD_SESSION_EXPIRY_HOURS || '24'))

    const session = await prisma.uploadSession.create({
        data: {
            userId,
            transferId,
            fileId,
            fileName,
            fileSize: BigInt(fileSize),
            mimeType,
            storageKey,
            uploadId,
            totalParts,
            expiresAt,
        },
    })

    return {
        sessionId: session.id,
        uploadId,
        storageKey,
        chunkSize,
        totalParts,
    }
}

/**
 * Upload a single chunk/part
 */
export async function uploadChunk(
    sessionId: string,
    partNumber: number,
    chunk: Buffer
): Promise<UploadPartResult> {
    // Get session from database
    const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
    })

    if (!session) {
        throw new Error('Upload session not found')
    }

    if (session.status !== 'active') {
        throw new Error(`Upload session is ${session.status}`)
    }

    if (new Date() > session.expiresAt) {
        throw new Error('Upload session expired')
    }

    let ETag = ''

    if (STORAGE_TYPE === 's3' && s3Client) {
        // Upload part to S3
        const command = new UploadPartCommand({
            Bucket: BUCKET_NAME,
            Key: session.storageKey,
            UploadId: session.uploadId,
            PartNumber: partNumber,
            Body: chunk,
        })

        const response = await s3Client.send(command)
        ETag = response.ETag || ''

        if (!ETag) {
            throw new Error('Failed to upload chunk to S3')
        }
    } else {
        // For local storage, calculate MD5 as ETag
        ETag = crypto.createHash('md5').update(chunk).digest('hex')

        // Store chunk locally (simplified - in production, write to temp file)
        // For now, we'll just validate and track in DB
    }

    // Update session with uploaded part
    const uploadedParts = session.uploadedParts as any[]
    uploadedParts.push({
        partNumber,
        ETag,
        size: chunk.length,
    })

    await prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
            uploadedParts,
            updatedAt: new Date(),
        },
    })

    return {
        partNumber,
        ETag,
        size: chunk.length,
    }
}

/**
 * Complete multipart upload
 */
export async function completeMultipartUpload(
    sessionId: string
): Promise<{ storageKey: string; size: number }> {
    const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
    })

    if (!session) {
        throw new Error('Upload session not found')
    }

    const uploadedParts = session.uploadedParts as any[]

    // Verify all parts are uploaded
    if (uploadedParts.length !== session.totalParts) {
        throw new Error(
            `Incomplete upload: ${uploadedParts.length}/${session.totalParts} parts uploaded`
        )
    }

    // Sort parts by part number
    const sortedParts = uploadedParts.sort((a, b) => a.partNumber - b.partNumber)

    if (STORAGE_TYPE === 's3' && s3Client) {
        // Complete S3 multipart upload
        const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: session.storageKey,
            UploadId: session.uploadId,
            MultipartUpload: {
                Parts: sortedParts.map((part) => ({
                    PartNumber: part.partNumber,
                    ETag: part.ETag,
                })),
            },
        })

        await s3Client.send(command)
    }

    // Calculate total size
    const totalSize = sortedParts.reduce((sum, part) => sum + part.size, 0)

    // Verify size matches
    if (totalSize !== Number(session.fileSize)) {
        console.warn(
            `Size mismatch: uploaded ${totalSize} bytes, expected ${session.fileSize} bytes`
        )
    }

    // Update session status
    await prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
            status: 'completed',
            updatedAt: new Date(),
        },
    })

    return {
        storageKey: session.storageKey,
        size: totalSize,
    }
}

/**
 * Abort multipart upload
 */
export async function abortMultipartUpload(sessionId: string): Promise<void> {
    const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
    })

    if (!session) {
        return // Already deleted or doesn't exist
    }

    if (STORAGE_TYPE === 's3' && s3Client) {
        try {
            const command = new AbortMultipartUploadCommand({
                Bucket: BUCKET_NAME,
                Key: session.storageKey,
                UploadId: session.uploadId,
            })

            await s3Client.send(command)
        } catch (error) {
            console.error('Failed to abort S3 multipart upload:', error)
        }
    }

    // Update session status
    await prisma.uploadSession.update({
        where: { id: sessionId },
        data: {
            status: 'aborted',
            updatedAt: new Date(),
        },
    })
}

/**
 * Get upload progress for resume
 */
export async function getUploadProgress(sessionId: string): Promise<UploadProgress> {
    const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
    })

    if (!session) {
        throw new Error('Upload session not found')
    }

    const uploadedParts = session.uploadedParts as any[]
    const uploadedBytes = uploadedParts.reduce((sum, part) => sum + part.size, 0)

    return {
        sessionId: session.id,
        fileName: session.fileName,
        fileSize: Number(session.fileSize),
        uploadedParts: uploadedParts.length,
        totalParts: session.totalParts,
        uploadedBytes,
        status: session.status,
    }
}

/**
 * List uploaded parts (for resume)
 */
export async function listUploadedParts(sessionId: string): Promise<number[]> {
    const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
    })

    if (!session) {
        throw new Error('Upload session not found')
    }

    const uploadedParts = session.uploadedParts as any[]
    return uploadedParts.map((part) => part.partNumber).sort((a, b) => a - b)
}

/**
 * Cleanup expired upload sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const expiredSessions = await prisma.uploadSession.findMany({
        where: {
            expiresAt: {
                lt: new Date(),
            },
            status: {
                in: ['active', 'failed'],
            },
        },
    })

    // Abort each expired session
    for (const session of expiredSessions) {
        await abortMultipartUpload(session.id)
    }


    return expiredSessions.length
}

/**
 * Get a presigned URL for a specific part (for direct storage upload)
 */
export async function getPresignedPartUrlForSession(
    sessionId: string,
    partNumber: number
): Promise<{ url: string; storageType: string }> {
    const session = await prisma.uploadSession.findUnique({
        where: { id: sessionId },
    })

    if (!session) {
        throw new Error('Upload session not found')
    }

    if (STORAGE_TYPE === 's3') {
        const url = await getPresignedPartUrl(
            session.storageKey,
            session.uploadId,
            partNumber
        )
        return { url, storageType: 's3' }
    }

    // Local fallback - though we want to avoid this ideally, keep it for compatibility
    return {
        url: `/api/upload/chunk/${sessionId}`, // PUT to this will be caught by our chunk handler
        storageType: 'local'
    }
}

/**
 * Report a part as uploaded (after direct S3 upload)
 */
export async function reportPartUploaded(
    sessionId: string,
    partNumber: number,
    ETag: string,
    size: number
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        // Lock the row for update to prevent lost updates on JSON field
        // This is critical for concurrent chunk reporting
        await tx.$executeRaw`SELECT 1 FROM "UploadSession" WHERE id = ${sessionId} FOR UPDATE`

        const session = await tx.uploadSession.findUnique({
            where: { id: sessionId },
        })

        if (!session) {
            throw new Error('Upload session not found')
        }

        const uploadedParts = session.uploadedParts as any[]

        // Check if already exists (avoid duplicates)
        const existingIndex = uploadedParts.findIndex(p => p.partNumber === partNumber)
        if (existingIndex >= 0) {
            uploadedParts[existingIndex] = { partNumber, ETag, size }
        } else {
            uploadedParts.push({ partNumber, ETag, size })
        }

        await tx.uploadSession.update({
            where: { id: sessionId },
            data: {
                uploadedParts,
                updatedAt: new Date(),
            },
        })
    }, {
        timeout: 10000 // Ensure we don't hang too long
    })
}
