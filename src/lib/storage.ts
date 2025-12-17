import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// For development: local file storage
// In production: replace with S3 implementation

export interface UploadResult {
  storageKey: string
  checksum: string
}

export async function uploadFile(
  file: Buffer,
  transferId: string,
  originalName: string
): Promise<UploadResult> {
  await ensureUploadDir()
  
  const transferDir = path.join(UPLOAD_DIR, transferId)
  await fs.mkdir(transferDir, { recursive: true })
  
  const extension = path.extname(originalName)
  const storageKey = `${transferId}/${uuidv4()}${extension}`
  const filePath = path.join(UPLOAD_DIR, storageKey)
  
  await fs.writeFile(filePath, file)
  
  const checksum = crypto.createHash('md5').update(file).digest('hex')
  
  return {
    storageKey,
    checksum,
  }
}

export async function getFile(storageKey: string): Promise<Buffer | null> {
  try {
    const filePath = path.join(UPLOAD_DIR, storageKey)
    return await fs.readFile(filePath)
  } catch {
    return null
  }
}

export async function deleteFile(storageKey: string): Promise<boolean> {
  try {
    const filePath = path.join(UPLOAD_DIR, storageKey)
    await fs.unlink(filePath)
    return true
  } catch {
    return false
  }
}

export async function deleteTransferFiles(transferId: string): Promise<boolean> {
  try {
    const transferDir = path.join(UPLOAD_DIR, transferId)
    await fs.rm(transferDir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
}

export function generatePresignedUploadUrl(transferId: string, fileName: string): string {
  // In dev, return local API endpoint
  // In production, generate S3 presigned URL
  return `/api/upload/${transferId}?fileName=${encodeURIComponent(fileName)}`
}

export function generatePresignedDownloadUrl(
  storageKey: string,
  originalName: string,
  expiresInSeconds: number = 300
): string {
  // In dev, return local API endpoint with token
  // In production, generate S3 presigned URL
  const token = crypto.randomBytes(16).toString('hex')
  const expires = Date.now() + expiresInSeconds * 1000
  
  // Create signed URL (simplified for dev)
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

// File type validation
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  // Video
  'video/mp4', 'video/webm', 'video/quicktime',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  // Text
  'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
  'application/json', 'application/xml',
]

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.psm1', '.psd1', '.reg', '.inf', '.scf', '.lnk',
]

export function isFileTypeAllowed(mimeType: string, fileName: string): boolean {
  const extension = path.extname(fileName).toLowerCase()
  
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return false
  }
  
  // Allow all if mime type check is too restrictive for your use case
  // return ALLOWED_MIME_TYPES.includes(mimeType)
  return true // Allow all non-blocked types in dev
}
