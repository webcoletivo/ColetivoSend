import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'

// S3 Configuration
const s3Client = STORAGE_TYPE === 's3' ? new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  endpoint: process.env.AWS_ENDPOINT, // For Cloudflare R2 or other S3-compatible
  forcePathStyle: !!process.env.AWS_ENDPOINT,
}) : null

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || ''

// Ensure upload directory exists (only for local)
async function ensureUploadDir() {
  if (STORAGE_TYPE !== 'local') return
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export interface UploadResult {
  storageKey: string
  checksum: string
}

export async function uploadFile(
  file: Buffer,
  transferId: string,
  originalName: string
): Promise<UploadResult> {
  const checksum = crypto.createHash('md5').update(file).digest('hex')
  const extension = path.extname(originalName)
  const storageKey = `${transferId}/${uuidv4()}${extension}`

  if (STORAGE_TYPE === 's3' && s3Client) {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      Body: file,
      ContentType: getMimeType(originalName),
    }))
  } else {
    await ensureUploadDir()
    const transferDir = path.join(UPLOAD_DIR, transferId)
    await fs.mkdir(transferDir, { recursive: true })
    const filePath = path.join(UPLOAD_DIR, storageKey)
    await fs.writeFile(filePath, file)
  }
  
  return {
    storageKey,
    checksum,
  }
}

export async function getFile(storageKey: string): Promise<Buffer | null> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      }))
      const byteArray = await response.Body?.transformToUint8Array()
      return byteArray ? Buffer.from(byteArray) : null
    } else {
      const filePath = path.join(UPLOAD_DIR, storageKey)
      return await fs.readFile(filePath)
    }
  } catch (error) {
    console.error('Error getting file:', error)
    return null
  }
}

export async function deleteFile(storageKey: string): Promise<boolean> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      }))
    } else {
      const filePath = path.join(UPLOAD_DIR, storageKey)
      await fs.unlink(filePath)
    }
    return true
  } catch {
    return false
  }
}

export async function deleteTransferFiles(transferId: string): Promise<boolean> {
  try {
    if (STORAGE_TYPE === 's3' && s3Client) {
      // In S3, we need to list objects with prefix first or just handle individually
      // Simplified: This logic usually requires ListObjectsV2 for full cleanup
      // For now, relying on individual deletion or cloud lifecycle rules is safer
      return true 
    } else {
      const transferDir = path.join(UPLOAD_DIR, transferId)
      await fs.rm(transferDir, { recursive: true, force: true })
      return true
    }
  } catch {
    return false
  }
}

export function generatePresignedUploadUrl(transferId: string, fileName: string): string {
  // Currently we use server-side upload via API
  return `/api/upload/${transferId}?fileName=${encodeURIComponent(fileName)}`
}

export async function generatePresignedDownloadUrl(
  storageKey: string,
  originalName: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  if (STORAGE_TYPE === 's3' && s3Client) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
      ResponseContentDisposition: `attachment; filename="${originalName}"`,
    })
    return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds })
  }

  // Local fallback
  const token = crypto.randomBytes(16).toString('hex')
  const expires = Date.now() + expiresInSeconds * 1000
  const signature = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'secret')
    .update(`${storageKey}:${expires}`)
    .digest('hex')
    .slice(0, 16)
  
  return `/api/download/file?key=${encodeURIComponent(storageKey)}&name=${encodeURIComponent(originalName)}&expires=${expires}&sig=${signature}`
}

export function verifyDownloadSignature(
  storageKey: string,
  expires: string,
  signature: string
): boolean {
  const expiresNum = parseInt(expires)
  if (Date.now() > expiresNum) return false
  
  const expectedSig = crypto
    .createHmac('sha256', process.env.NEXTAUTH_SECRET || 'secret')
    .update(`${storageKey}:${expiresNum}`)
    .digest('hex')
    .slice(0, 16)
  
  return signature === expectedSig
}

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}

export function isFileTypeAllowed(mimeType: string, fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase()
  const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
    '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
    '.ps1', '.psm1', '.psd1', '.reg', '.inf', '.scf', '.lnk',
  ]
  
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return false
  }
  
  return true
}
